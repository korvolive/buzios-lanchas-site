-- Jetski dentro do pedido da lancha (Rodrigo, 2026-11-15)
-- O cliente escolhe o jetski na página da lancha (tempo e horário). O banco confere tudo e põe o valor (líquido do dono + 15% da Búzios).
-- O pagamento online cobra o sinal da lancha + o jetski inteiro. O sinal (sinal_valor) continua sendo só da lancha:
-- a parte do dono da lancha e o restante do embarque não mudam. O líquido do jetski vai para o dono do jetski depois do passeio.

alter table public.pedidos add column if not exists jetski uuid references public.jetskis(id);
alter table public.pedidos add column if not exists jetski_min int;
alter table public.pedidos add column if not exists jetski_ini time;
alter table public.pedidos add column if not exists jetski_valor numeric;
alter table public.pedidos add column if not exists jetski_neto numeric;
alter table public.pedidos add column if not exists jetski_repasse text;      -- 'asaas:<id>' (ou 'asaas:enviando' durante o envio)
alter table public.pedidos add column if not exists jetski_repasse_em timestamptz;

-- início e fim do passeio em minutos do dia (hora combinada do pedido ou horário padrão do período)
create or replace function public.jetski_janela(p_horario text, p_hi text, p_hf text, out ini int, out fim int)
language plpgsql immutable set search_path to 'public' as $$
begin
  if coalesce(p_hi,'') ~ '^\d{1,2}:\d{2}' and coalesce(p_hf,'') ~ '^\d{1,2}:\d{2}' then
    ini := extract(epoch from substr(p_hi,1,5)::time)::int / 60; fim := extract(epoch from substr(p_hf,1,5)::time)::int / 60;
    if fim <= ini then fim := null; end if; -- passa da meia-noite: sem jetski
    return;
  end if;
  ini := case p_horario when 'manha' then 600 when 'tarde' then 840 when 'dia' then 600 end;
  fim := case p_horario when 'manha' then 840 when 'tarde' then 1080 when 'dia' then 1020 end;
end $$;

-- confere e dá o valor do jetski do pedido (o que veio da tela é só pedido)
create or replace function public.tg_pedido_jetski()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare j public.jetskis; w record; a int; n numeric; mudou boolean;
begin
  if tg_op = 'UPDATE' then
    -- cliente não troca o jetski depois de pedir (só o administrador ou o servidor)
    if (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_valor, new.jetski_neto) is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_valor, old.jetski_neto)
       and auth.uid() is not null and not public.e_admin() then
      new.jetski := old.jetski; new.jetski_min := old.jetski_min; new.jetski_ini := old.jetski_ini; new.jetski_valor := old.jetski_valor; new.jetski_neto := old.jetski_neto;
    end if;
    if new.jetski_repasse is distinct from old.jetski_repasse or new.jetski_repasse_em is distinct from old.jetski_repasse_em then
      if auth.uid() is not null and not public.e_admin() then new.jetski_repasse := old.jetski_repasse; new.jetski_repasse_em := old.jetski_repasse_em; end if;
    end if;
    mudou := (new.jetski, new.jetski_min, new.jetski_ini, new.lancha, new.data, new.horario, new.hora_ini, new.hora_fim)
             is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.lancha, old.data, old.horario, old.hora_ini, old.hora_fim);
    if not mudou then return new; end if;
  else
    new.jetski_repasse := null; new.jetski_repasse_em := null;
  end if;
  if new.jetski is null then
    new.jetski_min := null; new.jetski_ini := null; new.jetski_valor := null; new.jetski_neto := null; return new;
  end if;
  select * into j from public.jetskis where id = new.jetski;
  if j.id is null or not j.ativo or (j.oculto and not public.e_admin()) then raise exception 'JETSKI_INDISPONIVEL'; end if;
  if exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then raise exception 'JETSKI_SO_LANCHA'; end if;
  if new.jetski_min is null or new.jetski_ini is null then raise exception 'JETSKI_HORARIO'; end if;
  n := public.jetski_neto(j, new.jetski_min);
  if n is null or n <= 0 then raise exception 'JETSKI_TEMPO'; end if;
  w := public.jetski_janela(new.horario, new.hora_ini, new.hora_fim);
  a := extract(epoch from new.jetski_ini)::int / 60;
  -- começa 1 h depois da saída e termina até 1 h antes da volta; inícios de meia em meia hora
  if w.ini is null or w.fim is null or a % 30 <> 0 or a < w.ini + 60 or a + new.jetski_min > w.fim - 60 then raise exception 'JETSKI_JANELA'; end if;
  new.jetski_neto := n; new.jetski_valor := public.jetski_valor(n);
  return new;
end $$;
create or replace trigger pedido_jetski before insert or update on public.pedidos
  for each row execute function public.tg_pedido_jetski();

-- o horário do jetski fica preso enquanto o pedido está vivo (pendente ou aprovado) e sai quando ele cai
create or replace function public.tg_pedido_jetski_uso()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare vivo boolean := new.status in ('pendente','aprovado'); u bigint; a time; f time;
begin
  select id into u from public.jetski_usos where pedido_id = new.id and removido_em is null limit 1;
  if new.jetski is null or not vivo then
    if u is not null then update public.jetski_usos set removido_em = now() where id = u; end if;
    return null;
  end if;
  a := new.jetski_ini; f := new.jetski_ini + make_interval(mins => new.jetski_min);
  if u is null then
    insert into public.jetski_usos (jetski, data, ini, fim, tipo, lancha, pedido_id, bloqueio_id, minutos, valor, neto, criado_por)
      values (new.jetski, new.data, a, f, 'uso', new.lancha, new.id, new.bloqueio_id, new.jetski_min, new.jetski_valor, new.jetski_neto, new.cliente);
  else
    update public.jetski_usos set jetski = new.jetski, data = new.data, ini = a, fim = f, lancha = new.lancha, bloqueio_id = new.bloqueio_id,
      minutos = new.jetski_min, valor = new.jetski_valor, neto = new.jetski_neto
    where id = u and (jetski, data, ini, fim, lancha, bloqueio_id, minutos, valor, neto)
      is distinct from (new.jetski, new.data, a, f, new.lancha, new.bloqueio_id, new.jetski_min, new.jetski_valor, new.jetski_neto);
  end if;
  return null;
end $$;
create or replace trigger pedido_jetski_uso after insert or update on public.pedidos
  for each row execute function public.tg_pedido_jetski_uso();

-- quanto o cliente paga online: sinal da lancha + jetski inteiro
create or replace function public.valor_online(p public.pedidos)
returns numeric language sql stable set search_path to 'public' as $$
  select case when coalesce(p.sinal_valor,0) > 0 then p.sinal_valor + coalesce(p.jetski_valor,0) else 0 end
$$;

-- administrador tira o jetski de um pedido ainda não pago
create or replace function public.tirar_jetski(pid bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.e_admin() then raise exception 'SO_ADMIN'; end if;
  if exists (select 1 from public.pagamentos_asaas where pedido = pid and pago_em is not null)
     or exists (select 1 from public.pagamentos_pp where pedido = pid and pago_em is not null) then raise exception 'JA_PAGO'; end if;
  update public.pedidos set jetski = null, atualizado_em = now() where id = pid;
  return true;
end $$;
revoke all on function public.tirar_jetski(bigint) from public, anon;
grant execute on function public.tirar_jetski(bigint) to authenticated;

-- o cliente pode mandar só a escolha (jetski, tempo e início); valor e líquido o banco calcula
grant insert (jetski, jetski_min, jetski_ini) on public.pedidos to authenticated;
-- mensagens do sinal com o jetski junto (Rodrigo 2026-11-15): o valor do botão/chat é o que o cliente paga online
create or replace function public.mb_libera_sinal_sozinho()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v numeric; vt numeric; cid bigint; tx text; ocupado boolean;
begin
  if not public.lancha_auto(new.lancha) or new.status <> 'pendente' or new.sinal_liberado_em is not null
     or new.vendedor is not null or new.cupom is not null or new.oferta is not null or new.desc_parceiro is not null
     or new.horario not in ('manha','tarde','dia') or new.data < current_date then
    return new;
  end if;
  if public._epoca(new.data) = 'reveillon' or public._feriadao(new.data, (select sem_feriados from public.precos where lancha = new.lancha)) is not null then
    return new;
  end if;
  select exists(select 1 from public.bloqueios b where b.lancha = new.lancha and b.data = new.data
                  and (b.horario = new.horario or b.horario = 'dia' or new.horario = 'dia')) into ocupado;
  if ocupado then return new; end if;
  if exists(select 1 from public.pedidos x where x.id <> new.id and x.lancha = new.lancha and x.data = new.data and x.status = 'pendente'
              and x.sinal_liberado_em is not null and (x.horario = new.horario or x.horario = 'dia' or new.horario = 'dia')) then return new; end if;
  if exists(select 1 from public.manutencoes m where to_jsonb(m)->>'lancha' = new.lancha
              and new.data between (to_jsonb(m)->>'de')::date and (to_jsonb(m)->>'ate')::date) then
    return new;
  end if;
  v := round(coalesce(public._valor_na_data(new.lancha, new.data, new.horario, false), 0) / 2, 2);
  if not (v > 0) then return new; end if;
  vt := v + coalesce(new.jetski_valor, 0);
  update public.pedidos set sinal_valor = v, sinal_liberado_em = now(), atualizado_em = now() where id = new.id;
  insert into public.conversas(tipo, cliente) values ('suporte', new.cliente) on conflict (cliente) where tipo = 'suporte' do nothing;
  select id into cid from public.conversas where tipo = 'suporte' and cliente = new.cliente;
  tx := format('Boa notícia: a lancha está disponível! Para confirmar a sua reserva, pague %s de R$ %s no botão "Pagar o sinal" (Pix ou cartão). Assim que o pagamento cair, a reserva se confirma automaticamente.',
               case when coalesce(new.jetski_valor, 0) > 0 then 'o sinal da lancha com o jetski' else 'o sinal' end,
               translate(to_char(vt, 'FM999,999,990.00'), ',.', '.,'));
  insert into public.mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || vt::text, new.id);
  update public.mensagens set texto = split_part(texto, ' Agora vamos conferir', 1) where pedido = new.id and sistema like 'pedido:%';
  update public.conversas set ultima_em = now(), ultima_msg = left(tx, 80), anexo_liberado = true, encerrada_em = null where id = cid;
  return new;
end $function$;

create or replace function public.liberar_sinal(pid bigint, valor numeric)
returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare p pedidos%rowtype; cid bigint; mid bigint; tx text; v numeric := round(coalesce(valor,0), 2); vt numeric;
begin
  if not public.e_admin() then raise exception 'Sem acesso'; end if;
  select * into p from pedidos where id = pid;
  if p.id is null or p.status <> 'pendente' then raise exception 'Pedido não está pendente'; end if;
  if not (v > 0) then raise exception 'VALOR'; end if;
  vt := v + coalesce(p.jetski_valor, 0);
  update pedidos set sinal_valor = v, sinal_liberado_em = coalesce(sinal_liberado_em, now()), atualizado_em = now() where id = pid;
  insert into conversas(tipo, cliente) values ('suporte', p.cliente) on conflict (cliente) where tipo = 'suporte' do nothing;
  select id into cid from conversas where tipo = 'suporte' and cliente = p.cliente;
  tx := format('Boa notícia: a lancha está disponível! Para confirmar a sua reserva, pague %s de R$ %s pelo Pix (CNPJ 32.154.099/0001-72, Búzios Lanchas) e anexe o comprovante aqui no chat, no botão de anexo.',
               case when coalesce(p.jetski_valor, 0) > 0 then 'o sinal da lancha com o jetski' else 'o sinal' end,
               translate(to_char(vt, 'FM999,999,990.00'), ',.', '.,'));
  insert into mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || vt::text, pid) returning id into mid;
  update conversas set ultima_em = now(), ultima_msg = left(tx, 80), anexo_liberado = true, encerrada_em = null where id = cid;
  return mid;
end $function$;

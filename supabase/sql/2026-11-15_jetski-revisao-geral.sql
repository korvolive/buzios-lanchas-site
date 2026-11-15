-- Revisão geral do jetski (2026-11-15, conversa "Revisar sistema do jetski"). Aplicar depois de 2026-11-15_jetski-revisao.sql.
-- 1) Mudar a lancha, a data ou o horário de um passeio com jetski não trava mais com erro técnico:
--    se o horário do jetski não cabe mais (ou ficou ocupado), o banco procura o primeiro início livre do mesmo tempo
--    dentro da nova janela; só recusa, com mensagem clara, quando não cabe de jeito nenhum.
--    O "jetski escondido" só vale para pedido novo ou troca de jetski (mover um passeio já feito não esbarra nisso).
-- 2) Mensagens de erro do jetski legíveis no app (o código JETSKI_... continua no começo, o site e o alterar_pedido usam).
-- 3) Crédito: o valor sugerido inclui o jetski pago junto com o sinal (antes o cliente perdia o valor do jetski).
-- 4) Tirar o jetski de um pedido não pago também acerta a cobrança da central (Pix/PayPal) para só o sinal da lancha.
-- 6) Prazo de pagamento vencido (Rodrigo 2026-11-15): o horário do jetski é liberado junto com a data da lancha.
--    Se o cliente voltar para pagar, o jetski volta para ele só se ainda estiver livre; senão o pagamento é recusado
--    (pp_vaga devolve 'jetski' e a tela avisa que o jetski não está mais disponível).
-- 5) jetski_do_passeio: o dono da lancha, o marinheiro do passeio e o dono do jetski veem no passeio que vai ter jetski.

create or replace function public.tg_pedido_jetski()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare j public.jetskis; w record; a int; n numeric; c int; tot int; mudou boolean; escolha boolean; uid bigint; s int; achou int;
begin
  if tg_op = 'UPDATE' then
    -- cliente não troca o jetski depois de pedir (só o administrador ou o servidor)
    if (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_valor, new.jetski_neto, new.jetski_cortesia) is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_valor, old.jetski_neto, old.jetski_cortesia)
       and auth.uid() is not null and not public.e_admin() then
      new.jetski := old.jetski; new.jetski_min := old.jetski_min; new.jetski_ini := old.jetski_ini; new.jetski_valor := old.jetski_valor; new.jetski_neto := old.jetski_neto; new.jetski_cortesia := old.jetski_cortesia;
    end if;
    if new.jetski_repasse is distinct from old.jetski_repasse or new.jetski_repasse_em is distinct from old.jetski_repasse_em then
      if auth.uid() is not null and not public.e_admin() then new.jetski_repasse := old.jetski_repasse; new.jetski_repasse_em := old.jetski_repasse_em; end if;
    end if;
    mudou := (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_cortesia, new.lancha, new.data, new.horario, new.hora_ini, new.hora_fim)
             is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_cortesia, old.lancha, old.data, old.horario, old.hora_ini, old.hora_fim);
    if not mudou then return new; end if;
    -- só o passeio mudou (lancha, data ou horário): o jetski acompanha
    escolha := (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_cortesia) is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_cortesia);
    -- pedido que já caiu (recusado, cancelado) e continua ligado ao passeio: não confere nem mexe no jetski dele
    if not escolha and new.status not in ('pendente', 'aprovado') then return new; end if;
  else
    new.jetski_repasse := null; new.jetski_repasse_em := null;
    escolha := true;
  end if;
  if new.jetski is null then
    new.jetski_min := null; new.jetski_ini := null; new.jetski_valor := null; new.jetski_neto := null; new.jetski_cortesia := null; return new;
  end if;
  select * into j from public.jetskis where id = new.jetski;
  if j.id is null or not j.ativo or (escolha and j.oculto and not public.e_admin()) then
    raise exception 'JETSKI_INDISPONIVEL: este jetski não está disponível.'; end if;
  if exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then
    raise exception 'JETSKI_SO_LANCHA: jetski só vai junto com lancha, não com escuna. Tire o jetski do pedido antes.'; end if;
  c := case when coalesce(new.jetski_cortesia,0) > 0 and j.cortesia_lancha = new.lancha and coalesce(j.cortesia_min,0) > 0 then j.cortesia_min else 0 end;
  new.jetski_cortesia := nullif(c, 0);
  if new.jetski_ini is null or (new.jetski_min is null and c = 0) then raise exception 'JETSKI_HORARIO: escolha o tempo e o horário do jetski.'; end if;
  if new.jetski_min is null then n := null;
  else
    n := public.jetski_neto(j, new.jetski_min);
    if n is null or n <= 0 then raise exception 'JETSKI_TEMPO: esse tempo de jetski não está à venda.'; end if;
  end if;
  tot := coalesce(new.jetski_min, 0) + c;
  w := public.jetski_janela(new.horario, new.hora_ini, new.hora_fim);
  if w.ini is null or w.fim is null then
    raise exception 'JETSKI_JANELA: o jetski não vai em passeio noturno nem que passa da meia-noite. Tire o jetski do pedido antes.'; end if;
  a := extract(epoch from new.jetski_ini)::int / 60;
  if not escolha then
    -- passeio mudou: mantém o horário do jetski se ainda cabe e está livre; senão, o primeiro início livre do mesmo tempo
    select id into uid from public.jetski_usos where pedido_id = new.id and removido_em is null limit 1;
    achou := null;
    for s in select x from generate_series(w.ini + 60, w.fim - 60 - tot, 30) x order by (x = a) desc, x loop
      if not public.jetski_choca(new.jetski, new.data, make_time(s / 60, s % 60, 0), make_time(s / 60, s % 60, 0) + make_interval(mins => tot), new.lancha, uid) then
        achou := s; exit;
      end if;
    end loop;
    if achou is null then
      raise exception 'JETSKI_OCUPADO: o jetski deste pedido (%) não cabe no novo dia/horário (ocupado ou janela curta). Tire o jetski do pedido ou escolha outro horário.', public.jetski_min_txt(tot);
    end if;
    a := achou; new.jetski_ini := make_time(a / 60, a % 60, 0);
  end if;
  -- começa 1 h depois da saída e termina até 1 h antes da volta; inícios de meia em meia hora
  if a % 30 <> 0 or a < w.ini + 60 or a + tot > w.fim - 60 then
    raise exception 'JETSKI_JANELA: o jetski tem de começar 1 h depois da saída e terminar 1 h antes da volta.'; end if;
  new.jetski_neto := n; new.jetski_valor := case when n is null then null else public.jetski_valor(n) end;
  -- já pago online: mudar data/horário/lancha não muda o preço do jetski que o cliente pagou nem o líquido do dono
  if tg_op = 'UPDATE' and (new.jetski, new.jetski_min) is not distinct from (old.jetski, old.jetski_min) and old.jetski_valor is not null
     and (exists (select 1 from public.pagamentos_asaas x where x.pedido = new.id and x.pago_em is not null)
          or exists (select 1 from public.pagamentos_pp x where x.pedido = new.id and x.pago_em is not null)) then
    new.jetski_neto := old.jetski_neto; new.jetski_valor := old.jetski_valor;
  end if;
  return new;
end $$;

create or replace function public.jetski_min_txt(m int)
returns text language sql immutable set search_path to 'public' as $$
  select case when m is null then '' when m < 60 then m || ' min' else (m / 60) || 'h' || case when m % 60 > 0 then lpad((m % 60)::text, 2, '0') else '' end end
$$;

create or replace function public.tg_jetski_uso_confere()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.tipo = 'bloqueio' then new.lancha := null; end if;
  if new.removido_em is null and public.jetski_choca(new.jetski, new.data, new.ini, new.fim, new.lancha, new.id) then
    raise exception 'JETSKI_OCUPADO: o jetski já está ocupado nesse horário (entre lanchas diferentes ficam 15 min livres antes e depois).';
  end if;
  return new;
end $$;

-- crédito: sem valor informado, vale o sinal + o jetski pago junto (se o jetski ainda não foi repassado ao dono)
create or replace function public.virar_credito(bid bigint, ate date, v numeric default null)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; c public.creditos%rowtype; tel text; val numeric; jv numeric;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.e_admin() then raise exception 'Só o administrador transforma em crédito'; end if;
  select * into b from public.bloqueios where id = bid for update;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if b.id is null or a.bloqueio_id is null then raise exception 'Passeio não encontrado'; end if;
  if a.origem is distinct from 'buzios' then raise exception 'Só passeio fechado pela Búzios Lanchas vira crédito'; end if;
  if not (coalesce(a.sinal, 0) > 0) then raise exception 'Este passeio não tem sinal pago'; end if;
  if b.data < hoje then raise exception 'A data deste passeio já passou'; end if;
  select coalesce(sum(p.jetski_valor), 0) into jv from public.pedidos p
   where p.bloqueio_id = bid and p.status in ('aprovado', 'pendente') and p.jetski_valor > 0 and p.jetski_repasse is null;
  val := coalesce(v, a.sinal + jv);
  if not (val > 0 and val <= 99999) then raise exception 'Valor do crédito inválido'; end if;
  if ate is null or ate <= hoje or ate > hoje + interval '2 years' then raise exception 'Escolha uma validade entre amanhã e 2 anos'; end if;
  tel := coalesce(nullif(btrim(a.telefone), ''), (select whatsapp from public.clientes where user_id = a.cliente_conta));
  insert into public.creditos (cliente, nome, telefone, lancha, valor, valido_ate, origem_data, origem_horario, origem_bloqueio, obs, passeio)
    values (a.cliente_conta, nullif(btrim(a.cliente), ''), tel, b.lancha, val, ate, b.data, b.horario, b.id, nullif(btrim(a.obs), ''),
            jsonb_build_object('bloqueio', to_jsonb(b), 'anotacao', to_jsonb(a))) -- cópia do passeio, para voltar igual
    returning * into c;
  perform public._credito_chat(c, 'novo');
  update public.pedidos set motivo = 'credito' where bloqueio_id = bid and status in ('aprovado', 'pendente');
  delete from public.bloqueios where id = bid; -- o gatilho cancela o pedido ligado; a data (e o horário do jetski) fica livre
  return c.id;
end $$;

-- tirar o jetski de um pedido não pago: a cobrança da central volta a ser só o sinal da lancha
create or replace function public.tirar_jetski(pid bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare p public.pedidos; g record;
begin
  if not public.e_admin() then raise exception 'SO_ADMIN'; end if;
  select * into p from public.pedidos where id = pid for update;
  if p.id is null then return false; end if;
  if exists (select 1 from public.pagamentos_asaas where pedido = pid and pago_em is not null)
     or exists (select 1 from public.pagamentos_pp where pedido = pid and (pago_em is not null or captura is not null)) then
    raise exception 'JA_PAGO: o cliente já pagou o jetski; combine a devolução antes de tirar.'; end if;
  update public.pedidos set jetski = null, atualizado_em = now() where id = pid;
  select * into g from public.pagamentos_pp where pedido = pid;
  if found and coalesce(p.jetski_valor, 0) > 0 and coalesce(p.sinal_valor, 0) > 0 then
    update public.pagamentos_pp set valor = case when g.moeda = 'BRL' then p.sinal_valor
                                                 else ceil(g.valor * p.sinal_valor / (p.sinal_valor + p.jetski_valor)) end,
                                    order_id = null, atualizado_em = now()
     where pedido = pid and pago_em is null;
  end if;
  return true;
end $$;
revoke all on function public.tirar_jetski(bigint) from public, anon;
grant execute on function public.tirar_jetski(bigint) to authenticated;

-- jetski de um passeio, para a equipe da lancha saber que o jetski vai encontrar a lancha (sem valores)
create or replace function public.jetski_do_passeio(bid bigint)
returns table (nome text, ini time, fim time, minutos int)
language sql stable security definer set search_path to 'public' as $$
  select j.nome, u.ini, u.fim, u.minutos
  from public.jetski_usos u join public.jetskis j on j.id = u.jetski join public.bloqueios b on b.id = bid
  where u.bloqueio_id = bid and u.removido_em is null and u.tipo = 'uso'
    and (public.e_admin()
         or exists (select 1 from public.donos d where d.lancha = b.lancha and d.user_id = auth.uid())
         or exists (select 1 from public.anotacoes a where a.bloqueio_id = bid and a.marinheiro = auth.uid())
         or exists (select 1 from public.marinheiros m where m.lancha = b.lancha and m.user_id = auth.uid())
         or j.dono = auth.uid())
  order by u.ini
$$;
revoke all on function public.jetski_do_passeio(bigint) from public, anon;
grant execute on function public.jetski_do_passeio(bigint) to authenticated;

-- (6) conflito: o jetski de um pedido pago (ou com comprovante) foi para outro no meio tempo (caso raro):
--     mensagem no chat de suporte do cliente (sistema 'jetski-conflito'), que a equipe vê na lista de conversas do app
create or replace function public.jetski_avisa_conflito(pid bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare p public.pedidos; cid bigint; tx text;
begin
  select * into p from public.pedidos where id = pid;
  if p.id is null or p.cliente is null then return; end if;
  select id into cid from public.conversas where tipo = 'suporte' and cliente = p.cliente;
  if cid is null then return; end if;
  tx := format('O horário do jetski que você escolheu (%s, às %s) foi reservado por outro cliente enquanto o prazo de pagamento estava vencido. A Búzios Lanchas vai falar com você aqui para combinar outro horário do jetski ou devolver o valor dele.',
               to_char(p.data, 'DD/MM'), replace(left(p.jetski_ini::text, 5), ':', 'h'));
  insert into public.mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'jetski-conflito', p.id);
  update public.conversas set ultima_em = now(), ultima_msg = left(tx, 80), encerrada_em = null where id = cid;
exception when others then null; -- o aviso nunca derruba o pagamento
end $$;
revoke all on function public.jetski_avisa_conflito(bigint) from public, anon, authenticated;

-- (6) prazo vencido: pedido pendente com prazo_vencido_em não segura o jetski; pago (aprovado) sempre segura
create or replace function public.tg_pedido_jetski_uso()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare vivo boolean := new.status = 'aprovado' or (new.status = 'pendente' and (new.prazo_vencido_em is null or new.comprovante_em is not null));
  u bigint; a time; f time; tot int; tolera boolean;
begin
  select id into u from public.jetski_usos where pedido_id = new.id and removido_em is null limit 1;
  if new.jetski is null or not vivo then
    if u is not null then update public.jetski_usos set removido_em = now() where id = u; end if;
    return null;
  end if;
  tot := coalesce(new.jetski_min, 0) + coalesce(new.jetski_cortesia, 0);
  a := new.jetski_ini; f := new.jetski_ini + make_interval(mins => tot);
  if u is null then
    -- pagamento já confirmado ou comprovante mandado depois do prazo: nunca derruba isso; se o jetski foi para outro nesse meio tempo,
    -- o administrador recebe um aviso no chat do cliente (revisão de segurança 2026-11-15)
    tolera := tg_op = 'UPDATE' and (new.status = 'aprovado' or new.prazo_vencido_em is not null);
    if tolera then
      begin
        insert into public.jetski_usos (jetski, data, ini, fim, tipo, lancha, pedido_id, bloqueio_id, minutos, valor, neto, criado_por)
          values (new.jetski, new.data, a, f, 'uso', new.lancha, new.id, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto, new.cliente);
      exception when raise_exception then
        raise warning 'JETSKI_CONFLITO pedido % pago mas o jetski ficou ocupado', new.id;
        perform public.jetski_avisa_conflito(new.id);
      end;
    else
      insert into public.jetski_usos (jetski, data, ini, fim, tipo, lancha, pedido_id, bloqueio_id, minutos, valor, neto, criado_por)
        values (new.jetski, new.data, a, f, 'uso', new.lancha, new.id, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto, new.cliente);
    end if;
  else
    update public.jetski_usos set jetski = new.jetski, data = new.data, ini = a, fim = f, lancha = new.lancha, bloqueio_id = new.bloqueio_id,
      minutos = tot, valor = new.jetski_valor, neto = new.jetski_neto
    where id = u and (jetski, data, ini, fim, lancha, bloqueio_id, minutos, valor, neto)
      is distinct from (new.jetski, new.data, a, f, new.lancha, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto);
  end if;
  return null;
end $$;

-- (6) pagamento: com o jetski solto (prazo vencido) e já ocupado por outro, não cobra ('jetski')
create or replace function public.pp_vaga(pid bigint, segurar boolean default false)
returns text language plpgsql security definer set search_path to 'public' as $$
declare p record;
begin
  select id, lancha, data, horario, jetski, jetski_ini, jetski_min, jetski_cortesia into p from pedidos where id = pid;
  if not found then return 'pedido'; end if;
  perform pg_advisory_xact_lock(hashtext('vaga:' || p.lancha || ':' || p.data::text));
  if exists (select 1 from bloqueios b where b.lancha = p.lancha and b.data = p.data and b.revenda is null and choca_horario(b.horario, p.horario)
               and not exists (select 1 from pedidos q where q.id = pid and q.bloqueio_id = b.id))
     or exists (select 1 from pedidos o left join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and choca_horario(o.horario, p.horario)
                 and (o.status = 'aprovado' or (o.status = 'pendente' and (g.pago_em is not null or g.captura is not null or o.comprovante_em is not null))))
     or exists (select 1 from manutencoes m where m.lancha = p.lancha and p.data between m.de and m.ate) then
    return 'ocupada';
  end if;
  if p.jetski is not null and p.jetski_ini is not null
     and not exists (select 1 from jetski_usos u where u.pedido_id = pid and u.removido_em is null)
     and (not exists (select 1 from jetskis j where j.id = p.jetski and j.ativo)
          or public.jetski_choca(p.jetski, p.data, p.jetski_ini, p.jetski_ini + make_interval(mins => coalesce(p.jetski_min, 0) + coalesce(p.jetski_cortesia, 0)), p.lancha, null)) then
    return 'jetski';
  end if;
  if exists (select 1 from pedidos o join pagamentos_asaas a on a.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and o.status = 'pendente' and choca_horario(o.horario, p.horario)
                 and a.pago_em is null)
     or exists (select 1 from pedidos o join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and o.status = 'pendente' and choca_horario(o.horario, p.horario)
                 and g.reservado_em > now() - interval '10 minutes' and g.pago_em is null) then
    return 'pagando';
  end if;
  if segurar then update pagamentos_pp set reservado_em = now() where pedido = pid; end if;
  return 'livre';
end $$;

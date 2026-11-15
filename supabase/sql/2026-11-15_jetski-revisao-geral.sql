-- Revisão geral do jetski (2026-11-15, conversa "Revisar sistema do jetski"). Aplicar depois de 2026-11-15_jetski-revisao.sql.
-- 1) Mudar a lancha, a data ou o horário de um passeio com jetski não trava mais com erro técnico:
--    se o horário do jetski não cabe mais (ou ficou ocupado), o banco procura o primeiro início livre do mesmo tempo
--    dentro da nova janela; só recusa, com mensagem clara, quando não cabe de jeito nenhum.
--    O "jetski escondido" só vale para pedido novo ou troca de jetski (mover um passeio já feito não esbarra nisso).
-- 2) Mensagens de erro do jetski legíveis no app (o código JETSKI_... continua no começo, o site e o alterar_pedido usam).
-- 3) Crédito: o valor sugerido inclui o jetski pago junto com o sinal (antes o cliente perdia o valor do jetski).
-- 4) Tirar o jetski de um pedido não pago também acerta a cobrança da central (Pix/PayPal) para só o sinal da lancha.
-- 5) jetski_do_passeio: o dono da lancha, o marinheiro do passeio e o dono do jetski veem no passeio que vai ter jetski.

create or replace function public.tg_pedido_jetski()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare j public.jetskis; w record; a int; n numeric; mudou boolean; escolha boolean; uid bigint; s int; achou int;
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
    -- só o passeio mudou (lancha, data ou horário): o jetski acompanha
    escolha := (new.jetski, new.jetski_min, new.jetski_ini) is distinct from (old.jetski, old.jetski_min, old.jetski_ini);
    -- pedido que já caiu (recusado, cancelado) e continua ligado ao passeio: não confere nem mexe no jetski dele
    if not escolha and new.status not in ('pendente', 'aprovado') then return new; end if;
  else
    new.jetski_repasse := null; new.jetski_repasse_em := null;
    escolha := true;
  end if;
  if new.jetski is null then
    new.jetski_min := null; new.jetski_ini := null; new.jetski_valor := null; new.jetski_neto := null; return new;
  end if;
  select * into j from public.jetskis where id = new.jetski;
  if j.id is null or not j.ativo or (escolha and j.oculto and not public.e_admin()) then
    raise exception 'JETSKI_INDISPONIVEL: este jetski não está disponível.'; end if;
  if exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then
    raise exception 'JETSKI_SO_LANCHA: jetski só vai junto com lancha, não com escuna. Tire o jetski do pedido antes.'; end if;
  if new.jetski_min is null or new.jetski_ini is null then raise exception 'JETSKI_HORARIO: escolha o tempo e o horário do jetski.'; end if;
  n := public.jetski_neto(j, new.jetski_min);
  if n is null or n <= 0 then raise exception 'JETSKI_TEMPO: esse tempo de jetski não está à venda.'; end if;
  w := public.jetski_janela(new.horario, new.hora_ini, new.hora_fim);
  if w.ini is null or w.fim is null then
    raise exception 'JETSKI_JANELA: o jetski não vai em passeio noturno nem que passa da meia-noite. Tire o jetski do pedido antes.'; end if;
  a := extract(epoch from new.jetski_ini)::int / 60;
  if not escolha then
    -- passeio mudou: mantém o horário do jetski se ainda cabe e está livre; senão, o primeiro início livre do mesmo tempo
    select id into uid from public.jetski_usos where pedido_id = new.id and removido_em is null limit 1;
    achou := null;
    for s in select x from generate_series(w.ini + 60, w.fim - 60 - new.jetski_min, 30) x order by (x = a) desc, x loop
      if not public.jetski_choca(new.jetski, new.data, make_time(s / 60, s % 60, 0), make_time(s / 60, s % 60, 0) + make_interval(mins => new.jetski_min), new.lancha, uid) then
        achou := s; exit;
      end if;
    end loop;
    if achou is null then
      raise exception 'JETSKI_OCUPADO: o jetski deste pedido (%) não cabe no novo dia/horário (ocupado ou janela curta). Tire o jetski do pedido ou escolha outro horário.', public.jetski_min_txt(new.jetski_min);
    end if;
    a := achou; new.jetski_ini := make_time(a / 60, a % 60, 0);
  end if;
  -- começa 1 h depois da saída e termina até 1 h antes da volta; inícios de meia em meia hora
  if a % 30 <> 0 or a < w.ini + 60 or a + new.jetski_min > w.fim - 60 then
    raise exception 'JETSKI_JANELA: o jetski tem de começar 1 h depois da saída e terminar 1 h antes da volta.'; end if;
  new.jetski_neto := n; new.jetski_valor := public.jetski_valor(n);
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

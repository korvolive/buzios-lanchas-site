-- publicar: auto
-- Várias lanchas (e jetskis) num pagamento só (Rodrigo 2026-11-19, caso pedidos 77/78).
-- Cliente com pré-reserva NÃO paga quer mais uma lancha: entra no mesmo grupo, mesma data, horário e horas.
-- Cada pedido do grupo guarda o próprio sinal, jetski e parte do dono; a reserva principal (menor bloqueio) leva a cobrança
-- com o total. Pago, a cobrança é "espelhada" em uma linha por pedido (asaas_real = id verdadeiro no Asaas), para os
-- repasses, a planilha e os recibos continuarem funcionando pedido a pedido. Idempotente.

alter table public.pagamentos_asaas add column if not exists asaas_real text;
alter table public.pagamentos_asaas add column if not exists partes jsonb;
alter table public.pagamentos_pp add column if not exists partes jsonb;
create index if not exists pagamentos_asaas_asaas_real_idx on public.pagamentos_asaas (asaas_real) where asaas_real is not null;

-- pedidos (pendentes ou aprovados) do grupo de um pedido; principal primeiro. Vazio quando o pedido não é de grupo.
create or replace function public.pedido_grupo(pid bigint)
 returns table(id bigint, principal boolean, lancha text, status text, sinal_valor numeric, jetski_valor numeric, repasse_dono numeric,
               bloqueio_id bigint, pagar_ate timestamptz, horario text, hora_ini text, hora_fim text, jetski_min int, jetski_cortesia int, jetski_ini text,
               preco_base numeric, preco_cliente numeric, pessoas int)
 language sql stable security definer set search_path to 'public' as $$
  with me as (select a.grupo from public.pedidos p join public.anotacoes a on a.bloqueio_id = p.bloqueio_id where p.id = pid),
  pr as (select min(a.bloqueio_id) b from public.anotacoes a, me where me.grupo is not null and a.grupo = me.grupo),
  m as (select p.*, (p.bloqueio_id = pr.b) eh from public.pedidos p join public.anotacoes a on a.bloqueio_id = p.bloqueio_id, me, pr
         where me.grupo is not null and a.grupo = me.grupo and p.status in ('pendente', 'aprovado'))
  select m.id, m.eh, m.lancha, m.status, m.sinal_valor, m.jetski_valor, m.repasse_dono, m.bloqueio_id, m.pagar_ate, m.horario, m.hora_ini, m.hora_fim,
         m.jetski_min::int, m.jetski_cortesia::int, m.jetski_ini::text, m.preco_base, m.preco_cliente, m.pessoas
    from m order by m.eh desc, m.bloqueio_id
$$;
revoke all on function public.pedido_grupo(bigint) from public, anon, authenticated;
grant execute on function public.pedido_grupo(bigint) to service_role;

-- liga o passeio à conta do cliente: no grupo, cada lancha tem o próprio sinal (antes a principal levava a soma)
CREATE OR REPLACE FUNCTION public._ligar_passeio(bid bigint, uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b record; n record; nm text; adm boolean := public.e_admin(); pb numeric; sv numeric; tg numeric; pid bigint; cid bigint; tx text; ate timestamptz;
        princ bigint; nl int; m record; bc timestamptz;
begin
  select * into b from public.bloqueios where id = bid;
  select * into n from public.anotacoes where bloqueio_id = bid;
  select preco_base into pb from public.passeio_preco_base where bloqueio_id = bid;
  if not adm and n.cliente_conta is not null and n.cliente_conta <> uid then return; end if;
  select nullif(btrim(nome), '') into nm from public.clientes where user_id = uid;
  insert into public.anotacoes (bloqueio_id, cliente_conta, cliente) values (bid, uid, nm)
    on conflict (bloqueio_id) do update set cliente_conta = uid, cliente = coalesce(nm, anotacoes.cliente);
  if n.grupo is not null then
    select min(a.bloqueio_id), count(*) into princ, nl from public.anotacoes a where a.grupo = n.grupo;
  end if;
  if not exists (select 1 from public.pedidos where bloqueio_id = bid) then
    if n.origem = 'buzios' and n.valor > 0 and coalesce(n.sinal, 0) = 0 then
      -- o grupo inteiro vence junto, no prazo da reserva principal
      bc := null;
      if n.grupo is not null then select x.criado_em into bc from public.bloqueios x where x.id = princ; end if;
      ate := public._prazo_pre_fim(coalesce(bc, b.criado_em), b.data);
      sv := coalesce(nullif(n.sinal_combinado, 0), round(n.valor / 2));
      begin
        insert into public.pedidos (cliente, lancha, data, horario, pessoas, embarque, status, bloqueio_id, preco_base, preco_cliente,
                                    hora_ini, hora_fim, sinal_valor, sinal_liberado_em, pagar_ate)
          values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), n.embarque, 'pendente', bid,
                  coalesce(pb, n.valor), case when pb > 0 then n.valor end, n.hora_ini, n.hora_fim, sv, now(), ate)
          returning id into pid;
      exception when others then pid := null;
      end;
      -- a mensagem do chat sai uma vez só, na reserva principal, com o sinal de todas as lanchas
      if pid is not null and (n.grupo is null or bid = princ) then
        if n.grupo is not null then
          select sum(coalesce(nullif(a.sinal_combinado, 0), round(a.valor / 2))) into tg from public.anotacoes a
           where a.grupo = n.grupo and a.valor > 0 and coalesce(a.sinal, 0) = 0;
        end if;
        insert into conversas(tipo, cliente) values ('suporte', uid) on conflict (cliente) where tipo = 'suporte' do nothing;
        select id into cid from conversas where tipo = 'suporte' and cliente = uid;
        tx := format('Boa notícia: %s Para confirmar a sua reserva, pague o sinal de R$ %s pelo Pix (CNPJ 32.154.099/0001-72, Búzios Lanchas) e anexe o comprovante aqui no chat, no botão de anexo. A data fica guardada para você até %s; depois disso ela volta a ficar livre.',
                     case when n.grupo is not null then 'as ' || nl || ' lanchas do seu grupo estão disponíveis! O sinal abaixo vale para todas.' else 'a lancha está disponível!' end,
                     translate(to_char(coalesce(tg, sv), 'FM999,999,990.00'), ',.', '.,'), to_char(ate at time zone 'America/Sao_Paulo', 'HH24"h"MI "de" DD/MM'));
        insert into mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || coalesce(tg, sv)::text || ':' || (extract(epoch from ate) * 1000)::bigint, pid);
        update conversas set ultima_em = now(), ultima_msg = left(tx, 80), anexo_liberado = true, encerrada_em = null where id = cid;
      end if;
    else
      insert into public.pedidos (cliente, lancha, data, horario, pessoas, status, bloqueio_id, preco_base, preco_cliente)
        values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), 'aprovado', bid,
                pb, case when pb > 0 and n.valor > 0 then n.valor end);
    end if;
  else
    update public.pedidos set cliente = uid where bloqueio_id = bid and (adm or cliente is null or cliente = uid);
  end if;
  -- as outras lanchas do grupo entram na mesma conta
  if n.grupo is not null then
    for m in select a.bloqueio_id from public.anotacoes a where a.grupo = n.grupo and a.bloqueio_id <> bid and a.cliente_conta is null and a.origem = 'buzios' and n.origem = 'buzios' order by a.bloqueio_id loop
      perform public._ligar_passeio(m.bloqueio_id, uid);
      update public.convites set resgatado_em = now() where bloqueio_id = m.bloqueio_id and resgatado_em is null;
    end loop;
  end if;
end $function$;

-- aprovar à mão (administrador): no grupo, cada lancha com o próprio sinal
CREATE OR REPLACE FUNCTION public.aprovar_pre_pedido(pid bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.pedidos%rowtype; v numeric; g uuid; q record;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select * into p from public.pedidos where id = pid for update;
  if p.id is null or p.status <> 'pendente' or p.bloqueio_id is null then raise exception 'Pedido não está pendente'; end if;
  select grupo into g from public.anotacoes where bloqueio_id = p.bloqueio_id;
  for q in select x.id as pedido, x.bloqueio_id, x.sinal_valor from public.pedidos x join public.anotacoes a on a.bloqueio_id = x.bloqueio_id
            where x.status = 'pendente' and (x.id = pid or (g is not null and a.grupo = g)) order by x.bloqueio_id for update of x loop
    v := round(coalesce(q.sinal_valor, 0), 2);
    if not (v > 0) then raise exception 'Informe o sinal recebido (pedido %)', q.pedido; end if;
    update public.anotacoes set sinal = v, sinal_combinado = null,
           obs = nullif(btrim(regexp_replace(coalesce(obs, ''), '( · )?Sinal combinado R\$ [0-9.,]+, ainda não recebido', '')), '')
     where bloqueio_id = q.bloqueio_id;
    update public.pedidos set status = 'aprovado', atualizado_em = now() where id = q.pedido and status = 'pendente';
  end loop;
  return p.bloqueio_id;
end $function$;

-- adicionar uma lancha a uma pré-reserva ainda sem pagamento (Lucas pela ponte ou administrador).
-- Mesma data, horário e horas da pré-reserva; mesmo prazo; o link da principal passa a cobrar as duas.
create or replace function public.adicionar_lancha_pre_reserva(p_bid bigint, p_lancha text, p_pessoas int, p_valor numeric default null, p_obs text default null)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; g uuid; cid bigint; r jsonb; nb bigint; em text; lg text; n int;
        pr record; np bigint; nm text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  select * into b from public.bloqueios where id = p_bid for update;
  select * into a from public.anotacoes where bloqueio_id = p_bid for update;
  if b.id is null or a.bloqueio_id is null then raise exception 'Pré-reserva não encontrada'; end if;
  if a.origem is distinct from 'buzios' or not (a.valor > 0) or coalesce(a.sinal, 0) <> 0 or a.comprovante is not null then
    raise exception 'Só dá para adicionar lancha a uma pré-reserva sem sinal'; end if;
  if b.data < hoje then raise exception 'A data já passou'; end if;
  g := a.grupo;
  -- grupo começa pela reserva principal: o prazo é o dela
  if g is not null then select * into b from public.bloqueios where id = (select min(x.bloqueio_id) from public.anotacoes x where x.grupo = g); end if;
  if now() >= public._prazo_pre_fim(b.criado_em, b.data) then raise exception 'O prazo desta pré-reserva já acabou'; end if;
  if exists (select 1 from public.anotacoes x join public.pedidos p on p.bloqueio_id = x.bloqueio_id
              where (x.bloqueio_id = p_bid or (g is not null and x.grupo = g))
                and (p.status = 'aprovado' or p.comprovante_em is not null or coalesce(x.sinal, 0) <> 0 or x.comprovante is not null
                     or exists (select 1 from public.pagamentos_asaas q where q.pedido = p.id and q.pago_em is not null)
                     or exists (select 1 from public.pagamentos_pp q where q.pedido = p.id and (q.pago_em is not null or q.captura is not null)))) then
    raise exception 'Esta reserva já tem pagamento: lance a nova lancha separada'; end if;
  if exists (select 1 from public.pagamentos_asaas q join public.pedidos p on p.id = q.pedido join public.anotacoes x on x.bloqueio_id = p.bloqueio_id
              where (x.bloqueio_id = p_bid or (g is not null and x.grupo = g)) and q.metodo = 'cartao' and q.pago_em is null
                and q.status in ('CONFIRMED', 'RECEIVED')) then
    raise exception 'Pagamento em andamento: espere confirmar'; end if;
  if g is null then g := gen_random_uuid(); update public.anotacoes set grupo = g where bloqueio_id = p_bid; end if;
  select count(*) into n from public.anotacoes where grupo = g;
  if n >= 5 then raise exception 'O grupo já tem 5 lanchas'; end if;
  if exists (select 1 from public.anotacoes x join public.bloqueios y on y.id = x.bloqueio_id where x.grupo = g and y.lancha = p_lancha) then
    raise exception 'Essa lancha já está nesta reserva'; end if;
  select nullif(btrim(email), '') into em from public.convites where bloqueio_id = p_bid;
  if em is null and a.cliente_conta is not null then
    select u.email into em from auth.users u where u.id = a.cliente_conta and u.email !~* '@sem-email';
  end if;
  select coalesce(nullif(u.raw_user_meta_data->>'lang', ''), 'pt') into lg from auth.users u where u.id = a.cliente_conta;
  nm := coalesce(nullif(btrim(a.cliente), ''), (select nullif(btrim(c.nome), '') from public.clientes c where c.user_id = a.cliente_conta));
  if nm is null or position(' ' in nm) = 0 then nm := concat_ws(' ', nullif(nm, ''), 'Cliente'); end if;
  cid := public.lancar_pedido_operador(p_lancha, b.data, b.horario, p_pessoas, nm, a.telefone, em, coalesce(lg, 'pt'), a.embarque,
                                       p_valor, 0, a.hora_ini, a.hora_fim, p_obs);
  update public.consultas set grupo = g, manter_anterior = true,
         obs = concat_ws(' · ', '👥 Junto com a ' || coalesce((select l.nome from public.lanchas l where l.slug = b.lancha), b.lancha), nullif(obs, ''))
   where id = cid;
  perform set_config('app.auto_op', '1', true);
  r := public._aprovar_consulta(cid, false);
  perform set_config('app.auto_op', '', true);
  nb := (r->>'bid')::bigint;
  -- mesmo prazo do grupo, e o convite da principal já leva o cliente às duas (o robô não manda outro convite)
  update public.bloqueios set criado_em = b.criado_em where id = nb;
  update public.anotacoes set wa_convite_em = coalesce(wa_convite_em, now()), aviso_wa_em = coalesce(aviso_wa_em, now()) where bloqueio_id = nb;
  select p.id, p.paypal_link, p.pagar_ate into pr from public.pedidos p where p.status = 'pendente'
     and p.bloqueio_id = (select min(x.bloqueio_id) from public.anotacoes x where x.grupo = g);
  select id into np from public.pedidos where bloqueio_id = nb;
  -- as outras lanchas usam o link da principal: o robô não manda link separado
  update public.pedidos p set pagar_ate = coalesce(pr.pagar_ate, p.pagar_ate), paypal_link = coalesce(pr.paypal_link, p.paypal_link),
         wa_central_em = coalesce(p.wa_central_em, now()), atualizado_em = now()
   where p.status = 'pendente' and p.id is distinct from pr.id and p.bloqueio_id in (select x.bloqueio_id from public.anotacoes x where x.grupo = g);
  return jsonb_build_object('ok', true, 'grupo', g, 'bloqueio', nb, 'pedido', np, 'principal', pr.id, 'link', pr.paypal_link,
                            'convite', r->>'convite', 'data', b.data, 'horario', b.horario, 'hora_ini', a.hora_ini, 'hora_fim', a.hora_fim);
end $$;
revoke all on function public.adicionar_lancha_pre_reserva(bigint, text, int, numeric, text) from public, anon;
grant execute on function public.adicionar_lancha_pre_reserva(bigint, text, int, numeric, text) to authenticated, service_role;

-- pago: espelha a cobrança da principal em uma linha por pedido do grupo (cada uma com a sua parte, já paga).
-- Devolve os outros pedidos do grupo, para confirmar cada um. Só a chave de serviço.
create or replace function public.espelhar_pagamento_grupo(p_row bigint)
 returns bigint[] language plpgsql security definer set search_path to 'public' as $$
declare r public.pagamentos_asaas%rowtype; it jsonb; mid bigint; sai bigint[] := '{}'; resto numeric; meu jsonb;
begin
  select * into r from public.pagamentos_asaas where id = p_row for update;
  if r.id is null or r.pago_em is null or r.partes is null or jsonb_typeof(r.partes) <> 'array' or jsonb_array_length(r.partes) < 2 then return sai; end if;
  if exists (select 1 from public.pagamentos_asaas x where x.asaas_real = r.asaas_id) then
    return coalesce((select array_agg(x.pedido order by x.id) from public.pagamentos_asaas x where x.asaas_real = r.asaas_id), sai);
  end if;
  resto := r.valor;
  for it in select * from jsonb_array_elements(r.partes) loop
    mid := (it->>'pedido')::bigint;
    if mid = r.pedido then meu := it; continue; end if;
    insert into public.pagamentos_asaas (pedido, metodo, asaas_id, asaas_real, valor, sinal, repasse, wallet_id, status, pago_em, criado_em)
      values (mid, r.metodo, r.asaas_id || '#' || mid, r.asaas_id, round((it->>'valor')::numeric, 2), round((it->>'sinal')::numeric, 2),
              round(coalesce((it->>'repasse')::numeric, 0), 2), nullif(it->>'wallet_id', ''), r.status, r.pago_em, r.criado_em)
      on conflict (pedido, metodo) do nothing; -- a cobrança só é criada na principal; nunca deveria existir
    resto := resto - round((it->>'valor')::numeric, 2);
    sai := sai || mid;
  end loop;
  if meu is null then raise exception 'Cobrança de grupo sem a parte da principal'; end if;
  update public.pagamentos_asaas set valor = round(resto, 2), sinal = round((meu->>'sinal')::numeric, 2),
         repasse = round(coalesce((meu->>'repasse')::numeric, 0), 2), wallet_id = nullif(meu->>'wallet_id', '')
   where id = r.id;
  return sai;
end $$;
revoke all on function public.espelhar_pagamento_grupo(bigint) from public, anon, authenticated;
grant execute on function public.espelhar_pagamento_grupo(bigint) to service_role;

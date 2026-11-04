-- 2026-11-04 (Rodrigo): pedido de grupo com várias lanchas (ex.: 27 pessoas = Miss Bardot + Midas).
-- O Lucas lança tudo de uma vez; o Rodrigo aprova com um toque; as lanchas ficam presas juntas, com o mesmo prazo;
-- o cliente recebe um link só e paga UM sinal (a soma dos sinais) na reserva principal (a de menor id);
-- quando o Rodrigo aprova o pagamento, todas as lanchas do grupo ficam confirmadas, cada uma com a sua parte do sinal.

alter table public.consultas add column if not exists grupo uuid;
alter table public.anotacoes add column if not exists grupo uuid;
create index if not exists anotacoes_grupo_idx on public.anotacoes (grupo) where grupo is not null;

-- 1) Lucas lança o grupo: um item por lancha [{lancha, pessoas, valor}], cliente/data/horário iguais
create or replace function public.lancar_grupo_operador(p_itens jsonb, p_data date, p_horario text, p_nome text, p_tel text, p_email text, p_lang text,
  p_embarque text default null, p_sinal numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare g uuid := gen_random_uuid(); n int; it jsonb; i int := 0; ids bigint[] := '{}'; vs numeric[] := '{}'; tot numeric := 0; usado numeric := 0;
        s numeric; cid bigint; pes int := 0; v numeric;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  n := coalesce(jsonb_array_length(p_itens), 0);
  if n < 2 or n > 5 then raise exception 'O grupo precisa de 2 a 5 lanchas'; end if;
  if (select count(distinct x->>'lancha') from jsonb_array_elements(p_itens) x) <> n then raise exception 'Cada lancha só uma vez no grupo'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    v := coalesce(nullif(it->>'valor','')::numeric, public.preco_tabela(it->>'lancha', p_data, p_horario), 0);
    vs := vs || v; tot := tot + v; pes := pes + coalesce((it->>'pessoas')::int, 0);
  end loop;
  if p_sinal is not null and p_sinal > 0 and tot > 0 and p_sinal < ceil(tot * 0.1) then raise exception 'Sinal inválido: zero (pré-reserva) ou de 10%% até o valor'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    i := i + 1;
    -- sinal já recebido: dividido entre as lanchas pelo valor de cada uma (a última fica com o resto)
    s := case when p_sinal is null then null when p_sinal = 0 then 0
              when i = n then p_sinal - usado else round(p_sinal * vs[i] / nullif(tot, 0)) end;
    usado := usado + coalesce(s, 0);
    cid := public.lancar_pedido_operador(it->>'lancha', p_data, p_horario, (it->>'pessoas')::int, p_nome, p_tel, p_email, p_lang, p_embarque,
                                         nullif(it->>'valor','')::numeric, s, p_hora_ini, p_hora_fim, p_obs);
    ids := ids || cid;
  end loop;
  update public.consultas set grupo = g,
         obs = concat_ws(' · ', '👥 Grupo de ' || pes || ' pessoas em ' || n || ' lanchas', nullif(obs, ''))
   where id = any(ids);
  return jsonb_build_object('grupo', g, 'ids', to_jsonb(ids));
end $$;
revoke all on function public.lancar_grupo_operador(jsonb, date, text, text, text, text, text, text, numeric, text, text, text) from public, anon;
grant execute on function public.lancar_grupo_operador(jsonb, date, text, text, text, text, text, text, numeric, text, text, text) to authenticated;

-- 2) aprovação: o passeio guarda o grupo; dentro do aprovar_grupo o convite só sai depois que todas as lanchas existem
create or replace function public._aprovar_consulta(cid bigint, p_recebido boolean default false)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare c public.consultas%rowtype; bid bigint; v numeric; s numeric; sc numeric; res text; pid bigint; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into c from public.consultas where id = cid for update;
  if c.id is null then raise exception 'Consulta não encontrada'; end if;
  if c.data < hoje then raise exception 'A data já passou'; end if;
  if not public._horario_ok(c.horario, c.data) then raise exception 'Horário inválido'; end if;
  v := coalesce(c.valor, public.preco_tabela(c.lancha, c.data, c.horario));
  if not (v > 0) then raise exception 'Sem valor combinado nem preço de tabela: use o Aprovar normal e preencha o valor'; end if;
  s := coalesce(c.sinal, 0);
  if s < 0 or s > v then raise exception 'Sinal inválido'; end if;
  if c.pessoas is not null and c.pessoas > public._capacidade(c.lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(c.lancha); end if;
  if s > 0 and not coalesce(p_recebido, false) then
    c.obs := concat_ws(' · ', nullif(c.obs, ''), 'Sinal combinado R$ ' || s || ', ainda não recebido');
    sc := s;
    s := 0;
  end if;
  if exists (select 1 from public.bloqueios x where x.lancha = c.lancha and x.data = c.data and public.choca_horario(x.horario, c.horario)) then
    raise exception 'Esse horário já está ocupado na lancha %', c.lancha; end if;
  if exists (select 1 from public.manutencoes m where m.lancha = c.lancha and m.de <= c.data and c.data <= m.ate) then
    raise exception 'A lancha % está em manutenção nesse dia', c.lancha; end if;
  insert into public.bloqueios (lancha, data, horario, criado_por) values (c.lancha, c.data, c.horario, auth.uid()) returning id into bid;
  insert into public.anotacoes (bloqueio_id, origem, cliente, telefone, pessoas, valor, sinal, sinal_combinado, embarque, hora_ini, hora_fim, obs, grupo)
    values (bid, 'buzios', c.nome, c.telefone, c.pessoas, v, s, sc, c.embarque, c.hora_ini, c.hora_fim, c.obs, c.grupo);
  if c.vendedor is not null then
    insert into public.vendas_manuais (bloqueio_id, vendedor, comissao) values (bid, c.vendedor, round(coalesce(c.comissao_vend, 0), 2))
      on conflict (bloqueio_id) do nothing;
  end if;
  if current_setting('app.grupo_aprov', true) = '1' then res := null;
  else res := public.convidar_cliente(bid, c.email, c.nome, c.telefone); end if;
  select id into pid from public.pedidos where bloqueio_id = bid;
  delete from public.consultas where id = cid;
  return jsonb_build_object('bid', bid, 'convite', res, 'pendente', s = 0, 'email', c.email, 'valor', v, 'sinal', s, 'pedido', pid);
end $function$;

-- 3) Rodrigo aprova o grupo inteiro com um toque (tudo ou nada)
create or replace function public.aprovar_grupo(g uuid, p_recebido boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c record; r jsonb; bids bigint[] := '{}'; pend boolean := true; tot numeric := 0; sin numeric := 0;
        em text; nm text; tel text; res text; res1 text; b bigint; pid bigint;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select email, nome, telefone into em, nm, tel from public.consultas where grupo = g and recusada_em is null order by id limit 1;
  if nm is null then raise exception 'Grupo não encontrado'; end if;
  perform set_config('app.grupo_aprov', '1', true);
  for c in select id from public.consultas where grupo = g and recusada_em is null order by id for update loop
    r := public._aprovar_consulta(c.id, p_recebido);
    bids := bids || (r->>'bid')::bigint; pend := pend and (r->>'pendente')::boolean;
    tot := tot + (r->>'valor')::numeric; sin := sin + (r->>'sinal')::numeric;
  end loop;
  perform set_config('app.grupo_aprov', '0', true);
  foreach b in array bids loop
    res := public.convidar_cliente(b, em, nm, tel);
    if res1 is null then res1 := res; end if;
  end loop;
  select id into pid from public.pedidos where bloqueio_id = bids[1];
  return jsonb_build_object('bids', to_jsonb(bids), 'bid', bids[1], 'convite', res1, 'pendente', pend, 'email', em, 'valor', tot, 'sinal', sin, 'pedido', pid);
end $$;
revoke all on function public.aprovar_grupo(uuid, boolean) from public, anon;
grant execute on function public.aprovar_grupo(uuid, boolean) to authenticated;

-- 4) cliente cria a conta: liga todas as lanchas do grupo; o sinal todo vai na reserva principal
create or replace function public._ligar_passeio(bid bigint, uid uuid)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare b record; n record; nm text; adm boolean := public.e_admin(); pb numeric; sv numeric; pid bigint; cid bigint; tx text; ate timestamptz;
        princ bigint; nl int; m record;
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
    if n.origem = 'buzios' and n.valor > 0 and n.sinal is not null and n.sinal = 0 then
      ate := b.criado_em + public._prazo_pre(b.data);
      if n.grupo is not null and bid <> princ then
        -- outra lancha do grupo: o sinal é pago junto, na reserva principal
        begin
          insert into public.pedidos (cliente, lancha, data, horario, pessoas, embarque, status, bloqueio_id, preco_base, preco_cliente, hora_ini, hora_fim, pagar_ate)
            values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), n.embarque, 'pendente', bid,
                    coalesce(pb, n.valor), case when pb > 0 then n.valor end, n.hora_ini, n.hora_fim, ate);
        exception when others then null;
        end;
      else
        if n.grupo is not null then
          select sum(coalesce(nullif(a.sinal_combinado, 0), round(a.valor / 2))) into sv from public.anotacoes a
           where a.grupo = n.grupo and a.valor > 0 and coalesce(a.sinal, 0) = 0;
        else
          sv := coalesce(nullif(n.sinal_combinado, 0), round(n.valor / 2));
        end if;
        begin
          insert into public.pedidos (cliente, lancha, data, horario, pessoas, embarque, status, bloqueio_id, preco_base, preco_cliente,
                                      hora_ini, hora_fim, sinal_valor, sinal_liberado_em, pagar_ate)
            values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), n.embarque, 'pendente', bid,
                    coalesce(pb, n.valor), case when pb > 0 then n.valor end, n.hora_ini, n.hora_fim, sv, now(), ate)
            returning id into pid;
        exception when others then pid := null;
        end;
        if pid is not null then
          insert into conversas(tipo, cliente) values ('suporte', uid) on conflict (cliente) where tipo = 'suporte' do nothing;
          select id into cid from conversas where tipo = 'suporte' and cliente = uid;
          tx := format('Boa notícia: %s Para confirmar a sua reserva, pague o sinal de R$ %s pelo Pix (CNPJ 32.154.099/0001-72, Búzios Lanchas) e anexe o comprovante aqui no chat, no botão 📎. A data fica guardada para você até %s; depois disso ela volta a ficar livre.',
                       case when n.grupo is not null then 'as ' || nl || ' lanchas do seu grupo estão disponíveis! O sinal abaixo vale para todas.' else 'a lancha está disponível!' end,
                       translate(to_char(sv, 'FM999,999,990.00'), ',.', '.,'), to_char(ate at time zone 'America/Sao_Paulo', 'HH24"h"MI "de" DD/MM'));
          insert into mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || sv::text || ':' || (extract(epoch from ate) * 1000)::bigint, pid);
          update conversas set ultima_em = now(), ultima_msg = left(tx, 80), anexo_liberado = true, encerrada_em = null where id = cid;
        end if;
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
    for m in select a.bloqueio_id from public.anotacoes a where a.grupo = n.grupo and a.bloqueio_id <> bid and a.cliente_conta is null order by a.bloqueio_id loop
      perform public._ligar_passeio(m.bloqueio_id, uid);
      update public.convites set resgatado_em = now() where bloqueio_id = m.bloqueio_id and resgatado_em is null;
    end loop;
  end if;
end $function$;

-- 5) Rodrigo aprova o pagamento (em qualquer reserva do grupo): confirma todas, cada uma com a sua parte do sinal
create or replace function public.aprovar_pre_pedido(pid bigint)
 returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare p public.pedidos%rowtype; v numeric; g uuid; princ bigint; q record; parte numeric; soma numeric := 0; k int := 0; nk int;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select * into p from public.pedidos where id = pid for update;
  if p.id is null or p.status <> 'pendente' or p.bloqueio_id is null then raise exception 'Pedido não está pendente'; end if;
  select grupo into g from public.anotacoes where bloqueio_id = p.bloqueio_id;
  if g is null then
    v := round(coalesce(p.sinal_valor, 0), 2);
    if not (v > 0) then raise exception 'Informe o sinal recebido'; end if;
    update public.anotacoes set sinal = v, sinal_combinado = null,
           obs = nullif(btrim(regexp_replace(coalesce(obs, ''), '( · )?Sinal combinado R\$ [0-9.,]+, ainda não recebido', '')), '')
     where bloqueio_id = p.bloqueio_id;
    update public.pedidos set status = 'aprovado', atualizado_em = now() where id = pid and status = 'pendente';
    return p.bloqueio_id;
  end if;
  -- grupo: o sinal pago está na reserva principal
  select min(bloqueio_id) into princ from public.anotacoes where grupo = g;
  select round(coalesce(sinal_valor, 0), 2) into v from public.pedidos where bloqueio_id = princ and status = 'pendente';
  if not (v > 0) then raise exception 'Informe o sinal recebido na reserva principal do grupo'; end if;
  select count(*) into nk from public.anotacoes a join public.pedidos x on x.bloqueio_id = a.bloqueio_id and x.status = 'pendente' where a.grupo = g;
  for q in select a.bloqueio_id, a.valor, a.sinal_combinado, x.id as pedido from public.anotacoes a
             join public.pedidos x on x.bloqueio_id = a.bloqueio_id and x.status = 'pendente'
            where a.grupo = g order by (a.bloqueio_id = princ), a.bloqueio_id for update of x loop
    k := k + 1;
    parte := case when k = nk then v - soma else least(coalesce(nullif(q.sinal_combinado, 0), round(q.valor / 2)), v - soma) end;
    soma := soma + parte;
    update public.anotacoes set sinal = greatest(parte, 0.01), sinal_combinado = null,
           obs = nullif(btrim(regexp_replace(coalesce(obs, ''), '( · )?Sinal combinado R\$ [0-9.,]+, ainda não recebido', '')), '')
     where bloqueio_id = q.bloqueio_id;
    update public.pedidos set status = 'aprovado', atualizado_em = now() where id = q.pedido and status = 'pendente';
  end loop;
  return p.bloqueio_id;
end $function$;

-- 6) prazo: lancha do grupo não vence se o grupo já mandou comprovante ou pagou
create or replace function public.vencer_pre_pedidos()
 returns table(id bigint, cliente uuid, lancha text, data date, horario text)
 language plpgsql security definer set search_path to 'public' as $function$
declare r record; cid bigint;
begin
  for r in select p.id, p.cliente, p.lancha, p.data, p.horario from public.pedidos p
             join public.bloqueios b on b.id = p.bloqueio_id join public.anotacoes a on a.bloqueio_id = b.id
            where p.status = 'pendente' and a.valor > 0 and coalesce(a.sinal, 0) = 0
              and b.criado_em < now() - public._prazo_pre(b.data) and p.comprovante_em is null
              and not exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))
              and not exists (select 1 from public.pagamentos_asaas x where x.pedido = p.id)
              and not (a.grupo is not null and exists (select 1 from public.anotacoes a2 join public.pedidos p2 on p2.bloqueio_id = a2.bloqueio_id
                        where a2.grupo = a.grupo and p2.status = 'pendente' and (p2.comprovante_em is not null or a2.comprovante_em is not null
                          or exists (select 1 from public.pagamentos_pp g2 where g2.pedido = p2.id and (g2.pago_em is not null or g2.captura is not null))
                          or exists (select 1 from public.pagamentos_asaas x2 where x2.pedido = p2.id))))
            for update of p loop
    if (select x.status from public.pedidos x where x.id = r.id) <> 'pendente' then continue; end if; -- já saiu junto com o grupo
    update public.pedidos set status = 'cancelado', motivo = 'sinal', bloqueio_id = null, atualizado_em = now() where pedidos.id = r.id;
    select c.id into cid from public.conversas c where c.tipo = 'suporte' and c.cliente = r.cliente;
    if cid is not null then
      insert into public.mensagens(conversa, autor, texto, sistema, pedido)
        values (cid, null, 'O prazo para pagar o sinal acabou e a data foi liberada. Se ainda quiser o passeio, fale com a gente aqui no chat.', 'venceu:0', r.id);
      update public.conversas set ultima_em = now(), ultima_msg = 'O prazo para pagar o sinal acabou e a data foi liberada.', encerrada_em = null where conversas.id = cid;
    end if;
    id := r.id; cliente := r.cliente; lancha := r.lancha; data := r.data; horario := r.horario; return next;
  end loop;
end $function$;

-- 7) comprovante anexado pelo Lucas vale para todas as lanchas do grupo (nenhuma é apagada no prazo)
create or replace function public.anexar_comprovante_passeio(p_bid bigint, p_caminho text)
 returns text language plpgsql security definer set search_path to 'public' as $function$
declare a record; b record;
begin
  if not (public.e_admin() or public.papel_painel() = 'operador') then raise exception 'sem acesso'; end if;
  if p_caminho is null or p_caminho !~ ('^passeio/' || p_bid || '-[0-9]+\.(jpg|png|webp|heic|heif|gif|pdf)$') then raise exception 'arquivo inválido'; end if;
  select * into b from public.bloqueios where id = p_bid;
  if not found then raise exception 'passeio não encontrado'; end if;
  select * into a from public.anotacoes where bloqueio_id = p_bid;
  if not found or a.origem is distinct from 'buzios' then raise exception 'só passeio da Búzios Lanchas'; end if;
  if b.data < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'passeio já passou'; end if;
  update public.anotacoes set comprovante = p_caminho, comprovante_em = now(), comprovante_por = auth.uid()
   where bloqueio_id = p_bid or (a.grupo is not null and grupo = a.grupo);
  update public.pedidos set comprovante = p_caminho, comprovante_em = now(), atualizado_em = now()
   where status = 'pendente' and (bloqueio_id = p_bid or (a.grupo is not null and bloqueio_id in (select bloqueio_id from public.anotacoes where grupo = a.grupo)));
  return 'ok';
end $function$;

-- 8) reserva do grupo recusada ou cancelada: as outras lanchas do grupo saem junto
create or replace function public._pre_pedido_fim()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare g uuid;
begin
  if old.status = 'pendente' and new.status in ('recusado', 'cancelado') and old.bloqueio_id is not null then
    select grupo into g from public.anotacoes where bloqueio_id = old.bloqueio_id;
    if new.bloqueio_id is not null
       and exists (select 1 from public.anotacoes a where a.bloqueio_id = new.bloqueio_id and a.valor > 0 and coalesce(a.sinal, 0) = 0) then
      delete from public.bloqueios where id = new.bloqueio_id;
    end if;
    if g is not null then
      update public.pedidos set status = new.status, motivo = new.motivo, atualizado_em = now()
       where id <> new.id and status = 'pendente' and bloqueio_id in (select bloqueio_id from public.anotacoes where grupo = g);
    end if;
  end if;
  return new;
end $function$;

select 'ok' as pedido_de_grupo;

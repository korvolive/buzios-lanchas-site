-- publicar: auto
-- Búzios Lanchas (Rodrigo 2026-11-24, cliente Heber, Gratidão): o pedido que o cliente faz sozinho no site, numa lancha
-- sem "Reserva automática", também vai para o dono aprovar (WhatsApp /aprovar/ + app), igual ao pedido lançado pelo Lucas.
-- Antes só a consulta lançada pela equipe ia ao dono; o pedido do site ficava parado esperando o administrador liberar o sinal.
--  - aprovacoes_dono ganha pedido_id (consulta_id pode ficar vazio).
--  - Dono aprova: o sinal (50% do valor da data) é liberado no próprio pedido, com a mesma mensagem da Miss Bardot
--    (botão "Pagar o sinal"); aparece no painel como pedido com sinal liberado.
--  - Dono recusa: o pedido vira "Não fechado" (motivo ocupado, igual quando outra reserva ocupa a data) e o cliente é avisado.
-- Idempotente.

alter table public.aprovacoes_dono add column if not exists pedido_id bigint references public.pedidos(id) on delete cascade;
alter table public.aprovacoes_dono alter column consulta_id drop not null;
create unique index if not exists aprovacoes_dono_pedido_dono_key on public.aprovacoes_dono (pedido_id, dono) where pedido_id is not null;

-- ---------- ver ----------
create or replace function public.dono_aprovacao_ver(tok uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare a public.aprovacoes_dono%rowtype; c public.consultas%rowtype; p public.pedidos%rowtype; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        est text; nm text; neto numeric; tot numeric; sin numeric; emb numeric; ant numeric; cli text;
begin
  select * into a from public.aprovacoes_dono where token = tok;
  if a.id is null then return jsonb_build_object('estado', 'invalido'); end if;
  select nome into nm from public.lanchas where slug = a.lancha;
  -- pedido feito pelo cliente no site (sem consulta)
  if a.consulta_id is null and a.pedido_id is not null then
    select * into p from public.pedidos where id = a.pedido_id;
    if p.id is null then est := 'resolvida';
    elsif p.status in ('recusado', 'cancelado') then est := 'recusada';
    elsif p.status = 'aprovado' or p.sinal_liberado_em is not null or p.bloqueio_id is not null then est := 'aprovada';
    elsif p.data < hoje then est := 'vencida';
    else est := 'pendente';
    end if;
    if p.id is not null then
      select nome into cli from public.clientes where user_id = p.cliente;
      begin neto := public.preco_neto_tabela(p.lancha, p.data, p.horario); exception when others then neto := null; end;
      tot := nullif(coalesce(p.preco_cliente, p.preco_base), 0);
      if tot is null then begin tot := public._valor_na_data(p.lancha, p.data, p.horario, false); exception when others then tot := null; end; end if;
      if tot > 0 and neto > 0 then
        sin := coalesce(nullif(p.sinal_valor, 0), round(tot / 2));
        emb := greatest(tot - sin, 0);
        ant := neto - emb;
      end if;
    end if;
    return jsonb_build_object('estado', est, 'resposta', a.resposta, 'lancha', coalesce(nm, a.lancha), 'data', a.data, 'horario', a.horario,
      'hora_ini', p.hora_ini, 'hora_fim', p.hora_fim, 'pessoas', p.pessoas, 'cliente', nullif(split_part(coalesce(cli, ''), ' ', 1), ''),
      'neto', neto, 'antecipado', ant, 'embarque', emb, 'pedido', a.pedido_id)
      || case when est = 'pendente' then jsonb_build_object(
           'segura_h', round(extract(epoch from public._prazo_pre(p.data)) / 3600.0, 1),
           'segura_ate', public._prazo_pre_fim(now(), p.data)) else '{}'::jsonb end;
  end if;
  select * into c from public.consultas where id = a.consulta_id;
  if c.id is null then
    est := case when exists (select 1 from public.bloqueios b join public.anotacoes n on n.bloqueio_id = b.id
                              where b.lancha = a.lancha and b.data = a.data and public.choca_horario(b.horario, a.horario)
                                and right(regexp_replace(coalesce(n.telefone, ''), '\D', '', 'g'), 8) = a.tel_fim)
                then 'aprovada' else 'resolvida' end;
  elsif c.recusada_em is not null then est := 'recusada';
  elsif c.data < hoje then est := 'vencida';
  else est := 'pendente';
  end if;
  if c.id is not null then
    neto := c.neto_garantido;
    if neto is null then begin neto := public.preco_neto_tabela(c.lancha, c.data, c.horario); exception when others then neto := null; end; end if;
    tot := c.valor;
    if tot is null then begin tot := public.preco_tabela(c.lancha, c.data, c.horario); exception when others then tot := null; end; end if;
    if tot > 0 and neto > 0 then
      sin := coalesce(nullif(c.sinal, 0), round(tot / 2));
      emb := greatest(tot - sin, 0);
      ant := neto - emb;
    end if;
  end if;
  return jsonb_build_object('estado', est, 'resposta', a.resposta, 'lancha', coalesce(nm, a.lancha), 'data', a.data, 'horario', a.horario,
    'hora_ini', c.hora_ini, 'hora_fim', c.hora_fim, 'pessoas', c.pessoas, 'cliente', nullif(split_part(coalesce(c.nome, ''), ' ', 1), ''),
    'neto', neto, 'antecipado', ant, 'embarque', emb)
    || case when est = 'pendente' then jsonb_build_object(
         'segura_h', round(extract(epoch from public._prazo_pre(c.data)) / 3600.0, 1),
         'segura_ate', public._prazo_pre_fim(now(), c.data)) else '{}'::jsonb end;
end $function$;

-- ---------- aprovar ----------
create or replace function public.dono_aprovar(tok uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare a public.aprovacoes_dono%rowtype; c public.consultas%rowtype; p public.pedidos%rowtype; r jsonb;
        v numeric; vt numeric; cid bigint; tx text; cli text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into a from public.aprovacoes_dono where token = tok for update;
  if a.id is null then return jsonb_build_object('estado', 'invalido'); end if;
  if not exists (select 1 from public.donos d where d.user_id = a.dono and d.lancha = a.lancha) then return jsonb_build_object('estado', 'invalido'); end if;
  -- pedido do site: libera o sinal no próprio pedido (mesmo caminho da Miss Bardot, que libera sozinha)
  if a.consulta_id is null and a.pedido_id is not null then
    select * into p from public.pedidos where id = a.pedido_id for update;
    if p.id is null or p.status <> 'pendente' or p.sinal_liberado_em is not null or p.bloqueio_id is not null or p.data < hoje then
      return public.dono_aprovacao_ver(tok);
    end if;
    v := nullif(coalesce(p.preco_cliente, p.preco_base), 0);
    if v is null then v := public._valor_na_data(p.lancha, p.data, p.horario, false); end if;
    v := round(coalesce(v, 0) / 2, 2);
    if not (v > 0) then return jsonb_build_object('estado', 'erro', 'msg', 'sem valor na data'); end if;
    vt := v + coalesce(p.jetski_valor, 0);
    update public.pedidos set sinal_valor = v, sinal_liberado_em = now(), atualizado_em = now() where id = p.id;
    insert into public.conversas(tipo, cliente) values ('suporte', p.cliente) on conflict (cliente) where tipo = 'suporte' do nothing;
    select id into cid from public.conversas where tipo = 'suporte' and cliente = p.cliente;
    tx := format('Boa notícia: a lancha está disponível! Para confirmar a sua reserva, pague %s de R$ %s no botão "Pagar o sinal" (Pix ou cartão). Assim que o pagamento cair, a reserva se confirma automaticamente.',
                 case when coalesce(p.jetski_valor, 0) > 0 then 'o sinal da lancha com o jetski' else 'o sinal' end,
                 translate(to_char(vt, 'FM999,999,990.00'), ',.', '.,'));
    insert into public.mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || vt::text, p.id);
    update public.mensagens set texto = split_part(texto, ' Agora vamos conferir', 1) where pedido = p.id and sistema like 'pedido:%';
    update public.conversas set ultima_em = now(), ultima_msg = left(tx, 80), anexo_liberado = true, encerrada_em = null where id = cid;
    update public.aprovacoes_dono set resposta = 'aprovou', respondido_em = now() where id = a.id;
    select nome into cli from public.clientes where user_id = p.cliente;
    return jsonb_build_object('estado', 'aprovou', 'pedido', p.id, 'lancha', p.lancha, 'data', p.data, 'horario', p.horario,
      'hora_ini', p.hora_ini, 'hora_fim', p.hora_fim, 'cliente', cli, 'vendedor', p.vendedor, 'sinal', vt);
  end if;
  select * into c from public.consultas where id = a.consulta_id for update;
  if c.id is null or c.recusada_em is not null or c.data < hoje then
    return public.dono_aprovacao_ver(tok);
  end if;
  begin
    perform set_config('app.auto_op', '1', true);
    r := public._aprovar_consulta(c.id, false);
    perform set_config('app.auto_op', '', true);
  exception when others then
    return jsonb_build_object('estado', 'erro', 'msg', sqlerrm);
  end;
  -- igual à reserva automática: a pré-reserva fica no nome de quem lançou (Lucas ou vendedor)
  update public.bloqueios set criado_por = c.criado_por where id = (r->>'bid')::bigint and criado_por is null;
  update public.aprovacoes_dono set resposta = 'aprovou', respondido_em = now() where id = a.id;
  return r || jsonb_build_object('estado', 'aprovou', 'consulta', c.id, 'lancha', c.lancha, 'data', c.data, 'horario', c.horario,
    'cliente', c.nome, 'criado_por', c.criado_por, 'vendedor', c.vendedor);
end $function$;

-- ---------- recusar ----------
create or replace function public.dono_recusar(tok uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare a public.aprovacoes_dono%rowtype; c public.consultas%rowtype; p public.pedidos%rowtype; cl public.clientes%rowtype;
        hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into a from public.aprovacoes_dono where token = tok for update;
  if a.id is null then return jsonb_build_object('estado', 'invalido'); end if;
  if not exists (select 1 from public.donos d where d.user_id = a.dono and d.lancha = a.lancha) then return jsonb_build_object('estado', 'invalido'); end if;
  if a.consulta_id is null and a.pedido_id is not null then
    select * into p from public.pedidos where id = a.pedido_id for update;
    if p.id is null or p.status <> 'pendente' or p.sinal_liberado_em is not null or p.bloqueio_id is not null or p.data < hoje then
      return public.dono_aprovacao_ver(tok);
    end if;
    update public.pedidos set status = 'recusado', motivo = 'ocupado', atualizado_em = now() where id = p.id;
    update public.aprovacoes_dono set resposta = 'recusou', respondido_em = now() where id = a.id;
    select * into cl from public.clientes where user_id = p.cliente;
    return jsonb_build_object('estado', 'recusou', 'pedido', p.id, 'lancha', p.lancha, 'data', p.data, 'horario', p.horario,
      'hora_ini', p.hora_ini, 'hora_fim', p.hora_fim, 'pessoas', p.pessoas, 'nome', cl.nome, 'telefone', cl.whatsapp, 'lang', null,
      'pais', cl.pais, 'vendedor', p.vendedor,
      'opcoes', public.alternativas_livres(p.lancha, p.data, p.horario, p.pessoas, p.hora_ini, p.hora_fim, 2));
  end if;
  select * into c from public.consultas where id = a.consulta_id for update;
  if c.id is null or c.recusada_em is not null or c.data < hoje then
    return public.dono_aprovacao_ver(tok);
  end if;
  update public.consultas set recusada_em = now(), recusa_auto = false, recusa_dono = true where id = c.id;
  update public.aprovacoes_dono set resposta = 'recusou', respondido_em = now() where id = a.id;
  return jsonb_build_object('estado', 'recusou', 'consulta', c.id, 'lancha', c.lancha, 'data', c.data, 'horario', c.horario,
    'hora_ini', c.hora_ini, 'hora_fim', c.hora_fim, 'pessoas', c.pessoas, 'nome', c.nome, 'telefone', c.telefone, 'lang', c.lang,
    'pais', c.pais, 'vendedor', c.vendedor, 'criado_por', c.criado_por,
    'opcoes', public.alternativas_livres(c.lancha, c.data, c.horario, c.pessoas, c.hora_ini, c.hora_fim, 2));
end $function$;

revoke all on function public.dono_aprovacao_ver(uuid) from public, anon, authenticated;
revoke all on function public.dono_aprovar(uuid) from public, anon, authenticated;
revoke all on function public.dono_recusar(uuid) from public, anon, authenticated;
grant execute on function public.dono_aprovacao_ver(uuid) to service_role;
grant execute on function public.dono_aprovar(uuid) to service_role;
grant execute on function public.dono_recusar(uuid) to service_role;

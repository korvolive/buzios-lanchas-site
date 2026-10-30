-- Estado atual no Supabase (conferido no banco em 2026-10-30) de:
--   registro de envios do WhatsApp, meia diária condicional e vendedor no passeio lançado pelo administrador.
-- Rodado no SQL Editor pelos arquivos de 05-Site (registro-envios-whatsapp, meia-diaria-condicional,
-- meia-diaria-condicional-ajustes, vendedor-no-passeio). Aqui está a versão final de cada função.
-- Pode rodar de novo sem estragar nada (tudo é "if not exists" / "create or replace").
--
-- Segurança:
--   resolver_condicionais: só o robô (pg_cron, como postgres) e definir_condicional chamam; anon e authenticated não executam.
--   definir_condicional, venda_manual_salvar, venda_manual_paga, vendas_manuais_lista: checam e_admin() dentro da função.
--   marcar_wa: igual ao arquivo 2026-10-30_papeis-operador-auditor.sql: pedidos/consultas/cadastros/condicional = admin ou operador;
--     avisos do passeio (cobranca, convite, aviso, embarque) = admin, operador ou dono da lancha. O auditor nunca grava.
--     Usa papel_painel(), criada no arquivo de papéis (rode aquele antes, se for montar o banco do zero).
--   vendas_manuais: RLS ligado e sem grants; só as funções acima leem e escrevem (dono nunca vê comissão).

-- 1) colunas
alter table public.pedidos
  add column if not exists wa_pix_em timestamptz,
  add column if not exists wa_central_em timestamptz,
  add column if not exists wa_aprovado_cliente_em timestamptz,
  add column if not exists wa_aprovado_dono_em timestamptz;
alter table public.consultas add column if not exists wa_resposta_em timestamptz;
alter table public.vendedor_leads add column if not exists wa_lead_em timestamptz;
alter table public.anotacoes
  add column if not exists wa_cobranca_em timestamptz,
  add column if not exists wa_convite_em timestamptz,
  add column if not exists wa_aviso_em timestamptz,
  add column if not exists wa_embarque_em timestamptz,
  add column if not exists cond_ate timestamptz,        -- prazo: 20h da véspera, America/Sao_Paulo
  add column if not exists cond_horario text,           -- para onde volta (dia)
  add column if not exists cond_valor numeric,          -- valor da diária
  add column if not exists cond_resultado text,         -- 'confirmada' | 'voltou' | 'conflito' | 'erro'
  add column if not exists cond_em timestamptz,
  add column if not exists wa_cond_em timestamptz,      -- aviso do resultado
  add column if not exists wa_cond_ini_em timestamptz;  -- aviso de que ficou condicional
grant select (wa_pix_em, wa_central_em, wa_aprovado_cliente_em, wa_aprovado_dono_em) on public.pedidos to authenticated;
grant select (wa_resposta_em) on public.consultas to authenticated;
grant select (wa_lead_em) on public.vendedor_leads to authenticated;
grant select (wa_cobranca_em, wa_convite_em, wa_aviso_em, wa_embarque_em, cond_ate, cond_horario, cond_valor, cond_resultado, cond_em, wa_cond_em, wa_cond_ini_em) on public.anotacoes to authenticated;

-- 2) vendedor no passeio lançado pelo administrador
create table if not exists public.vendas_manuais (
  bloqueio_id bigint primary key references public.bloqueios(id) on delete cascade,
  vendedor uuid not null references auth.users(id) on delete cascade,
  comissao numeric not null check (comissao >= 0 and comissao <= 100000),
  paga timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.vendas_manuais enable row level security;
revoke all on public.vendas_manuais from anon, authenticated;

-- 3) funções
create or replace function public.marcar_wa(tipo text, rid bigint)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare agora timestamptz := now(); lch text; atend boolean := public.e_admin() or coalesce(public.papel_painel() = 'operador', false);
begin
  if tipo in ('pix','central','aprovado_cliente','aprovado_dono','consulta','lead') then
    if not atend then raise exception 'Sem acesso'; end if;
    if tipo = 'pix' then update public.pedidos set wa_pix_em = agora where id = rid;
    elsif tipo = 'central' then update public.pedidos set wa_central_em = agora where id = rid;
    elsif tipo = 'aprovado_cliente' then update public.pedidos set wa_aprovado_cliente_em = agora where id = rid;
    elsif tipo = 'aprovado_dono' then update public.pedidos set wa_aprovado_dono_em = agora where id = rid;
    elsif tipo = 'consulta' then update public.consultas set wa_resposta_em = agora where id = rid;
    else update public.vendedor_leads set wa_lead_em = agora where id = rid;
    end if;
  elsif tipo in ('condicional','cond_inicio') then
    if not atend then raise exception 'Sem acesso'; end if;
    if tipo = 'condicional' then update public.anotacoes set wa_cond_em = agora where bloqueio_id = rid;
    else update public.anotacoes set wa_cond_ini_em = agora where bloqueio_id = rid;
    end if;
  elsif tipo = 'alteracao' then
    -- aviso de reserva alterada (rid = id da alteração)
    if not atend then raise exception 'Sem acesso'; end if;
    update public.alteracoes_pedidas set wa_em = agora where id = rid;
  elsif tipo in ('cobranca','convite','aviso','embarque') then
    -- avisos do passeio: administrador, operador ou dono da lancha
    select lancha into lch from public.bloqueios where id = rid;
    if lch is null then raise exception 'Passeio não encontrado'; end if;
    if not atend and not exists (select 1 from public.donos d where d.lancha = lch and d.user_id = auth.uid()) then
      raise exception 'Sem acesso';
    end if;
    if tipo = 'cobranca' then update public.anotacoes set wa_cobranca_em = agora where bloqueio_id = rid;
    elsif tipo = 'convite' then update public.anotacoes set wa_convite_em = agora where bloqueio_id = rid;
    elsif tipo = 'aviso' then update public.anotacoes set wa_aviso_em = agora where bloqueio_id = rid;
    else update public.anotacoes set wa_embarque_em = agora where bloqueio_id = rid;
    end if;
  else
    raise exception 'Tipo inválido';
  end if;
  return agora;
end $$;
create or replace function public.definir_condicional(bid bigint, valor_dia numeric)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare b record; ate timestamptz;
begin
  if not public.e_admin() then raise exception 'Sem acesso'; end if;
  select * into b from public.bloqueios where id = bid;
  if b is null then raise exception 'Passeio não encontrado'; end if;
  if valor_dia is null then
    update public.anotacoes set cond_ate = null, cond_horario = null, cond_valor = null, cond_resultado = null, cond_em = null, wa_cond_em = null, wa_cond_ini_em = null where bloqueio_id = bid;
    return null;
  end if;
  if b.horario not in ('manha','tarde') then raise exception 'Só para passeio de manhã ou tarde'; end if;
  if not (valor_dia > 0) then raise exception 'Valor inválido'; end if;
  ate := ((b.data - 1) + time '20:00') at time zone 'America/Sao_Paulo';  -- 20h da véspera, horário de Brasília
  update public.anotacoes set cond_ate = ate, cond_horario = 'dia', cond_valor = valor_dia, cond_resultado = null, cond_em = null, wa_cond_em = null, wa_cond_ini_em = null where bloqueio_id = bid;
  perform public.resolver_condicionais();
  return ate;
end $$;

create or replace function public.resolver_condicionais()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare r record; outro text; vendido boolean; ocupado boolean; antes text := current_setting('request.jwt.claims', true);
begin
  for r in
    select a.bloqueio_id, a.cond_horario, a.cond_valor, a.cond_ate, b.lancha, b.data, b.horario
      from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
     where a.cond_ate is not null and a.cond_resultado is null
     for update of a skip locked
  loop
    if r.horario not in ('manha','tarde') then
      update public.anotacoes set cond_resultado = 'erro', cond_em = now() where bloqueio_id = r.bloqueio_id;
      continue;
    end if;
    outro := case r.horario when 'manha' then 'tarde' else 'manha' end;
    -- vendida: outra metade com sinal pago, bloqueada pelo dono sem dados, ou passeio de fora sem valor (não é pré-reserva)
    select exists (
      select 1 from public.bloqueios x left join public.anotacoes ax on ax.bloqueio_id = x.id
       where x.lancha = r.lancha and x.data = r.data and x.horario = outro and x.id <> r.bloqueio_id and x.revenda is null
         and (ax.bloqueio_id is null or coalesce(ax.sinal,0) > 0 or (ax.origem = 'fora' and coalesce(ax.valor,0) = 0))
    ) into vendido;
    if vendido then
      update public.anotacoes set cond_resultado = 'confirmada', cond_em = now() where bloqueio_id = r.bloqueio_id;
    elsif now() >= r.cond_ate then
      -- outra metade presa por pré-reserva ou pedido pendente: não dá para voltar para a diária sozinho
      select exists (
        select 1 from public.bloqueios x where x.lancha = r.lancha and x.data = r.data and x.horario in (outro,'dia') and x.id <> r.bloqueio_id and x.revenda is null
      ) or exists (
        select 1 from public.pedidos p where p.lancha = r.lancha and p.data = r.data and p.horario in (outro,'dia') and p.status = 'pendente'
          and (p.bloqueio_id is null or p.bloqueio_id <> r.bloqueio_id)
      ) into ocupado;
      if ocupado then
        update public.anotacoes set cond_resultado = 'conflito', cond_em = now() where bloqueio_id = r.bloqueio_id;
        continue;
      end if;
      begin
        -- o robô não é administrador: sem isto a trava de valor dos passeios da Búzios desfaria a volta para a diária
        perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
        update public.bloqueios set horario = r.cond_horario where id = r.bloqueio_id;
        -- o sinal não muda; só horário e valor
        update public.anotacoes set valor = r.cond_valor, hora_ini = null, hora_fim = null, cond_resultado = 'voltou', cond_em = now() where bloqueio_id = r.bloqueio_id;
        update public.pedidos set horario = r.cond_horario, hora_ini = null, hora_fim = null where bloqueio_id = r.bloqueio_id;
        perform set_config('request.jwt.claims', coalesce(antes,'{}'), true);
      exception when others then
        perform set_config('request.jwt.claims', coalesce(antes,'{}'), true);
        update public.anotacoes set cond_resultado = 'erro', cond_em = now() where bloqueio_id = r.bloqueio_id;
      end;
    end if;
  end loop;
end $$;

create or replace function public.venda_manual_salvar(bid bigint, cod text, comissao numeric, paga boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v uuid;
begin
  if not public.e_admin() then raise exception 'Sem acesso'; end if;
  if nullif(btrim(coalesce(cod, '')), '') is null then
    delete from public.vendas_manuais where bloqueio_id = bid;
    return;
  end if;
  if not exists (select 1 from public.bloqueios where id = bid) then raise exception 'Passeio não encontrado'; end if;
  if exists (select 1 from public.pedidos where bloqueio_id = bid and vendedor is not null) then
    raise exception 'via_pedido' using errcode = 'P0001';
  end if;
  select user_id into v from public.vendedores where codigo = upper(btrim(cod)) and ativo;
  if v is null then raise exception 'vendedor' using errcode = 'P0001'; end if;
  if comissao is null or comissao < 0 or comissao > 100000 then raise exception 'comissao' using errcode = 'P0001'; end if;
  insert into public.vendas_manuais (bloqueio_id, vendedor, comissao, paga)
    values (bid, v, round(comissao, 2), case when paga then now() end)
    on conflict (bloqueio_id) do update set vendedor = excluded.vendedor, comissao = excluded.comissao,
      paga = case when venda_manual_salvar.paga then coalesce(vendas_manuais.paga, now()) end;
end $$;

create or replace function public.venda_manual_paga(bid bigint, sim boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.e_admin() then raise exception 'Sem acesso'; end if;
  update public.vendas_manuais set paga = case when sim then coalesce(paga, now()) end where bloqueio_id = bid;
end $$;

create or replace function public.vendas_manuais_lista()
returns table(bloqueio_id bigint, lancha text, data date, horario text, vendedor uuid, codigo text, comissao numeric, paga timestamptz, cliente text)
language sql
stable security definer
set search_path to 'public'
as $$
  select m.bloqueio_id, b.lancha, b.data, b.horario, m.vendedor, v.codigo, m.comissao, m.paga, a.cliente
    from public.vendas_manuais m join public.bloqueios b on b.id = m.bloqueio_id
    left join public.vendedores v on v.user_id = m.vendedor
    left join public.anotacoes a on a.bloqueio_id = m.bloqueio_id
   where public.e_admin()
     and not exists (select 1 from public.pedidos p where p.bloqueio_id = m.bloqueio_id and p.vendedor is not null)
   order by b.data;
$$;

create or replace function public.minhas_vendas_v2()
returns table(id bigint, lancha text, data date, horario text, pessoas integer, status text, preco_base numeric, preco_cliente numeric, comissao numeric, comissao_paga timestamptz, cliente text, criado_em timestamptz, cliente_id uuid, cliente_nome text, cliente_whatsapp text, embarque text, hora_ini text, hora_fim text)
language sql
stable security definer
set search_path to 'public'
as $$
  -- vendas do vendedor com lancha, horário, embarque e cliente (Rodrigo 2026-10-22); nunca valores do dono ou da Búzios Lanchas
  select * from (
    select p.id, p.lancha, p.data, p.horario, p.pessoas, p.status, p.preco_base + x.parte, p.preco_cliente,
      greatest(coalesce(p.preco_cliente, 0) - coalesce(p.preco_base, 0), 0) - x.parte, p.comissao_paga, split_part(c.nome, ' ', 1), p.criado_em,
      p.cliente, c.nome, c.whatsapp, coalesce(nullif(a.embarque, ''), p.embarque), a.hora_ini, a.hora_fim
    from pedidos p left join clientes c on c.user_id = p.cliente left join anotacoes a on a.bloqueio_id = p.bloqueio_id
      left join vendedores v on v.user_id = p.vendedor
      cross join lateral (select case when v.indicado_por is not null
        then round(greatest(coalesce(p.preco_cliente, 0) - coalesce(p.preco_base, 0), 0) * v.indicacao_pct / 100, 2) else 0 end as parte) x
    where p.vendedor = auth.uid()
    union all
    select -b.id, b.lancha, b.data, b.horario, a.pessoas, 'aprovado', a.valor - m.comissao, a.valor,
      m.comissao, m.paga, split_part(a.cliente, ' ', 1), m.criado_em,
      a.cliente_conta, a.cliente, a.telefone, nullif(a.embarque, ''), a.hora_ini, a.hora_fim
    from vendas_manuais m join bloqueios b on b.id = m.bloqueio_id left join anotacoes a on a.bloqueio_id = m.bloqueio_id
    where m.vendedor = auth.uid()
      and not exists (select 1 from pedidos p where p.bloqueio_id = m.bloqueio_id and p.vendedor is not null)
  ) t order by t.data desc limit 300;
$$;

-- 4) quem pode executar
revoke all on function public.marcar_wa(text, bigint) from public, anon;
grant execute on function public.marcar_wa(text, bigint) to authenticated;
revoke all on function public.definir_condicional(bigint, numeric) from public, anon;
grant execute on function public.definir_condicional(bigint, numeric) to authenticated;
revoke all on function public.resolver_condicionais() from public, anon, authenticated;
revoke all on function public.venda_manual_salvar(bigint, text, numeric, boolean) from public, anon;
grant execute on function public.venda_manual_salvar(bigint, text, numeric, boolean) to authenticated;
revoke all on function public.venda_manual_paga(bigint, boolean) from public, anon;
grant execute on function public.venda_manual_paga(bigint, boolean) to authenticated;
revoke all on function public.vendas_manuais_lista() from public, anon;
grant execute on function public.vendas_manuais_lista() to authenticated;

-- 5) robô: de 10 em 10 minutos (pg_cron roda como postgres)
select cron.schedule('meia-diaria-condicional', '*/10 * * * *', 'select public.resolver_condicionais()');

-- conferência
select 'robô ' || jobname || ' ' || schedule || ' ativo=' || active from cron.job where jobname = 'meia-diaria-condicional'
union all
select 'resolver_condicionais: anon=' || has_function_privilege('anon','public.resolver_condicionais()','execute')
    || ' authenticated=' || has_function_privilege('authenticated','public.resolver_condicionais()','execute');

-- Preço cotado garantido (Rodrigo 2026-11-15, caso Elka final 5020).
-- O Lucas cotou R$ 2.400 na Les Zuzu às 20:32; o dono mudou a tabela às 20:55 e o lançamento passou a recusar o valor já aceito pela cliente.
-- Regra: cada cotação que o Lucas manda fica registrada; pelo mesmo prazo do sinal (_prazo_pre: 12h / 6h / 2-3h / 1h, contado da cotação)
-- o lançamento desse cliente (mesmo telefone, lancha, data e período) aceita o valor cotado e o dono recebe o líquido que valia na hora.
-- Mudança de preço para baixo nunca piora nada (vale sempre o menor líquido). Passado o prazo, vale a tabela nova.

-- 1) Registro das cotações (só o servidor e o operador gravam; ninguém do navegador lê, só o administrador)
create table if not exists public.cotacoes_garantidas (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  tel text not null check (tel ~ '^\d{10,16}$'),
  lancha text not null,
  data date not null,
  horario text not null,
  hora_ini text,
  hora_fim text,
  valor numeric not null check (valor > 0),
  tabela numeric,
  neto numeric,
  valido_ate timestamptz not null
);
create index if not exists cotacoes_garantidas_busca on public.cotacoes_garantidas (tel, lancha, data, valido_ate desc);
create index if not exists cotacoes_garantidas_lancha on public.cotacoes_garantidas (lancha, valido_ate desc);
alter table public.cotacoes_garantidas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cotacoes_garantidas' and policyname = 'admin le') then
    create policy "admin le" on public.cotacoes_garantidas for select to authenticated using (public.e_admin());
  end if;
end $$;
revoke all on public.cotacoes_garantidas from anon;
revoke all on public.cotacoes_garantidas from authenticated;
grant select on public.cotacoes_garantidas to authenticated;

-- Líquido do dono e tabela pelo mesmo critério do lançamento (passeio de até 3h usa a tabela de 3h quando existe)
create or replace function public._precos_lanc(l text, d date, h text, hi text, hf text, out tab numeric, out neto numeric)
language plpgsql stable security definer set search_path = public as $$
declare hs numeric;
begin
  if h in ('manha', 'tarde') and hi is not null and hf is not null and public._hora_ok(hi) and public._hora_ok(hf) then
    hs := extract(epoch from (hf::time - hi::time)) / 3600;
    if hs > 0 and hs <= 3 and public.preco_tabela(l, d, '3h') > 0 then h := '3h'; end if;
  end if;
  tab := public.preco_tabela(l, d, h);
  neto := public.preco_neto_tabela(l, d, h);
end $$;
revoke all on function public._precos_lanc(text, date, text, text, text) from public, anon, authenticated;

-- Grava a cotação que o Lucas mandou (chamada pela ponte da VPS, com a sessão de operador). Só informação: nunca bloqueia envio.
create or replace function public.registrar_cotacao(p_tel text, p_lancha text, p_data date, p_horario text, p_valor numeric,
  p_hora_ini text default null, p_hora_fim text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare dig text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'); k record; ate timestamptz; nid bigint;
        hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'Telefone inválido'; end if;
  if p_data is null or p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario, ''), p_data) then raise exception 'Horário inválido'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim))) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  if p_valor is null or not (p_valor > 0) or p_valor > 1000000 then raise exception 'Valor inválido'; end if;
  if (select count(*) from public.cotacoes_garantidas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 2000 then
    raise exception 'Limite de cotações do dia'; end if;
  k := public._precos_lanc(p_lancha, p_data, p_horario, p_hora_ini, p_hora_fim);
  if k.neto is null then return jsonb_build_object('ok', false, 'motivo', 'sem tabela'); end if;
  ate := now() + public._prazo_pre(p_data);
  -- a mesma cotação repetida (mesmo cliente, passeio e valor, com a mesma tabela) não cria outra linha nem estica o prazo
  select id into nid from public.cotacoes_garantidas
   where tel = dig and lancha = p_lancha and data = p_data and horario = p_horario and valor = p_valor and neto = k.neto
     and coalesce(hora_ini, '') = coalesce(p_hora_ini, '') and coalesce(hora_fim, '') = coalesce(p_hora_fim, '')
     and valido_ate > now()
   order by id desc limit 1;
  if nid is not null then
    return jsonb_build_object('ok', true, 'id', nid, 'repetida', true,
      'valido_ate', (select valido_ate from public.cotacoes_garantidas where id = nid));
  end if;
  insert into public.cotacoes_garantidas (tel, lancha, data, horario, hora_ini, hora_fim, valor, tabela, neto, valido_ate)
    values (dig, p_lancha, p_data, p_horario, p_hora_ini, p_hora_fim, p_valor, k.tab, k.neto, ate) returning id into nid;
  return jsonb_build_object('ok', true, 'id', nid, 'valido_ate', ate, 'neto', k.neto, 'tabela', k.tab);
end $$;
revoke all on function public.registrar_cotacao(text, text, date, text, numeric, text, text) from public, anon;
grant execute on function public.registrar_cotacao(text, text, date, text, numeric, text, text) to authenticated;

-- Garantia válida desse cliente para esse passeio (a mais recente)
create or replace function public._garantia_cotacao(dig text, l text, d date, h text)
returns public.cotacoes_garantidas language sql stable security definer set search_path = public as $$
  select g.* from public.cotacoes_garantidas g
   where g.tel = dig and length(dig) >= 10 and g.lancha = l and g.data = d and g.horario = h and g.valido_ate > now()
   order by g.id desc limit 1
$$;
revoke all on function public._garantia_cotacao(text, text, date, text) from public, anon, authenticated;

-- 2) Conferência do valor no lançamento: com garantia válida, o piso é o menor entre o líquido de agora e o da cotação
create or replace function public._confere_valor_op(l text, d date, h text, v numeric)
returns numeric language plpgsql volatile security definer set search_path = public as $$
declare tab numeric; nt numeric; teto numeric; hs numeric; h0 text := h; g public.cotacoes_garantidas; dig text;
begin
  if h in ('manha', 'tarde') then
    hs := nullif(current_setting('app.horas_lanc', true), '')::numeric;
    if hs > 0 and hs <= 3 and public.preco_tabela(l, d, '3h') > 0 then h := '3h'; end if;
  end if;
  tab := public.preco_tabela(l, d, h); nt := public.preco_neto_tabela(l, d, h);
  dig := nullif(current_setting('app.tel_lanc', true), '');
  if dig is not null then g := public._garantia_cotacao(dig, l, d, h0); end if;
  if g.id is not null and v is null then v := g.valor; end if;  -- lançado sem valor: vale o que foi cotado
  if v is null then return tab; end if;
  if not (v > 0) then raise exception 'Valor inválido'; end if;
  if tab is null then raise exception 'Essa lancha não tem preço de tabela nessa data. Lance sem valor e o administrador combina'; end if;
  teto := greatest(tab, coalesce(public._teto_cheio(l, d, h), tab), coalesce(g.valor, 0)) * 3;
  if v > teto then raise exception 'O valor (R$ %) parece errado: passa de 3 vezes a tabela (R$ %)', v, tab; end if;
  if g.id is not null and g.neto is not null and (nt is null or g.neto < nt) then
    nt := g.neto;
    perform set_config('app.neto_garantido', g.neto::text, true);  -- o lançamento grava o líquido garantido na consulta
  end if;
  if nt is not null and l <> 'miss-bardot' and v < nt then raise exception 'O valor (R$ %) fica abaixo do mínimo permitido para essa lancha', v; end if;
  return v;
end $$;

-- 3) Lançamento do operador: igual ao de antes, só passa o telefone para a conferência e grava o líquido garantido
alter table public.consultas add column if not exists neto_garantido numeric;

create or replace function public.lancar_pedido_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text DEFAULT NULL::text, p_valor numeric DEFAULT NULL::numeric, p_sinal numeric DEFAULT NULL::numeric, p_hora_ini text DEFAULT NULL::text, p_hora_fim text DEFAULT NULL::text, p_obs text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nid bigint; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        em text := nullif(lower(trim(coalesce(p_email,''))), ''); ng numeric;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'Escreva nome e sobrenome do cliente'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'WhatsApp do cliente inválido'; end if;
  if em is not null and (em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(em) > 200) then raise exception 'E-mail do cliente inválido'; end if;
  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario,''), p_data) then raise exception 'Horário inválido'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > public._capacidade(p_lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(p_lancha); end if;
  if length(coalesce(p_embarque,'')) > 120 or length(coalesce(p_obs,'')) > 300 then raise exception 'Texto longo demais'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim <> p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  perform set_config('app.horas_lanc', coalesce((extract(epoch from (p_hora_fim::time - p_hora_ini::time)) / 3600)::text, ''), true);  -- hora extra
  perform set_config('app.tel_lanc', dig, true);          -- preço cotado garantido (2026-11-15)
  perform set_config('app.neto_garantido', '', true);
  v := public._confere_valor_op(p_lancha, p_data, p_horario, p_valor, p_pessoas);  -- grupo pequeno da Miss Bardot pode descer mais
  ng := nullif(current_setting('app.neto_garantido', true), '')::numeric;
  perform set_config('app.tel_lanc', '', true);
  perform set_config('app.neto_garantido', '', true);
  if p_sinal is not null and (p_sinal < 0 or (v is not null and p_sinal > v) or (p_sinal > 0 and v is not null and p_sinal < ceil(v * 0.1))) then
    raise exception 'Sinal inválido: zero (pré-reserva) ou de 10%% até o valor'; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 60 then raise exception 'Limite de pedidos do dia'; end if;
  -- mesmo cliente, lancha e dia: só atualiza a consulta que o próprio operador lançou; a do site fica como está
  update public.consultas set horario = p_horario, pessoas = p_pessoas, embarque = nullif(trim(coalesce(p_embarque,'')),''), nome = trim(p_nome),
         email = coalesce(em, email), chamou = true, wa_resposta_em = coalesce(wa_resposta_em, now()),
         valor = v, sinal = p_sinal, hora_ini = p_hora_ini, hora_fim = p_hora_fim, obs = nullif(trim(coalesce(p_obs,'')),''), neto_garantido = ng
   where criado_por is not null and (criado_por = auth.uid() or public.e_admin()) and recusada_em is null and regexp_replace(telefone,'\D','','g') = dig and lancha = p_lancha and data = p_data returning id into nid;
  if nid is not null then return nid; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang, valor, sinal, hora_ini, hora_fim, obs, neto_garantido)
    values (true, now(), auth.uid(), p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            em, case when p_lang in ('pt','en','es') then p_lang else 'pt' end, v, p_sinal, p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''), ng)
    returning id into nid;
  return nid;
end $function$;

-- Ninguém do navegador escreve o líquido garantido na consulta (só o lançamento, que roda como servidor)
create or replace function public.tg_consulta_neto_garantido()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.neto_garantido := case when tg_op = 'UPDATE' then old.neto_garantido else null end;
  end if;
  return new;
end $$;
create or replace trigger a_consulta_neto_garantido before insert or update on public.consultas for each row execute function public.tg_consulta_neto_garantido();

-- 4) Na aprovação, o passeio herda o líquido garantido (parte do dono). Roda depois de trava_valor_buzios (ordem alfabética).
create or replace function public.tg_anotacao_neto_garantido()
returns trigger language plpgsql set search_path = public as $$
declare b public.bloqueios; ng numeric;
begin
  if new.origem is distinct from 'buzios' or new.neto_dono is not null or current_user in ('authenticated', 'anon') then return new; end if;
  select * into b from public.bloqueios where id = new.bloqueio_id;
  if b.id is null then return new; end if;
  select x.neto_garantido into ng from public.consultas x
   where x.neto_garantido is not null and x.criado_por is not null and x.lancha = b.lancha and x.data = b.data and x.horario = b.horario
     and regexp_replace(coalesce(x.telefone, ''), '\D', '', 'g') = regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g')
     and length(regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g')) >= 10
   order by x.id desc limit 1;
  if ng is not null then new.neto_dono := ng; end if;
  return new;
end $$;
create or replace trigger zz_anotacao_neto_garantido before insert on public.anotacoes for each row execute function public.tg_anotacao_neto_garantido();

-- 5) Aviso ao dono: cotações em aberto da lancha dele (só data, período e até quando vale; nada do cliente)
create or replace function public.cotacoes_abertas_dono(l text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.e_admin() or exists (select 1 from public.donos where user_id = auth.uid() and lancha = l)) then raise exception 'Só o dono da lancha'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('data', data, 'horario', horario, 'hora_ini', hora_ini, 'hora_fim', hora_fim, 'valido_ate', valido_ate) order by valido_ate)
    from (select distinct on (tel, data, horario) data, horario, hora_ini, hora_fim, valido_ate
            from public.cotacoes_garantidas g
           where g.lancha = l and g.valido_ate > now()
             -- já virou passeio pago: não está mais em aberto
             and not exists (select 1 from public.bloqueios b join public.anotacoes a on a.bloqueio_id = b.id
                              where b.lancha = g.lancha and b.data = g.data and coalesce(a.sinal, 0) > 0
                                and regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') = g.tel)
           order by tel, data, horario, valido_ate desc) z), '[]'::jsonb);
end $$;
revoke all on function public.cotacoes_abertas_dono(text) from public, anon;
grant execute on function public.cotacoes_abertas_dono(text) to authenticated;

-- 6) Prazo vencido e o dono subiu o preço: o cliente que ainda tenta pagar pelo mesmo link vê o valor novo e precisa concordar.
-- Só o aumento do líquido do dono é repassado (desconto e parte da Búzios ficam como estavam). Miss Bardot e pedido de vendedor ficam fora.
create or replace function public.preco_novo_pedido(pid bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.pedidos; k record; tot numeric; velho numeric; novo numeric;
begin
  select * into p from public.pedidos where id = pid;
  if p.id is null or p.status <> 'pendente' or p.prazo_vencido_em is null or p.vendedor is not null or p.lancha = 'miss-bardot'
     or p.repasse_dono is null or coalesce(p.sinal_valor, 0) <= 0 then
    return jsonb_build_object('mudou', false); end if;
  tot := coalesce(p.preco_cliente, p.preco_base);
  if tot is null then return jsonb_build_object('mudou', false); end if;
  velho := p.repasse_dono + (tot - p.sinal_valor);  -- líquido do dono com que o pedido foi feito (repasse = líquido - pago no embarque)
  k := public._precos_lanc(p.lancha, p.data, p.horario, p.hora_ini, p.hora_fim);
  novo := k.neto;
  if novo is null or novo <= velho + 1 then return jsonb_build_object('mudou', false); end if;
  return jsonb_build_object('mudou', true, 'antigo', tot, 'valor', tot + round(novo - velho), 'neto_antigo', velho, 'neto_novo', novo);
end $$;
revoke all on function public.preco_novo_pedido(bigint) from public, anon, authenticated;

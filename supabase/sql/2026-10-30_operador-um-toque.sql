-- Operador prepara, administrador aprova com UM toque (Rodrigo 2026-10-30)
-- Toda checagem é feita aqui no servidor; o app só mostra os botões.
--
--   1) Preço da tabela no servidor (mesma regra do app: época, feriadão, Réveillon/Carnaval, desconto de seg a qui, período especial)
--        preco_tabela(lancha, data, horario)  = valor da tabela para o cliente
--        preco_neto_tabela(lancha, data, horario) = parte do dono (neto)
--   2) Pedido novo do operador (lancar_pedido_operador) com valor e sinal combinados, horário noite, horas e observação.
--        Valor combinado: no máximo o da tabela e no mínimo o neto do dono (Miss Bardot, que é da Búzios: sem mínimo). Vazio = tabela.
--        Sinal: zero (pré-reserva de 24 h) ou de 10% até o valor.
--   3) aprovar_consulta(cid): "✓ Aprovar como está" cria o passeio direto (confere horário ocupado e manutenção,
--        grava passeio + dados, registra o convite do cliente e apaga a consulta).
--   4) Alterações pedidas (tabela alteracoes_pedidas): solicitar_alteracao (operador/admin), aprovar_alteracao e
--        recusar_alteracao (só admin), registrar_alteracao (admin, quando ele muda o passeio pelo formulário normal).
--   5) marcar_wa aceita o tipo 'alteracao' (admin e operador).
--
-- Rodar inteiro no SQL Editor, DEPOIS do arquivo de papéis (2026-10-30_papeis-operador-auditor.sql). Pode rodar de novo.

-- ============ 1) preço da tabela ============
create or replace function public._pascoa(y int)
returns date language plpgsql immutable as $$
declare a int := y % 19; b int := y / 100; c int := y % 100; d int := b / 4; e int := b % 4; f int := (b + 8) / 25;
        g int := (b - f + 1) / 3; h int := (19*a + b - d - g + 15) % 30; i int := c / 4; k int := c % 4;
        l int := (32 + 2*e + 2*i - h - k) % 7; m int := (a + 11*h + 22*l) / 451; n int := h + l - 7*m + 114;
begin
  return make_date(y, n / 31, n % 31 + 1);
end $$;

-- feriado que emenda (feriadão) na data, ignorando os que o dono tirou; igual a ferOf/ferDias do app
create or replace function public._feriadao(d date, fora text[])
returns text language plpgsql immutable as $$
declare y int := extract(year from d)::int; p date := public._pascoa(y); k text; t date; w int; offs int[];
begin
  foreach k in array array['semana_santa','tiradentes','sao_jorge','trabalho','corpus','ferias_julho','independencia','aparecida','finados','republica','consciencia'] loop
    if k = any(coalesce(fora, '{}')) then continue; end if;
    t := case k when 'semana_santa' then p - 2 when 'tiradentes' then make_date(y,4,21) when 'sao_jorge' then make_date(y,4,23)
              when 'trabalho' then make_date(y,5,1) when 'corpus' then p + 60 when 'ferias_julho' then make_date(y,7,15)
              when 'independencia' then make_date(y,9,7) when 'aparecida' then make_date(y,10,12) when 'finados' then make_date(y,11,2)
              when 'republica' then make_date(y,11,15) else make_date(y,11,20) end;
    w := extract(dow from t)::int;
    offs := case when k = 'ferias_julho' then array(select generate_series(0,16))
                 when k = 'semana_santa' then array[-1,0,1]
                 when w = 1 then array[-3,-2,-1] when w = 2 then array[-4,-3,-2,-1]
                 when w = 4 then array[0,1,2] when w = 5 then array[0,1] else '{}'::int[] end;
    if (d - t) = any(offs) then return k; end if;
  end loop;
  return null;
end $$;

-- época base: reveillon (26/12 a 05/01 e Carnaval), alta (dez, jan, fev), media (mar, abr, nov), baixa (resto)
create or replace function public._epoca(d date)
returns text language plpgsql immutable as $$
declare m int := extract(month from d)::int; md text := to_char(d, 'MM-DD'); p date := public._pascoa(extract(year from d)::int);
begin
  if md >= '12-26' or md <= '01-05' or (d >= p - 50 and d <= p - 47) then return 'reveillon'; end if;
  return case when m in (12,1,2) then 'alta' when m in (3,4,11) then 'media' else 'baixa' end;
end $$;

-- valor na data (cliente ou neto do dono), igual a valorNaData do app. Dia todo = valores de 7 horas.
create or replace function public._valor_na_data(l text, d date, h text, neto boolean)
returns numeric language plpgsql stable security definer set search_path to 'public' as $$
declare r public.precos%rowtype; h7 boolean := (h = 'dia'); suf text := case when h = 'dia' then '7' else '' end;
        e jsonb; ev numeric; base text; k text; col text; v numeric; pc numeric := 0; rx numeric := 0; w int; ds jsonb;
begin
  select * into r from public.precos where lancha = l;
  if r.lancha is null then return null; end if;
  if not neto then  -- período especial vale acima de tudo (só no preço do cliente)
    select x.value into e from jsonb_array_elements(coalesce(r.especiais, '[]'::jsonb)) as x(value)
     where (x.value->>'de')::date <= d and d <= (x.value->>'ate')::date limit 1;
    if e is not null then ev := nullif(e->>(case when h7 then 'v7' else 'v4' end), '')::numeric; if ev > 0 then return ev; end if; end if;
  end if;
  base := public._epoca(d);
  k := case when base <> 'reveillon' and public._feriadao(d, r.sem_feriados) is not null then 'pico' else base end;
  col := (case when k = 'reveillon' then 'alta' when k = 'pico' then base else k end) || suf;
  if neto then
    select n.neto into v from public.precos_neto n where n.lancha = l and n.chave = col;
  else
    v := (to_jsonb(r)->>col)::numeric;
  end if;
  if not (v > 0) then return null; end if;
  if k = 'reveillon' then
    pc := coalesce(case when h7 then coalesce(r.pct_reveillon7, r.pct_reveillon) else r.pct_reveillon end, 0);
    if not neto then rx := coalesce(case when h7 then r.bz_reveillon7 else r.bz_reveillon end, 0); end if;
  elsif k = 'pico' then
    pc := coalesce(r.pct_feriado, 0);
  else
    w := extract(dow from d)::int; ds := coalesce(r.desc_semana, '{}'::jsonb);
    if w between 1 and 4 and k in ('baixa','media','alta') then
      pc := - coalesce(nullif(ds->>(k || suf), '')::numeric, nullif(ds->>k, '')::numeric, 0);
    end if;
  end if;
  -- conta em ponto flutuante e arredonda como o Math.round do app, para dar exatamente o mesmo valor
  return (case when pc <> 0 then (floor(v::float8 * (1 + pc::float8/100) / 10 + 0.5) * 10)::numeric else v end) + rx;
end $$;

create or replace function public.preco_tabela(l text, d date, h text)
returns numeric language sql stable security definer set search_path to 'public' as $$ select public._valor_na_data(l, d, h, false) $$;
create or replace function public.preco_neto_tabela(l text, d date, h text)
returns numeric language sql stable security definer set search_path to 'public' as $$ select public._valor_na_data(l, d, h, true) $$;

-- valor combinado dentro do limite: no máximo a tabela, no mínimo o neto do dono
create or replace function public._confere_valor(l text, d date, h text, v numeric)
returns numeric language plpgsql stable security definer set search_path to 'public' as $$
declare tab numeric := public.preco_tabela(l, d, h); nt numeric := public.preco_neto_tabela(l, d, h);
begin
  if v is null then return tab; end if;  -- vazio: usa a tabela
  if not (v > 0) then raise exception 'Valor inválido'; end if;
  if tab is null then raise exception 'Essa lancha não tem preço de tabela nessa data. Lance sem valor e o administrador combina'; end if;
  if v > tab then raise exception 'O valor (R$ %) passa da tabela (R$ %)', v, tab; end if;
  -- lancha da própria Búzios (Miss Bardot, sem repasse a dono): sem mínimo, igual ao app
  if nt is not null and l <> 'miss-bardot' and v < nt then raise exception 'O valor (R$ %) fica abaixo do mínimo permitido para essa lancha', v; end if;
  return v;
end $$;

create or replace function public._capacidade(l text)
returns int language sql stable security definer set search_path to 'public' as $$
  select coalesce(nullif(dados->>'capacidade','')::int,
                  case l when 'miss-bardot' then 16 when 'les-zuzu' then 8 when 'midas' then 12 when 'compostela' then 6 when 'bubbles' then 11 end, 100)
    from public.lanchas where slug = l
$$;

create or replace function public._hora_ok(x text)
returns boolean language sql immutable as $$ select x ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' $$;

-- horário noite só no Réveillon (31/12), igual ao site
create or replace function public._horario_ok(h text, d date)
returns boolean language sql immutable as $$ select h in ('manha','tarde','dia') or (h = 'noite' and to_char(d,'MM-DD') = '12-31') $$;

revoke all on function public._pascoa(int), public._feriadao(date, text[]), public._epoca(date), public._valor_na_data(text, date, text, boolean),
  public._confere_valor(text, date, text, numeric), public._capacidade(text), public._hora_ok(text), public._horario_ok(text, date) from public, anon, authenticated;
revoke all on function public.preco_tabela(text, date, text), public.preco_neto_tabela(text, date, text) from public, anon;
grant execute on function public.preco_tabela(text, date, text) to authenticated;
-- o neto é só do administrador
revoke all on function public.preco_neto_tabela(text, date, text) from authenticated;

-- ============ 2) pedido novo do operador ============
alter table public.consultas add column if not exists criado_por uuid references auth.users(id) on delete set null;
alter table public.consultas add column if not exists valor numeric;
alter table public.consultas add column if not exists sinal numeric;
alter table public.consultas add column if not exists hora_ini text;
alter table public.consultas add column if not exists hora_fim text;
alter table public.consultas add column if not exists obs text;
-- a tabela usa permissão por coluna: sem isto a lista de consultas do painel pararia de abrir
grant select (criado_por, valor, sinal, hora_ini, hora_fim, obs) on public.consultas to authenticated;

drop function if exists public.lancar_pedido_operador(text, date, text, integer, text, text, text, text, text);
create or replace function public.lancar_pedido_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer,
  p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null,
  p_valor numeric default null, p_sinal numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare nid bigint; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'Escreva nome e sobrenome do cliente'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'WhatsApp do cliente inválido'; end if;
  if coalesce(p_email,'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'E-mail do cliente inválido'; end if;
  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario,''), p_data) then raise exception 'Horário inválido'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > public._capacidade(p_lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(p_lancha); end if;
  if length(coalesce(p_embarque,'')) > 120 or length(coalesce(p_obs,'')) > 300 then raise exception 'Texto longo demais'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim > p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  v := public._confere_valor(p_lancha, p_data, p_horario, p_valor);
  if p_sinal is not null and (p_sinal < 0 or (v is not null and p_sinal > v) or (p_sinal > 0 and v is not null and p_sinal < ceil(v * 0.1))) then
    raise exception 'Sinal inválido: zero (pré-reserva) ou de 10%% até o valor'; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 60 then raise exception 'Limite de pedidos do dia'; end if;
  -- mesmo cliente, lancha e dia: só atualiza a consulta que o próprio operador lançou; a do site fica como está
  update public.consultas set horario = p_horario, pessoas = p_pessoas, embarque = nullif(trim(coalesce(p_embarque,'')),''), nome = trim(p_nome),
         email = lower(trim(p_email)), chamou = true, wa_resposta_em = coalesce(wa_resposta_em, now()),
         valor = v, sinal = p_sinal, hora_ini = p_hora_ini, hora_fim = p_hora_fim, obs = nullif(trim(coalesce(p_obs,'')),'')
   where criado_por is not null and regexp_replace(telefone,'\D','','g') = dig and lancha = p_lancha and data = p_data returning id into nid;
  if nid is not null then return nid; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang, valor, sinal, hora_ini, hora_fim, obs)
    values (true, now(), auth.uid(), p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            lower(trim(p_email)), case when p_lang in ('pt','en','es') then p_lang else 'pt' end, v, p_sinal, p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''))
    returning id into nid;
  return nid;
end $$;
revoke all on function public.lancar_pedido_operador(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.lancar_pedido_operador(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text) to authenticated;

-- ============ 3) aprovar a consulta como está, num toque ============
create or replace function public.aprovar_consulta(cid bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare c public.consultas%rowtype; bid bigint; v numeric; s numeric; res text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select * into c from public.consultas where id = cid for update;
  if c.id is null then raise exception 'Consulta não encontrada'; end if;
  if c.data < hoje then raise exception 'A data já passou'; end if;
  if not public._horario_ok(c.horario, c.data) then raise exception 'Horário inválido'; end if;
  v := coalesce(c.valor, public.preco_tabela(c.lancha, c.data, c.horario));
  if not (v > 0) then raise exception 'Sem valor combinado nem preço de tabela: use o Aprovar normal e preencha o valor'; end if;
  s := coalesce(c.sinal, 0);
  if s < 0 or s > v then raise exception 'Sinal inválido'; end if;
  if exists (select 1 from public.bloqueios x where x.lancha = c.lancha and x.data = c.data and public.choca_horario(x.horario, c.horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha'; end if;
  if exists (select 1 from public.manutencoes m where m.lancha = c.lancha and m.de <= c.data and c.data <= m.ate) then
    raise exception 'A lancha está em manutenção nesse dia'; end if;
  insert into public.bloqueios (lancha, data, horario, criado_por) values (c.lancha, c.data, c.horario, auth.uid()) returning id into bid;
  insert into public.anotacoes (bloqueio_id, origem, cliente, telefone, pessoas, valor, sinal, embarque, hora_ini, hora_fim, obs)
    values (bid, 'buzios', c.nome, c.telefone, c.pessoas, v, s, c.embarque, c.hora_ini, c.hora_fim, c.obs);
  -- convite do cliente (quem já tem conta recebe o passeio na hora); com sinal zero fica guardado até o sinal entrar
  res := public.convidar_cliente(bid, c.email, c.nome, c.telefone);
  delete from public.consultas where id = cid;
  return jsonb_build_object('bid', bid, 'convite', res, 'pendente', s = 0, 'email', c.email, 'valor', v, 'sinal', s);
end $$;
revoke all on function public.aprovar_consulta(bigint) from public, anon;
grant execute on function public.aprovar_consulta(bigint) to authenticated;

-- ============ 4) alterações pedidas ============
create table if not exists public.alteracoes_pedidas (
  id bigserial primary key,
  bloqueio_id bigint not null references public.bloqueios(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  nova_lancha text,
  nova_data date,
  novo_horario text,
  novas_pessoas integer,
  novo_valor numeric,
  hora_ini text,
  hora_fim text,
  condicional boolean not null default false,
  cond_valor_dia numeric,
  motivo text,
  status text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  resolvido_em timestamptz,
  antes jsonb,          -- como estava antes de aprovar (lancha, data, horario, pessoas, valor, hora_ini, hora_fim)
  wa_em timestamptz     -- quando o aviso do WhatsApp foi mandado ao cliente
);
create unique index if not exists alteracoes_pedidas_uma_pendente on public.alteracoes_pedidas (bloqueio_id) where status = 'pendente';
alter table public.alteracoes_pedidas enable row level security;
revoke all on public.alteracoes_pedidas from anon, authenticated;
grant select on public.alteracoes_pedidas to authenticated;
drop policy if exists alteracoes_le on public.alteracoes_pedidas;
-- administrador e operador leem (o auditor também, só leitura); ninguém grava direto: só as funções abaixo
create policy alteracoes_le on public.alteracoes_pedidas for select to authenticated using (public.painel_le_atend());

create or replace function public.solicitar_alteracao(bid bigint, p_lancha text default null, p_data date default null, p_horario text default null,
  p_pessoas integer default null, p_valor numeric default null, p_hora_ini text default null, p_hora_fim text default null,
  p_condicional boolean default false, p_cond_valor_dia numeric default null, p_motivo text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare b record; a record; nl text; nd date; nh text; np int; nid bigint; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  select * into b from public.bloqueios where id = bid;
  if b.id is null then raise exception 'Passeio não encontrado'; end if;
  if b.data < hoje then raise exception 'O passeio já passou'; end if;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if exists (select 1 from public.alteracoes_pedidas where bloqueio_id = bid and status = 'pendente') then
    raise exception 'Esse passeio já tem uma alteração esperando aprovação'; end if;
  nl := coalesce(p_lancha, b.lancha); nd := coalesce(p_data, b.data); nh := coalesce(p_horario, b.horario); np := coalesce(p_pessoas, a.pessoas);
  if not exists (select 1 from public.lanchas where slug = nl) then raise exception 'Lancha não existe'; end if;
  if nd < hoje or nd > hoje + 730 then raise exception 'Data inválida'; end if;
  if not public._horario_ok(nh, nd) then raise exception 'Horário inválido'; end if;
  if np is not null and (np < 1 or np > public._capacidade(nl)) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(nl); end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim > p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  if p_valor is not null then perform public._confere_valor(nl, nd, nh, p_valor); end if;
  if coalesce(p_condicional, false) then
    if nh not in ('manha','tarde') then raise exception 'Condicional só para manhã ou tarde'; end if;
    if p_cond_valor_dia is null then raise exception 'Informe o valor da diária para a condicional'; end if;
    perform public._confere_valor(nl, nd, 'dia', p_cond_valor_dia);
  end if;
  if length(coalesce(p_motivo,'')) > 300 then raise exception 'Motivo longo demais'; end if;
  if p_lancha is not distinct from b.lancha then p_lancha := null; end if;
  if p_data is not distinct from b.data then p_data := null; end if;
  if p_horario is not distinct from b.horario then p_horario := null; end if;
  if p_pessoas is not distinct from a.pessoas then p_pessoas := null; end if;
  -- trocou lancha ou horário (ou ligou a condicional) sem dizer o valor: usa a tabela da nova combinação
  if p_valor is null and (p_lancha is not null or p_horario is not null or coalesce(p_condicional,false)) then p_valor := public.preco_tabela(nl, nd, nh); end if;
  if p_valor is not distinct from a.valor then p_valor := null; end if;
  if p_hora_ini is not distinct from a.hora_ini and p_hora_fim is not distinct from a.hora_fim then p_hora_ini := null; p_hora_fim := null; end if;
  if p_lancha is null and p_data is null and p_horario is null and p_pessoas is null and p_valor is null and p_hora_ini is null and not coalesce(p_condicional,false) then
    raise exception 'Nada para alterar'; end if;
  insert into public.alteracoes_pedidas (bloqueio_id, criado_por, nova_lancha, nova_data, novo_horario, novas_pessoas, novo_valor, hora_ini, hora_fim, condicional, cond_valor_dia, motivo)
    values (bid, auth.uid(), p_lancha, p_data, p_horario, p_pessoas, p_valor, p_hora_ini, p_hora_fim, coalesce(p_condicional,false),
            case when p_condicional then p_cond_valor_dia end, nullif(trim(coalesce(p_motivo,'')),''))
    returning id into nid;
  return nid;
end $$;

-- aplica tudo numa transação; o sinal não muda
create or replace function public.aprovar_alteracao(aid bigint)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare r public.alteracoes_pedidas%rowtype; b record; a record; nl text; nd date; nh text; mudou boolean;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select * into r from public.alteracoes_pedidas where id = aid for update;
  if r.id is null or r.status <> 'pendente' then raise exception 'Alteração não está mais pendente'; end if;
  select * into b from public.bloqueios where id = r.bloqueio_id;
  if b.id is null then raise exception 'Passeio não encontrado'; end if;
  select * into a from public.anotacoes where bloqueio_id = b.id;
  nl := coalesce(r.nova_lancha, b.lancha); nd := coalesce(r.nova_data, b.data); nh := coalesce(r.novo_horario, b.horario);
  mudou := nl <> b.lancha or nd <> b.data or nh <> b.horario;
  -- os valores podem ter mudado desde o pedido: confere de novo
  if r.novo_valor is not null then perform public._confere_valor(nl, nd, nh, r.novo_valor); end if;
  if r.novas_pessoas is not null and r.novas_pessoas > public._capacidade(nl) then raise exception 'Pessoas acima da capacidade da lancha'; end if;
  if mudou and (nl <> b.lancha or nd <> b.data) and exists (select 1 from public.manutencoes m where m.lancha = nl and m.de <= nd and nd <= m.ate) then
    raise exception 'A lancha está em manutenção nesse dia'; end if;
  update public.alteracoes_pedidas set antes = jsonb_build_object('lancha', b.lancha, 'data', b.data, 'horario', b.horario, 'pessoas', a.pessoas,
         'valor', a.valor, 'hora_ini', a.hora_ini, 'hora_fim', a.hora_fim) where id = aid;
  -- lancha, data ou horário: mesma checagem de horário ocupado e de marinheiro do mover_passeio
  if mudou then perform public.mover_passeio(b.id, nl, nd, nh); end if;
  update public.anotacoes set
      pessoas = coalesce(r.novas_pessoas, pessoas),
      valor = coalesce(r.novo_valor, valor),
      hora_ini = case when r.hora_ini is not null then r.hora_ini when nh <> b.horario then null else hora_ini end,
      hora_fim = case when r.hora_fim is not null then r.hora_fim when nh <> b.horario then null else hora_fim end,
      atualizado_em = now()
   where bloqueio_id = b.id;
  update public.pedidos set
      pessoas = coalesce(r.novas_pessoas, pessoas),
      hora_ini = case when r.hora_ini is not null then r.hora_ini when nh <> b.horario then null else hora_ini end,
      hora_fim = case when r.hora_fim is not null then r.hora_fim when nh <> b.horario then null else hora_fim end,
      atualizado_em = now()
   where bloqueio_id = b.id;
  -- diária virou manhã/tarde com condicional: volta para a diária sozinha se a outra metade não vender
  if r.condicional then perform public.definir_condicional(b.id, r.cond_valor_dia); end if;
  update public.alteracoes_pedidas set status = 'aprovada', resolvido_em = now() where id = aid;
  return b.id;
end $$;

create or replace function public.recusar_alteracao(aid bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.e_admin() then raise exception 'Só o administrador recusa'; end if;
  update public.alteracoes_pedidas set status = 'recusada', resolvido_em = now() where id = aid and status = 'pendente';
end $$;

-- o administrador mudou o passeio pelo formulário normal: registra o antes e o depois para avisar o cliente do mesmo jeito
create or replace function public.registrar_alteracao(bid bigint, p_antes jsonb)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare b record; a record; nid bigint;
begin
  if not public.e_admin() then raise exception 'Sem acesso'; end if;
  if jsonb_typeof(p_antes) <> 'object' then raise exception 'Dados inválidos'; end if;
  select * into b from public.bloqueios where id = bid;
  if b.id is null then raise exception 'Passeio não encontrado'; end if;
  select * into a from public.anotacoes where bloqueio_id = bid;
  insert into public.alteracoes_pedidas (bloqueio_id, criado_por, nova_lancha, nova_data, novo_horario, novas_pessoas, novo_valor, hora_ini, hora_fim,
                                         status, resolvido_em, antes, motivo)
    values (bid, auth.uid(), b.lancha, b.data, b.horario, a.pessoas, a.valor, a.hora_ini, a.hora_fim, 'aprovada', now(),
            jsonb_build_object('lancha', p_antes->>'lancha', 'data', p_antes->>'data', 'horario', p_antes->>'horario', 'pessoas', p_antes->'pessoas',
                               'valor', p_antes->'valor', 'hora_ini', p_antes->>'hora_ini', 'hora_fim', p_antes->>'hora_fim'), 'formulário')
    returning id into nid;
  return nid;
end $$;

revoke all on function public.solicitar_alteracao(bigint, text, date, text, integer, numeric, text, text, boolean, numeric, text) from public, anon;
revoke all on function public.aprovar_alteracao(bigint) from public, anon;
revoke all on function public.recusar_alteracao(bigint) from public, anon;
revoke all on function public.registrar_alteracao(bigint, jsonb) from public, anon;
grant execute on function public.solicitar_alteracao(bigint, text, date, text, integer, numeric, text, text, boolean, numeric, text) to authenticated;
grant execute on function public.aprovar_alteracao(bigint) to authenticated;
grant execute on function public.recusar_alteracao(bigint) to authenticated;
grant execute on function public.registrar_alteracao(bigint, jsonb) to authenticated;

-- ============ 5) marcar_wa com o tipo 'alteracao' (igual nos arquivos de papéis e do WhatsApp) ============
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
revoke all on function public.marcar_wa(text, bigint) from public, anon;
grant execute on function public.marcar_wa(text, bigint) to authenticated;

-- conferência: preço de exemplo e tudo criado
select 'Miss Bardot 4h em 05/12/2026 (tabela): ' || coalesce(public.preco_tabela('miss-bardot', date '2026-12-05', 'manha')::text, 'sem preço')
union all select 'tabela alteracoes_pedidas: ' || count(*) from information_schema.tables where table_name = 'alteracoes_pedidas'
union all select 'funções: ' || count(*) from pg_proc where proname in ('preco_tabela','preco_neto_tabela','aprovar_consulta','solicitar_alteracao','aprovar_alteracao','recusar_alteracao','registrar_alteracao','lancar_pedido_operador');

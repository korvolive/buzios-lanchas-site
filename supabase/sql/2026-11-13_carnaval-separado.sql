-- Carnaval com % próprio, separado do Réveillon (Rodrigo 2026-11-13)
-- Antes: Réveillon e Carnaval = alta + precos.pct_reveillon(7).
-- Agora: Réveillon (27/12 a 5/01) continua com pct_reveillon(7); Carnaval (sábado a terça, pela Páscoa, todo ano sozinho)
-- usa pct_carnaval(7). Começa com os MESMOS valores de hoje, então nada muda até o dono mexer.
-- O "Búzios a mais" (bz_reveillon) continua valendo para os dois.
-- Sem DROP/DELETE.

alter table public.precos add column if not exists pct_carnaval numeric default 0;
alter table public.precos add column if not exists pct_carnaval7 numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'precos_pct_carnaval_check') then
    alter table public.precos add constraint precos_pct_carnaval_check check (pct_carnaval >= 0 and pct_carnaval <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'precos_pct_carnaval7_check') then
    alter table public.precos add constraint precos_pct_carnaval7_check check (pct_carnaval7 >= 0 and pct_carnaval7 <= 100);
  end if;
end $$;

-- mesmos valores de hoje
update public.precos set pct_carnaval = coalesce(pct_reveillon, 0), pct_carnaval7 = pct_reveillon7;

-- preço na data (site, app, Lucas, pagamentos): Carnaval = alta + pct_carnaval
CREATE OR REPLACE FUNCTION public._valor_na_data(l text, d date, h text, neto boolean)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.precos%rowtype; h7 boolean := (h = 'dia'); suf text := case when h = 'dia' then '7' else '' end;
        e jsonb; ev numeric; base text; k text; col text; v numeric; pc numeric := 0; rx numeric := 0; w int; ds jsonb; tenta text;
begin
  if h = 'noite' then
    v := public._valor_na_data(l, d, 'dia', neto);
    return case when v > 0 then v + 1000 end;
  end if;
  select * into r from public.precos where lancha = l;
  if r.lancha is null then return null; end if;
  if not neto then
    select x.value into e from jsonb_array_elements(coalesce(r.especiais, '[]'::jsonb)) as x(value)
     where (x.value->>'de')::date <= d and d <= (x.value->>'ate')::date limit 1;
    if e is not null then ev := nullif(e->>(case when h7 then 'v7' else 'v4' end), '')::numeric; if ev > 0 then return ev; end if; end if;
  end if;
  base := public._epoca(d);
  k := case when base <> 'reveillon' and public._feriadao(d, r.sem_feriados) is not null then 'pico' else base end;
  col := (case when k = 'reveillon' then 'alta' when k = 'pico' then base else k end);
  foreach tenta in array (case col when 'alta' then array['alta','media','baixa'] when 'media' then array['media','baixa'] else array[col] end) loop
    if neto then
      select n.neto into v from public.precos_neto n where n.lancha = l and n.chave = tenta || suf;
    else
      v := (to_jsonb(r)->>(tenta || suf))::numeric;
    end if;
    exit when v > 0;
  end loop;
  if not (v > 0) then return null; end if;
  if k = 'reveillon' then
    if extract(month from d)::int in (2, 3) then  -- Carnaval (o Réveillon é dezembro/janeiro)
      pc := coalesce(case when h7 then coalesce(r.pct_carnaval7, r.pct_carnaval) else r.pct_carnaval end,
                     case when h7 then coalesce(r.pct_reveillon7, r.pct_reveillon) else r.pct_reveillon end, 0);
    else
      pc := coalesce(case when h7 then coalesce(r.pct_reveillon7, r.pct_reveillon) else r.pct_reveillon end, 0);
    end if;
    if not neto then rx := coalesce(case when h7 then r.bz_reveillon7 else r.bz_reveillon end, 0); end if;
  elsif k = 'pico' then
    pc := coalesce(r.pct_feriado, 0);
  else
    w := extract(dow from d)::int; ds := coalesce(r.desc_semana, '{}'::jsonb);
    if w between 1 and 4 and k in ('baixa','media','alta') then
      pc := - coalesce(nullif(ds->>(k || suf), '')::numeric, nullif(ds->>k, '')::numeric, 0);
    end if;
  end if;
  return (case when pc <> 0 then (floor(v::float8 * (1 + pc::float8/100) / 10 + 0.5) * 10)::numeric else v end) + rx;
end $function$;

-- grava os % (também o do Carnaval, quando vier)
CREATE OR REPLACE FUNCTION public.aplicar_netos(l text, nv jsonb, op jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; novo int; c text;
begin
  for r in select * from precos_neto where lancha = l loop
    if not nv ? r.chave then continue; end if;
    novo := (nv->>r.chave)::int;
    if novo is distinct from r.neto then
      update precos_neto set neto = novo,
        comissao = case when novo is null or r.comissao is null or not coalesce(r.neto, r.ref) > 0 then r.comissao
                        else round(novo * r.comissao::numeric / coalesce(r.neto, r.ref) / 10) * 10 end,
        atualizado_em = now()
      where lancha = l and chave = r.chave;
    end if;
  end loop;
  insert into precos (lancha, atualizado_em) values (l, now()) on conflict (lancha) do nothing;
  foreach c in array array['baixa','media','alta','baixa7','media7','alta7'] loop
    execute format('update precos set %I = coalesce((select neto + coalesce(comissao, 0) from precos_neto where lancha = $1 and chave = $2 and neto > 0), %I) where lancha = $1', c, c) using l, c;
  end loop;
  update precos set
    sem_feriados = array(select jsonb_array_elements_text(coalesce(op->'sem_feriados', '[]'::jsonb))),
    pct_feriado = coalesce((op->>'pct_feriado')::int, pct_feriado),
    pct_reveillon = coalesce((op->>'pct_reveillon')::numeric, pct_reveillon),
    pct_reveillon7 = case when op ? 'pct_reveillon7' then (op->>'pct_reveillon7')::numeric else pct_reveillon7 end,
    pct_carnaval = coalesce((op->>'pct_carnaval')::numeric, pct_carnaval),
    pct_carnaval7 = case when op ? 'pct_carnaval7' then (op->>'pct_carnaval7')::numeric else pct_carnaval7 end,
    desc_semana = coalesce(op->'desc_semana', desc_semana),
    atualizado_em = now()
  where lancha = l;
end $function$;

-- o app do dono lê o % do Carnaval
CREATE OR REPLACE FUNCTION public.meus_netos(l text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ult timestamptz; p record;
begin
  if not exists (select 1 from donos where user_id = auth.uid() and lancha = l) then raise exception 'Só o dono da lancha'; end if;
  select max(em) into ult from precos_hist where lancha = l and por = auth.uid() and desfeito_em is null;
  select * into p from precos where lancha = l;
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(jsonb_build_object('chave', chave, 'neto', neto, 'ref', ref)) from precos_neto where lancha = l and chave in ('baixa','media','alta','baixa7','media7','alta7')), '[]'::jsonb),
    'sem_feriados', coalesce(to_jsonb(p.sem_feriados), '[]'::jsonb),
    'pct_feriado', coalesce(p.pct_feriado, 10), 'pct_reveillon', coalesce(p.pct_reveillon, 0), 'pct_reveillon7', p.pct_reveillon7,
    'pct_carnaval', coalesce(p.pct_carnaval, p.pct_reveillon, 0), 'pct_carnaval7', p.pct_carnaval7,
    'desc_semana', coalesce(p.desc_semana, '{}'::jsonb),
    'prox', null::timestamptz);
end $function$;

-- dono salva os valores, agora com o Carnaval separado (v2 continua para o app antigo e não mexe no Carnaval)
CREATE OR REPLACE FUNCTION public.salvar_netos_v3(l text, v jsonb, off text[], pf integer, pr numeric, pr7 numeric, pc numeric, pc7 numeric, ds jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record; p record; novo int; lo int; hi int; h text; k text; a int; b int; d numeric; ant text; rf numeric;
  mx int := case when l = 'miss-bardot' then 60 else 25 end;
  antes jsonb := '{}'; depois jsonb; nv jsonb := '{}'; dsl jsonb := '{}'; dsa jsonb := '{}'; op jsonb; fora text[] := '{}';
  fer text[] := array['semana_santa','tiradentes','sao_jorge','trabalho','corpus','ferias_julho','independencia','aparecida','finados','republica','consciencia'];
begin
  if not exists (select 1 from donos where user_id = auth.uid() and lancha = l) then raise exception 'Só o dono da lancha'; end if;
  if pf is null or pf not between 0 and (case when l = 'miss-bardot' then 20 else 10 end) or pf % 5 <> 0 then raise exception 'Feriados: use de 0%% até %, de 5 em 5', (case when l = 'miss-bardot' then 20 else 10 end)::text || '%'; end if;
  pr := round(pr, 2); pr7 := round(coalesce(pr7, pr), 2);
  if pr is null or pr not between 0 and mx or pr7 not between 0 and mx then raise exception 'Réveillon: use de 0%% até %', mx::text || '%'; end if;
  select * into p from precos where lancha = l;
  pc := round(coalesce(pc, p.pct_carnaval, pr), 2); pc7 := round(coalesce(pc7, pc), 2);
  if pc not between 0 and mx or pc7 not between 0 and mx then raise exception 'Carnaval: use de 0%% até %', mx::text || '%'; end if;
  foreach k in array array['baixa','media','alta','baixa7','media7','alta7'] loop
    d := round(coalesce((ds->>k)::numeric, (ds->>replace(k, '7', ''))::numeric, 0), 2);
    if d < 0 or d > 30 then raise exception 'Desconto: use de 0%% a 30%%'; end if;
    dsl := dsl || jsonb_build_object(k, d);
  end loop;
  off := array(select distinct x from unnest(coalesce(off, '{}')) x where x = any(fer) order by 1);
  for r in select * from precos_neto where lancha = l and chave in ('baixa','media','alta','baixa7','media7','alta7') loop
    antes := antes || jsonb_build_object(r.chave, r.neto);
    if v ? r.chave and r.ref > 0 and jsonb_typeof(v->r.chave) = 'number' then
      novo := (v->>r.chave)::int;
      lo := ceil(r.ref * 0.7 / 50.0) * 50; hi := floor(r.ref * 1.3 / 50.0) * 50;
      if novo % 50 <> 0 then raise exception 'Use valores de R$ 50 em R$ 50'; end if;
      if novo < lo or novo > hi then fora := fora || r.chave; end if;
      nv := nv || jsonb_build_object(r.chave, novo);
    else
      nv := nv || jsonb_build_object(r.chave, r.neto);
    end if;
  end loop;
  foreach k in array fora loop
    ant := case when k like 'media%' then replace(k, 'media', 'baixa') when k like 'alta%' then replace(k, 'alta', 'media') end;
    if ant is null or (nv->>k) is distinct from (nv->>ant) then
      select ref into rf from precos_neto where lancha = l and chave = k;
      raise exception 'Valor fora da faixa permitida (R$ % a R$ %)', ceil(rf * 0.7 / 50.0) * 50, floor(rf * 1.3 / 50.0) * 50;
    end if;
  end loop;
  foreach h in array array['', '7'] loop
    a := (nv->>('baixa'||h))::int; b := (nv->>('media'||h))::int;
    if a is not null and b is not null and b < a then raise exception 'A Média não pode custar menos que a Baixa'; end if;
    a := b; b := (nv->>('alta'||h))::int;
    if a is not null and b is not null and b < a then raise exception 'A Alta não pode custar menos que a Média'; end if;
  end loop;
  foreach k in array array['baixa','media','alta'] loop
    a := (nv->>k)::int; b := (nv->>(k||'7'))::int;
    if a is not null and b is not null and b <= a then raise exception 'O passeio de 7 horas tem que custar mais que o de 4 horas'; end if;
  end loop;
  foreach k in array array['baixa','media','alta','baixa7','media7','alta7'] loop
    dsa := dsa || jsonb_build_object(k, round(coalesce((p.desc_semana->>k)::numeric, (p.desc_semana->>replace(k, '7', ''))::numeric, 0), 2));
  end loop;
  antes := antes || jsonb_build_object('sem_feriados', coalesce(to_jsonb(p.sem_feriados), '[]'::jsonb), 'pct_feriado', coalesce(p.pct_feriado, 10),
    'pct_reveillon', coalesce(p.pct_reveillon, 0), 'pct_reveillon7', coalesce(p.pct_reveillon7, p.pct_reveillon, 0),
    'pct_carnaval', coalesce(p.pct_carnaval, 0), 'pct_carnaval7', coalesce(p.pct_carnaval7, p.pct_carnaval, 0), 'desc_semana', dsa);
  op := jsonb_build_object('sem_feriados', to_jsonb(off), 'pct_feriado', pf, 'pct_reveillon', pr, 'pct_reveillon7', pr7,
    'pct_carnaval', pc, 'pct_carnaval7', pc7, 'desc_semana', dsl);
  depois := nv || op;
  if depois = antes then return jsonb_build_object('mudou', false); end if;
  perform public.aplicar_netos(l, nv, op);
  insert into precos_hist (lancha, por, antes, depois) values (l, auth.uid(), antes, depois);
  return jsonb_build_object('mudou', true, 'prox', null);
end $function$;
revoke all on function public.salvar_netos_v3(text, jsonb, text[], integer, numeric, numeric, numeric, numeric, jsonb) from public, anon;
grant execute on function public.salvar_netos_v3(text, jsonb, text[], integer, numeric, numeric, numeric, numeric, jsonb) to authenticated;

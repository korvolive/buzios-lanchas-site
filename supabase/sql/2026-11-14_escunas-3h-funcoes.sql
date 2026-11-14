CREATE OR REPLACE FUNCTION public._valor_na_data(l text, d date, h text, neto boolean)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r public.precos%rowtype; h7 boolean := (h = 'dia'); h3 boolean := (h = '3h');
        suf text := case when h = 'dia' then '7' when h = '3h' then '3' else '' end;
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
    if e is not null then ev := nullif(e->>(case when h7 then 'v7' when h3 then 'v3' else 'v4' end), '')::numeric; if ev > 0 then return ev; end if; end if;
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
    if extract(month from d)::int in (2, 3) then
      pc := coalesce(case when h7 then coalesce(r.pct_carnaval7, r.pct_carnaval) else r.pct_carnaval end,
                     case when h7 then coalesce(r.pct_reveillon7, r.pct_reveillon) else r.pct_reveillon end, 0);
      if not neto then rx := coalesce(case when h7 then r.bz_carnaval7 else r.bz_carnaval end, 0); end if;
    else
      pc := coalesce(case when h7 then coalesce(r.pct_reveillon7, r.pct_reveillon) else r.pct_reveillon end, 0);
      if not neto then rx := coalesce(case when h7 then r.bz_reveillon7 else r.bz_reveillon end, 0); end if;
    end if;
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

CREATE OR REPLACE FUNCTION public._teto_cheio(l text, d date, h text)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r public.precos%rowtype; suf text := case when h = 'dia' then '7' when h = '3h' then '3' else '' end;
        base text; tenta text; v numeric; w int := extract(dow from d)::int; e jsonb;
begin
  if h = 'noite' then
    v := public._teto_cheio(l, d, 'dia');
    return case when v > 0 then v + 1000 end;
  end if;
  if w not between 1 and 4 then return null; end if;
  select * into r from public.precos where lancha = l;
  if r.lancha is null then return null; end if;
  select x.value into e from jsonb_array_elements(coalesce(r.especiais, '[]'::jsonb)) as x(value)
   where (x.value->>'de')::date <= d and d <= (x.value->>'ate')::date limit 1;
  if e is not null and nullif(e->>(case when h = 'dia' then 'v7' when h = '3h' then 'v3' else 'v4' end), '')::numeric > 0 then return null; end if;
  base := public._epoca(d);
  if base not in ('baixa','media','alta') or public._feriadao(d, r.sem_feriados) is not null then return null; end if;
  foreach tenta in array (case base when 'alta' then array['alta','media','baixa'] when 'media' then array['media','baixa'] else array[base] end) loop
    v := (to_jsonb(r)->>(tenta || suf))::numeric;
    exit when v > 0;
  end loop;
  return case when v > 0 then v end;
end $function$;

CREATE OR REPLACE FUNCTION public._confere_valor_op(l text, d date, h text, v numeric)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare tab numeric; nt numeric; teto numeric; hs numeric;
begin
  if h in ('manha', 'tarde') then
    hs := nullif(current_setting('app.horas_lanc', true), '')::numeric;
    if hs > 0 and hs <= 3 and public.preco_tabela(l, d, '3h') > 0 then h := '3h'; end if;
  end if;
  tab := public.preco_tabela(l, d, h); nt := public.preco_neto_tabela(l, d, h);
  if v is null then return tab; end if;
  if not (v > 0) then raise exception 'Valor inválido'; end if;
  if tab is null then raise exception 'Essa lancha não tem preço de tabela nessa data. Lance sem valor e o administrador combina'; end if;
  teto := greatest(tab, coalesce(public._teto_cheio(l, d, h), tab)) * 3;
  if v > teto then raise exception 'O valor (R$ %) parece errado: passa de 3 vezes a tabela (R$ %)', v, tab; end if;
  if nt is not null and l <> 'miss-bardot' and v < nt then raise exception 'O valor (R$ %) fica abaixo do mínimo permitido para essa lancha', v; end if;
  return v;
end $function$;
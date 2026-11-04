-- Réveillon noturno (31/12, 22h às 5h), Rodrigo 2026-11-04:
-- em todas as lanchas, o valor é o de 7 horas do Réveillon + R$ 1.000 (cliente e neto do dono), igual ao site e ao app.
create or replace function public._valor_na_data(l text, d date, h text, neto boolean)
 returns numeric
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare r public.precos%rowtype; h7 boolean := (h = 'dia'); suf text := case when h = 'dia' then '7' else '' end;
        e jsonb; ev numeric; base text; k text; col text; v numeric; pc numeric := 0; rx numeric := 0; w int; ds jsonb;
begin
  if h = 'noite' then
    v := public._valor_na_data(l, d, 'dia', neto);
    return case when v > 0 then v + 1000 end;
  end if;
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
  return (case when pc <> 0 then (floor(v::float8 * (1 + pc::float8/100) / 10 + 0.5) * 10)::numeric else v end) + rx;
end $function$;

-- conferir: Miss Bardot no dia 31/12 (deve dar 7000 e 8000)
select public._valor_na_data('miss-bardot', '2026-12-31', 'dia', false) dia_7h,
       public._valor_na_data('miss-bardot', '2026-12-31', 'noite', false) noturno;

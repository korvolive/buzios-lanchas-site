-- Réveillon começa em 27/12 (era 26/12) e o teto do % de Réveillon e Carnaval do dono passa de 20% para 25% (Rodrigo 2026-11-01).
-- A Miss Bardot continua com teto de 60%.

CREATE OR REPLACE FUNCTION public._epoca(d date)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $fn$
declare m int := extract(month from d)::int; md text := to_char(d, 'MM-DD'); p date := public._pascoa(extract(year from d)::int);
begin
  if md >= '12-27' or md <= '01-05' or (d >= p - 50 and d <= p - 47) then return 'reveillon'; end if;
  return case when m in (12,1,2) then 'alta' when m in (3,4,11) then 'media' else 'baixa' end;
end $fn$;

CREATE OR REPLACE FUNCTION public.salvar_netos_v2(l text, v jsonb, off text[], pf integer, pr numeric, pr7 numeric, ds jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
declare
  r record; p record; novo int; lo int; hi int; ult timestamptz; h text; k text; a int; b int; d numeric; ant text; rf numeric;
  antes jsonb := '{}'; depois jsonb; nv jsonb := '{}'; dsl jsonb := '{}'; dsa jsonb := '{}'; op jsonb; fora text[] := '{}';
  fer text[] := array['semana_santa','tiradentes','sao_jorge','trabalho','corpus','ferias_julho','independencia','aparecida','finados','republica','consciencia'];
begin
  if not exists (select 1 from donos where user_id = auth.uid() and lancha = l) then raise exception 'Só o dono da lancha'; end if;
  if pf is null or pf not between 0 and (case when l = 'miss-bardot' then 20 else 10 end) or pf % 5 <> 0 then raise exception 'Feriados: use de 0%% até %, de 5 em 5', (case when l = 'miss-bardot' then 20 else 10 end)::text || '%'; end if;
  pr := round(pr, 2); pr7 := round(coalesce(pr7, pr), 2);
  if pr is null or pr not between 0 and (case when l = 'miss-bardot' then 60 else 25 end) or pr7 not between 0 and (case when l = 'miss-bardot' then 60 else 25 end) then raise exception 'Réveillon e Carnaval: use de 0%% até %', (case when l = 'miss-bardot' then 60 else 25 end)::text || '%'; end if;
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
      if novo < lo or novo > hi then fora := fora || r.chave; end if; /* conferido abaixo: pode ser época desligada */
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
  select * into p from precos where lancha = l;
  foreach k in array array['baixa','media','alta','baixa7','media7','alta7'] loop
    dsa := dsa || jsonb_build_object(k, round(coalesce((p.desc_semana->>k)::numeric, (p.desc_semana->>replace(k, '7', ''))::numeric, 0), 2));
  end loop;
  antes := antes || jsonb_build_object('sem_feriados', coalesce(to_jsonb(p.sem_feriados), '[]'::jsonb), 'pct_feriado', coalesce(p.pct_feriado, 10),
    'pct_reveillon', coalesce(p.pct_reveillon, 0), 'pct_reveillon7', coalesce(p.pct_reveillon7, p.pct_reveillon, 0), 'desc_semana', dsa);
  op := jsonb_build_object('sem_feriados', to_jsonb(off), 'pct_feriado', pf, 'pct_reveillon', pr, 'pct_reveillon7', pr7, 'desc_semana', dsl);
  depois := nv || op;
  if depois = antes then return jsonb_build_object('mudou', false); end if;
  perform public.aplicar_netos(l, nv, op);
  insert into precos_hist (lancha, por, antes, depois) values (l, auth.uid(), antes, depois);
  return jsonb_build_object('mudou', true, 'prox', null);
end $fn$;

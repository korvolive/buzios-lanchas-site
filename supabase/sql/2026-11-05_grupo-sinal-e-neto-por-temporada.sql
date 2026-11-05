-- 2026-11-05: correções da revisão (pedido de grupo e preço neto). Rodar tudo de uma vez no Supabase.

-- 1) Sinal do grupo: cada lancha recebe pelo menos os 10% dela, e o resto é dividido pelo valor de cada uma.
--    Antes o arredondamento podia deixar uma lancha abaixo dos 10% e o grupo inteiro era recusado
--    (ex.: 2 lanchas de R$ 1.005 com sinal de R$ 201). Agora o mínimo do grupo é a soma dos mínimos de cada lancha,
--    e a mensagem diz o valor.
create or replace function public.lancar_grupo_operador(p_itens jsonb, p_data date, p_horario text, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null, p_sinal numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare g uuid := gen_random_uuid(); n int; it jsonb; i int := 0; ids bigint[] := '{}'; vs numeric[] := '{}'; tot numeric := 0; usado numeric := 0;
        s numeric; cid bigint; pes int := 0; v numeric; mins numeric := 0; sobra numeric;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  n := coalesce(jsonb_array_length(p_itens), 0);
  if n < 2 or n > 5 then raise exception 'O grupo precisa de 2 a 5 lanchas'; end if;
  if (select count(distinct x->>'lancha') from jsonb_array_elements(p_itens) x) <> n then raise exception 'Cada lancha só uma vez no grupo'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    v := coalesce(nullif(it->>'valor','')::numeric, public.preco_tabela(it->>'lancha', p_data, p_horario), 0);
    vs := vs || v; tot := tot + v; mins := mins + ceil(v * 0.1); pes := pes + coalesce((it->>'pessoas')::int, 0);
  end loop;
  if p_sinal is not null and p_sinal > 0 and tot > 0 and p_sinal < mins then
    raise exception 'Sinal do grupo: zero (pré-reserva) ou no mínimo R$ % (10%% de cada lancha)', to_char(mins, 'FM999G999');
  end if;
  sobra := coalesce(p_sinal, 0) - mins;
  for it in select * from jsonb_array_elements(p_itens) loop
    i := i + 1;
    -- sinal já recebido: cada lancha fica com os 10% dela + uma parte do que sobrar, pelo valor de cada uma (a última fica com o resto)
    s := case when p_sinal is null then null when p_sinal = 0 then 0
              when i = n then p_sinal - usado
              else ceil(vs[i] * 0.1) + floor(sobra * vs[i] / nullif(tot, 0)) end;
    usado := usado + coalesce(s, 0);
    cid := public.lancar_pedido_operador(it->>'lancha', p_data, p_horario, (it->>'pessoas')::int, p_nome, p_tel, p_email, p_lang, p_embarque,
                                         nullif(it->>'valor','')::numeric, s, p_hora_ini, p_hora_fim, p_obs);
    ids := ids || cid;
  end loop;
  update public.consultas set grupo = g,
         obs = concat_ws(' · ', '👥 Grupo de ' || pes || ' pessoas em ' || n || ' lanchas', nullif(obs, ''))
   where id = any(ids);
  return jsonb_build_object('grupo', g, 'ids', to_jsonb(ids));
end $function$;

-- 2) Temporada sem preço preenchido usa a anterior, igual ao app: alta sem valor usa média (ou baixa); média sem valor usa baixa.
--    Antes o banco devolvia "sem preço" no neto do dono (precos_neto) enquanto o app mostrava um valor.
create or replace function public._valor_na_data(l text, d date, h text, neto boolean)
returns numeric language plpgsql stable security definer set search_path to 'public' as $function$
declare r public.precos%rowtype; h7 boolean := (h = 'dia'); suf text := case when h = 'dia' then '7' else '' end;
        e jsonb; ev numeric; base text; k text; col text; v numeric; pc numeric := 0; rx numeric := 0; w int; ds jsonb; tenta text;
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

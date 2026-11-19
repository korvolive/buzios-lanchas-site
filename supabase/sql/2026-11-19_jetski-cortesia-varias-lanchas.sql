-- publicar: auto
-- Cortesia de jet ski em várias lanchas do mesmo dono (Rodrigo 2026-11-19): dono com um jet ski e duas lanchas pode ligar
-- a cortesia em cada lancha dele, uma por uma, cada uma com o seu tempo. Continua: só lancha do mesmo dono, começa desligada.
-- jetskis.cortesias = {"<lancha>": minutos}. As colunas antigas cortesia_lancha/cortesia_min passam a ser só entrada antiga
-- (o gatilho junta em cortesias e zera). Idempotente, sem DROP de dados.

alter table public.jetskis add column if not exists cortesias jsonb not null default '{}'::jsonb;

create or replace function public.jetski_cort(c jsonb, l text)
returns int language sql immutable set search_path = public as $$
  select case when coalesce(c->>l, '') ~ '^\d{1,3}$' then (c->>l)::int else 0 end
$$;
grant execute on function public.jetski_cort(jsonb, text) to anon, authenticated;

-- passa o que já existe (Sea-Doo na Les Zuzu, 15 min)
update public.jetskis set cortesias = cortesias || jsonb_build_object(cortesia_lancha, cortesia_min)
 where cortesia_lancha is not null and coalesce(cortesia_min, 0) > 0 and not (cortesias ? cortesia_lancha);

-- regra: cada lancha das cortesias é do mesmo dono do jet ski (até para o administrador); 15 a 180 min, de 15 em 15
create or replace function public.tg_jetski_cortesia_mesmo_dono()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; v text; novo jsonb := '{}'::jsonb;
begin
  -- entrada antiga (cortesia_lancha/cortesia_min): vira uma lancha das cortesias
  if new.cortesia_lancha is not null and coalesce(new.cortesia_min, 0) > 0 then
    new.cortesias := coalesce(new.cortesias, '{}'::jsonb) || jsonb_build_object(new.cortesia_lancha, new.cortesia_min);
  end if;
  new.cortesia_lancha := null; new.cortesia_min := 0;
  if jsonb_typeof(coalesce(new.cortesias, '{}'::jsonb)) <> 'object' then raise exception 'CORTESIA_MIN'; end if;
  for k, v in select * from jsonb_each_text(coalesce(new.cortesias, '{}'::jsonb)) loop
    if not exists (select 1 from public.donos d where d.lancha = k and d.user_id = new.dono) then
      if tg_op = 'UPDATE' and old.cortesias ? k and (old.dono is distinct from new.dono or not exists (select 1 from public.donos d where d.lancha = k and d.user_id = old.dono)) then
        continue;   -- jet ski ou lancha mudou de dono: essa cortesia desliga sozinha
      end if;
      raise exception 'CORTESIA_LANCHA';
    end if;
    if exists (select 1 from public.lanchas l where l.slug = k and l.dados->>'tipo' = 'escuna') then raise exception 'CORTESIA_LANCHA'; end if;
    if v !~ '^\d{1,3}$' or v::int < 15 or v::int > 180 or v::int % 15 <> 0 then raise exception 'CORTESIA_MIN'; end if;
    novo := novo || jsonb_build_object(k, v::int);
  end loop;
  new.cortesias := novo;
  return new;
end $$;
revoke execute on function public.tg_jetski_cortesia_mesmo_dono() from public, anon, authenticated;
create or replace trigger jetski_cortesia_mesmo_dono before insert or update of cortesia_lancha, cortesia_min, cortesias, dono on public.jetskis
  for each row execute function public.tg_jetski_cortesia_mesmo_dono();

update public.jetskis set cortesia_lancha = null where cortesia_lancha is not null;   -- passa pelo gatilho (já está em cortesias)

create or replace function public.tg_donos_cortesia_jetski()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.jetskis j set cortesias = j.cortesias - old.lancha
   where j.cortesias ? old.lancha
     and not exists (select 1 from public.donos d where d.lancha = old.lancha and d.user_id = j.dono);
  return null;
end $$;
revoke execute on function public.tg_donos_cortesia_jetski() from public, anon, authenticated;

-- liga/desliga a cortesia de um jet ski numa lancha (página da lancha): dono do jet ski ou administrador; 0 desliga
create or replace function public.jetski_cortesia(p_jetski uuid, p_lancha text, p_min int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.jetskis;
begin
  if auth.uid() is null then raise exception 'SEM_LOGIN'; end if;
  if not public.pode_jetski(p_jetski) then raise exception 'SEM_PERMISSAO'; end if;
  select * into v from public.jetskis where id = p_jetski for update;
  if v.id is null or nullif(btrim(coalesce(p_lancha, '')), '') is null then raise exception 'CORTESIA_LANCHA'; end if;
  if coalesce(p_min, 0) <= 0 then
    update public.jetskis set cortesias = cortesias - p_lancha, atualizado_em = now() where id = p_jetski returning cortesias into v.cortesias;
  else
    update public.jetskis set cortesias = cortesias || jsonb_build_object(p_lancha, p_min), atualizado_em = now() where id = p_jetski returning cortesias into v.cortesias;
  end if;
  return v.cortesias;
end $$;
revoke execute on function public.jetski_cortesia(uuid, text, int) from public, anon;
grant execute on function public.jetski_cortesia(uuid, text, int) to authenticated;

-- as funções que calculam a cortesia (pedido, Lucas, segurado) passam a olhar a lancha em cortesias.
-- Troca exata de texto na definição atual; confere no fim que nenhuma ficou com a regra antiga.
do $$
declare f record; d text; n text;
begin
  for f in select p.oid, pg_get_functiondef(p.oid) def from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
              and p.proname in ('tg_pedido_jetski', '_jetski_confere', 'tg_pedido_jetski_segurado', 'jetski_cotar') loop
    d := f.def;
    n := replace(d, 'j.cortesia_lancha = new.lancha and coalesce(j.cortesia_min,0) > 0 then j.cortesia_min',
                    'public.jetski_cort(j.cortesias, new.lancha) > 0 then public.jetski_cort(j.cortesias, new.lancha)');
    n := replace(n, 'j.cortesia_lancha = p_lancha and coalesce(j.cortesia_min, 0) > 0 then j.cortesia_min',
                    'public.jetski_cort(j.cortesias, p_lancha) > 0 then public.jetski_cort(j.cortesias, p_lancha)');
    n := replace(n, 'j.cortesia_lancha is distinct from new.lancha', 'public.jetski_cort(j.cortesias, new.lancha) = 0');
    if n <> d then execute n; end if;
  end loop;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
              and p.proname in ('tg_pedido_jetski', '_jetski_confere', 'tg_pedido_jetski_segurado', 'jetski_cotar')
              and p.prosrc like '%j.cortesia_lancha%') then
    raise exception 'cortesia: sobrou função com a regra antiga';
  end if;
end $$;

-- site: devolve as cortesias por lancha (o site antigo continua lendo cortesia_lancha/cortesia_min, que ficam vazios)
drop function if exists public.jetskis_site();
create function public.jetskis_site()
returns table(id uuid, nome text, modelo text, pessoas integer, chave_aprendiz boolean, min_minutos integer, fotos jsonb,
              cortesia_lancha text, cortesia_min integer, tabela jsonb, cortesias jsonb)
language sql stable security definer set search_path = public as $$
  select j.id, j.nome, j.modelo, j.pessoas, j.chave_aprendiz, j.min_minutos, j.fotos, j.cortesia_lancha, j.cortesia_min,
    (select coalesce(jsonb_agg(jsonb_build_object('min', m, 'valor', public.jetski_valor(public.jetski_neto(j, m))) order by m), '[]'::jsonb)
       from generate_series(j.min_minutos, 180, 30) m where public.jetski_neto(j, m) > 0),
    j.cortesias
  from public.jetskis j
  where j.ativo and not j.oculto and (j.neto_hora is not null or j.precos <> '{}'::jsonb)
  order by j.criado_em
$$;
grant execute on function public.jetskis_site() to anon, authenticated;

drop function if exists public.jetskis_site_v2();
create function public.jetskis_site_v2()
returns table(id uuid, nome text, modelo text, pessoas integer, chave_aprendiz boolean, min_minutos integer, fotos jsonb,
              cortesia_lancha text, cortesia_min integer, tabela jsonb, tabelas jsonb, cortesias jsonb)
language sql stable security definer set search_path = public as $$
  select j.id, j.nome, j.modelo, j.pessoas, j.chave_aprendiz, j.min_minutos, j.fotos, j.cortesia_lancha, j.cortesia_min,
    (select coalesce(jsonb_agg(jsonb_build_object('min', m, 'valor', public.jetski_valor(public.jetski_neto(j, m, (now() at time zone 'America/Sao_Paulo')::date))) order by m), '[]'::jsonb)
       from generate_series(30, 180, 30) m where public.jetski_neto(j, m, (now() at time zone 'America/Sao_Paulo')::date) > 0),
    (select jsonb_object_agg(e, (select coalesce(jsonb_agg(jsonb_build_object('min', m, 'valor', public.jetski_valor(public._jetski_neto_ep(j, m, e))) order by m), '[]'::jsonb)
                                   from generate_series(30, 180, 30) m where public._jetski_neto_ep(j, m, e) > 0))
       from unnest(array['baixa','media','alta','reveillon']) e),
    j.cortesias
  from public.jetskis j
  where j.ativo and not j.oculto and (j.neto_hora is not null or j.precos <> '{}'::jsonb)
  order by j.criado_em
$$;
grant execute on function public.jetskis_site_v2() to anon, authenticated;

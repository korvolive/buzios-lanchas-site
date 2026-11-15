-- Jetski como adicional do passeio de lancha (Rodrigo, 2026-11-15)
-- * Não é categoria: aparece na página das lanchas (nunca nas escunas) e entra no pedido da lancha.
-- * Cada jetski tem um dono (pode ser dono de lancha). O dono marca preço, fotos, tempo mínimo e um calendário pequeno.
-- * Tempo de uso de 15 em 15 min, do mínimo do dono até 3 h. O dono vai junto (chave aprendiz); habilitado pilota só se o dono concordar.
-- * Entre usos em lanchas DIFERENTES ficam 15 min livres antes e depois (deslocamento). Na mesma lancha, um logo depois do outro pode.
-- * Valor do cliente = líquido do dono + 15% fixos da Búzios (arredondado de R$ 10 em R$ 10, como na lancha). Cortesia não paga nada.

create table if not exists public.jetskis (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  dono uuid not null references auth.users(id),
  modelo text check (modelo is null or char_length(modelo) <= 60),
  pessoas int not null default 2 check (pessoas between 1 and 3),
  chave_aprendiz boolean not null default true,
  min_minutos int not null default 60 check (min_minutos between 15 and 180 and min_minutos % 15 = 0),
  neto_hora numeric check (neto_hora is null or (neto_hora > 0 and neto_hora <= 10000)),
  precos jsonb not null default '{}'::jsonb check (jsonb_typeof(precos) = 'object'),
  fotos jsonb not null default '[]'::jsonb check (jsonb_typeof(fotos) = 'array' and jsonb_array_length(fotos) <= 15),
  cortesia_lancha text references public.lanchas(slug) on delete set null,
  cortesia_min int not null default 0 check (cortesia_min between 0 and 60 and cortesia_min % 15 = 0),
  ativo boolean not null default true,
  oculto boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.jetskis enable row level security;

create table if not exists public.jetski_usos (
  id bigint generated always as identity primary key,
  jetski uuid not null references public.jetskis(id) on delete cascade,
  data date not null,
  ini time not null,
  fim time not null,
  tipo text not null default 'uso' check (tipo in ('uso','bloqueio')),
  lancha text references public.lanchas(slug) on delete set null,
  bloqueio_id bigint references public.bloqueios(id) on delete cascade,
  pedido_id bigint references public.pedidos(id) on delete set null,
  minutos int,
  cortesia_min int not null default 0,
  valor numeric,
  neto numeric,
  obs text check (obs is null or char_length(obs) <= 200),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  check (fim > ini)
);
alter table public.jetski_usos enable row level security;
create index if not exists jetski_usos_dia on public.jetski_usos (jetski, data);

-- líquido do dono para m minutos (preço próprio do tempo, ou proporcional à hora)
create or replace function public.jetski_neto(j public.jetskis, m int)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when m is null or m < 15 or m > 180 or m % 15 <> 0 then null
    else coalesce(nullif(j.precos->>(m::text),'')::numeric, round(j.neto_hora * m / 60.0)) end
$$;
-- valor do cliente: líquido + 15% da Búzios (arredondado de 10 em 10)
create or replace function public.jetski_valor(neto numeric)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when neto is null or neto <= 0 then null else neto + round(neto * 0.15 / 10) * 10 end
$$;

-- conferência de horário: mesma lancha encosta; lancha diferente (ou bloqueio do dono) pede 15 min de folga
create or replace function public.jetski_choca(p_jetski uuid, p_data date, p_ini time, p_fim time, p_lancha text, p_ignora bigint default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.jetski_usos u
    where u.jetski = p_jetski and u.data = p_data and u.id is distinct from p_ignora
      and (case when u.tipo = 'uso' and p_lancha is not null and u.lancha = p_lancha
                then u.ini < p_fim and u.fim > p_ini
                else u.ini < p_fim + interval '15 minutes' and u.fim + interval '15 minutes' > p_ini end)
  )
$$;
revoke all on function public.jetski_choca(uuid, date, time, time, text, bigint) from public, anon, authenticated;

create or replace function public.tg_jetski_uso_confere()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.tipo = 'bloqueio' then new.lancha := null; end if;
  if public.jetski_choca(new.jetski, new.data, new.ini, new.fim, new.lancha, new.id) then
    raise exception 'JETSKI_OCUPADO';
  end if;
  return new;
end $$;
create or replace trigger jetski_uso_confere before insert or update on public.jetski_usos
  for each row execute function public.tg_jetski_uso_confere();

-- quem pode mexer no jetski: o dono dele ou o administrador
create or replace function public.pode_jetski(j uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.e_admin() or exists (select 1 from public.jetskis x where x.id = j and x.dono = auth.uid())
$$;

-- leitura: público vê só os jetskis à venda (o site usa jetskis_site); dono e administrador veem os seus
do $p$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='jetskis' and policyname='jetskis: dono e admin leem') then
  create policy "jetskis: dono e admin leem" on public.jetskis for select using (dono = auth.uid() or public.e_admin());
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='jetski_usos' and policyname='jetski_usos: dono e admin leem') then
  create policy "jetski_usos: dono e admin leem" on public.jetski_usos for select using (public.pode_jetski(jetski));
end if; end $p$;
-- escrita só pelas funções abaixo (nenhuma política de insert/update/delete)

-- salvar (criar: só administrador; mudar: dono ou administrador)
create or replace function public.jetski_salvar(p jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid := nullif(p->>'id','')::uuid; v public.jetskis; adm boolean := public.e_admin();
  k text; val text; fotos jsonb; cl text; cm int;
begin
  if auth.uid() is null then raise exception 'SEM_LOGIN'; end if;
  if v_id is null then
    if not adm then raise exception 'SO_ADMIN'; end if;
    if nullif(p->>'dono','') is null then raise exception 'SEM_DONO'; end if;
    insert into public.jetskis(nome, dono) values (left(coalesce(nullif(trim(p->>'nome'),''),'Jetski'),60), (p->>'dono')::uuid) returning id into v_id;
  elsif not public.pode_jetski(v_id) then raise exception 'SEM_PERMISSAO';
  end if;
  select * into v from public.jetskis where id = v_id for update;
  if p ? 'nome' then v.nome := left(coalesce(nullif(trim(p->>'nome'),''), v.nome), 60); end if;
  if p ? 'modelo' then v.modelo := nullif(left(trim(coalesce(p->>'modelo','')),60),''); end if;
  if p ? 'pessoas' then v.pessoas := greatest(1, least(3, coalesce((p->>'pessoas')::int, 2))); end if;
  if p ? 'chave_aprendiz' then v.chave_aprendiz := coalesce((p->>'chave_aprendiz')::boolean, true); end if;
  if p ? 'min_minutos' then v.min_minutos := (p->>'min_minutos')::int; end if;
  if p ? 'neto_hora' then v.neto_hora := nullif(p->>'neto_hora','')::numeric; end if;
  if p ? 'precos' then
    if jsonb_typeof(p->'precos') <> 'object' then raise exception 'PRECOS'; end if;
    for k, val in select * from jsonb_each_text(p->'precos') loop
      if k !~ '^\d{2,3}$' or k::int < 15 or k::int > 180 or k::int % 15 <> 0 then raise exception 'PRECOS'; end if;
      if val is not null and val <> '' and (val::numeric <= 0 or val::numeric > 30000) then raise exception 'PRECOS'; end if;
    end loop;
    select coalesce(jsonb_object_agg(key, to_jsonb(value::numeric)), '{}'::jsonb) into v.precos
      from jsonb_each_text(p->'precos') where value is not null and value <> '';
  end if;
  if p ? 'fotos' then
    fotos := p->'fotos';
    if jsonb_typeof(fotos) <> 'array' or jsonb_array_length(fotos) > 15 then raise exception 'FOTOS'; end if;
    if exists (select 1 from jsonb_array_elements_text(fotos) f
               where f !~ ('^https://sqoperylsqcbcjpcrlnp\.supabase\.co/storage/v1/object/public/lanchas/jetski-' || v_id::text || '/[A-Za-z0-9._-]+$')) then
      raise exception 'FOTOS'; end if;
    v.fotos := fotos;
  end if;
  if p ? 'cortesia_lancha' or p ? 'cortesia_min' then
    cl := case when p ? 'cortesia_lancha' then nullif(p->>'cortesia_lancha','') else v.cortesia_lancha end;
    cm := case when p ? 'cortesia_min' then coalesce((p->>'cortesia_min')::int, 0) else v.cortesia_min end;
    -- cortesia só numa lancha (não escuna) do próprio dono do jetski
    if cl is not null and not (adm or exists (select 1 from public.donos d where d.lancha = cl and d.user_id = v.dono)) then raise exception 'CORTESIA_LANCHA'; end if;
    if cl is not null and exists (select 1 from public.lanchas l where l.slug = cl and l.dados->>'tipo' = 'escuna') then raise exception 'CORTESIA_LANCHA'; end if;
    v.cortesia_lancha := cl; v.cortesia_min := case when cl is null then 0 else cm end;
  end if;
  if p ? 'oculto' then v.oculto := coalesce((p->>'oculto')::boolean, true); end if;
  if adm and p ? 'ativo' then v.ativo := coalesce((p->>'ativo')::boolean, true); end if;
  if adm and p ? 'dono' and nullif(p->>'dono','') is not null then v.dono := (p->>'dono')::uuid; end if;
  update public.jetskis set nome = v.nome, modelo = v.modelo, pessoas = v.pessoas, chave_aprendiz = v.chave_aprendiz,
    min_minutos = v.min_minutos, neto_hora = v.neto_hora, precos = v.precos, fotos = v.fotos,
    cortesia_lancha = v.cortesia_lancha, cortesia_min = v.cortesia_min, oculto = v.oculto, ativo = v.ativo, dono = v.dono,
    atualizado_em = now()
  where id = v_id;
  return v_id;
end $$;
revoke all on function public.jetski_salvar(jsonb) from public, anon;
grant execute on function public.jetski_salvar(jsonb) to authenticated;

-- calendário do dono: bloquear um horário/dia ou anotar um uso combinado fora do site
create or replace function public.jetski_marcar(p_jetski uuid, p_data date, p_ini time, p_fim time, p_tipo text default 'bloqueio', p_lancha text default null, p_obs text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint;
begin
  if auth.uid() is null or not public.pode_jetski(p_jetski) then raise exception 'SEM_PERMISSAO'; end if;
  if p_tipo not in ('uso','bloqueio') then raise exception 'TIPO'; end if;
  if p_data < current_date or p_data > current_date + 730 then raise exception 'DATA'; end if;
  if p_fim <= p_ini then raise exception 'HORARIO'; end if;
  if p_lancha is not null and exists (select 1 from public.lanchas l where l.slug = p_lancha and l.dados->>'tipo' = 'escuna') then raise exception 'SO_LANCHA'; end if;
  insert into public.jetski_usos(jetski, data, ini, fim, tipo, lancha, obs, minutos)
    values (p_jetski, p_data, p_ini, p_fim, p_tipo, case when p_tipo = 'uso' then p_lancha end, left(p_obs, 200),
            (extract(epoch from (p_fim - p_ini)) / 60)::int)
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.jetski_marcar(uuid, date, time, time, text, text, text) from public, anon;
grant execute on function public.jetski_marcar(uuid, date, time, time, text, text, text) to authenticated;

-- site: jetskis à venda, com a tabela de valores do cliente (sem mostrar o líquido do dono)
create or replace function public.jetskis_site()
returns table (id uuid, nome text, modelo text, pessoas int, chave_aprendiz boolean, min_minutos int, fotos jsonb,
               cortesia_lancha text, cortesia_min int, tabela jsonb)
language sql stable security definer set search_path to 'public' as $$
  select j.id, j.nome, j.modelo, j.pessoas, j.chave_aprendiz, j.min_minutos, j.fotos, j.cortesia_lancha, j.cortesia_min,
    (select coalesce(jsonb_agg(jsonb_build_object('min', m, 'valor', public.jetski_valor(public.jetski_neto(j, m))) order by m), '[]'::jsonb)
       from generate_series(j.min_minutos, 180, 15) m where public.jetski_neto(j, m) > 0)
  from public.jetskis j
  where j.ativo and not j.oculto and (j.neto_hora is not null or j.precos <> '{}'::jsonb)
  order by j.criado_em
$$;
grant execute on function public.jetskis_site() to anon, authenticated;

-- site: horários já ocupados no dia (sem nomes nem valores), para mostrar só inícios livres
create or replace function public.jetski_ocupado(p_data date)
returns table (jetski uuid, ini time, fim time, lancha text, tipo text)
language sql stable security definer set search_path to 'public' as $$
  select u.jetski, u.ini, u.fim, u.lancha, u.tipo from public.jetski_usos u
  join public.jetskis j on j.id = u.jetski
  where u.data = p_data and j.ativo and not j.oculto
$$;
grant execute on function public.jetski_ocupado(date) to anon, authenticated;

-- fotos no mesmo bucket das lanchas, pasta jetski-<id>; só o dono do jetski ou o administrador envia e apaga
create or replace function public.pode_editar_jetski_pasta(pasta text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case when pasta ~ '^jetski-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.pode_jetski(substr(pasta, 8)::uuid) else false end
$$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='lanchas: dono do jetski envia') then
  create policy "lanchas: dono do jetski envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'lanchas' and public.pode_editar_jetski_pasta((storage.foldername(name))[1]));
end if; end $p$;

-- registro de auditoria (mesma função dos pedidos), se existir
do $$ begin
  if exists (select 1 from pg_proc where proname = '_auditar' and pronamespace = 'public'::regnamespace) then
    execute 'create or replace trigger zz_auditar after insert or update or delete on public.jetski_usos for each row execute function public._auditar()';
    execute 'create or replace trigger zz_auditar after insert or update or delete on public.jetskis for each row execute function public._auditar()';
  end if;
end $$;

-- (2ª parte, aplicada em seguida) desmarcar sem apagar: a linha fica no histórico com removido_em
alter table public.jetski_usos add column if not exists removido_em timestamptz;
create or replace function public.jetski_choca(p_jetski uuid, p_data date, p_ini time, p_fim time, p_lancha text, p_ignora bigint default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.jetski_usos u
    where u.jetski = p_jetski and u.data = p_data and u.id is distinct from p_ignora and u.removido_em is null
      and (case when u.tipo = 'uso' and p_lancha is not null and u.lancha = p_lancha
                then u.ini < p_fim and u.fim > p_ini
                else u.ini < p_fim + interval '15 minutes' and u.fim + interval '15 minutes' > p_ini end)
  )
$$;
revoke all on function public.jetski_choca(uuid, date, time, time, text, bigint) from public, anon, authenticated;
create or replace function public.tg_jetski_uso_confere()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.tipo = 'bloqueio' then new.lancha := null; end if;
  if new.removido_em is null and public.jetski_choca(new.jetski, new.data, new.ini, new.fim, new.lancha, new.id) then
    raise exception 'JETSKI_OCUPADO';
  end if;
  return new;
end $$;
create or replace function public.jetski_desmarcar(p_id bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare u public.jetski_usos;
begin
  select * into u from public.jetski_usos where id = p_id and removido_em is null;
  if u.id is null then return false; end if;
  if auth.uid() is null or not public.pode_jetski(u.jetski) then raise exception 'SEM_PERMISSAO'; end if;
  if (u.pedido_id is not null or u.bloqueio_id is not null) and not public.e_admin() then raise exception 'DO_PASSEIO'; end if;
  update public.jetski_usos set removido_em = now() where id = p_id;
  return true;
end $$;
revoke all on function public.jetski_desmarcar(bigint) from public, anon;
grant execute on function public.jetski_desmarcar(bigint) to authenticated;
create or replace function public.jetski_ocupado(p_data date)
returns table (jetski uuid, ini time, fim time, lancha text, tipo text)
language sql stable security definer set search_path to 'public' as $$
  select u.jetski, u.ini, u.fim, u.lancha, u.tipo from public.jetski_usos u
  join public.jetskis j on j.id = u.jetski
  where u.data = p_data and u.removido_em is null and j.ativo and not j.oculto
$$;
grant execute on function public.jetski_ocupado(date) to anon, authenticated;

-- (3ª parte) venda de meia em meia hora, mínimo 1 h (Rodrigo 2026-11-15); 15 min só como cortesia
alter table public.jetskis alter column min_minutos set default 60;
alter table public.jetskis add constraint jetskis_min_meia_hora check (min_minutos between 60 and 180 and min_minutos % 30 = 0);
create or replace function public.jetski_neto(j public.jetskis, m int)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when m is null or m < greatest(60, j.min_minutos) or m > 180 or m % 30 <> 0 then null
    else coalesce(nullif(j.precos->>(m::text),'')::numeric, round(j.neto_hora * m / 60.0)) end
$$;
create or replace function public.jetskis_site()
returns table (id uuid, nome text, modelo text, pessoas int, chave_aprendiz boolean, min_minutos int, fotos jsonb,
               cortesia_lancha text, cortesia_min int, tabela jsonb)
language sql stable security definer set search_path to 'public' as $$
  select j.id, j.nome, j.modelo, j.pessoas, j.chave_aprendiz, j.min_minutos, j.fotos, j.cortesia_lancha, j.cortesia_min,
    (select coalesce(jsonb_agg(jsonb_build_object('min', m, 'valor', public.jetski_valor(public.jetski_neto(j, m))) order by m), '[]'::jsonb)
       from generate_series(j.min_minutos, 180, 30) m where public.jetski_neto(j, m) > 0)
  from public.jetskis j
  where j.ativo and not j.oculto and (j.neto_hora is not null or j.precos <> '{}'::jsonb)
  order by j.criado_em
$$;
grant execute on function public.jetskis_site() to anon, authenticated;

-- (4ª parte) tempo proporcional arredondado de R$ 10 em R$ 10
create or replace function public.jetski_neto(j public.jetskis, m int)
returns numeric language sql immutable set search_path to 'public' as $$
  select case when m is null or m < greatest(60, j.min_minutos) or m > 180 or m % 30 <> 0 then null
    else coalesce(nullif(j.precos->>(m::text),'')::numeric, round(j.neto_hora * m / 600.0) * 10) end
$$;

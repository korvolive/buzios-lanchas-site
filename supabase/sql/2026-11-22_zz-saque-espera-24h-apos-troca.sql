-- publicar: auto
-- Saque pelo app espera 24 h depois de trocar o telefone da conta ou a chave Pix (Rodrigo 2026-11-22, "pode").
-- É o que os bancos fazem: se a troca foi golpe, o dono tem tempo de avisar antes de o dinheiro sair.
-- O administrador continua sem trava e pode liberar antes, na ficha da pessoa, depois de confirmar que é ela
-- (botão só aparece durante a espera). Junta com o limite de 3 por dia no mesmo gatilho (a0_limite_dia). Idempotente.

create table if not exists public.saque_liberacoes (
  user_id uuid primary key,
  em timestamptz not null default now(),
  por uuid
);
alter table public.saque_liberacoes enable row level security;
revoke all on public.saque_liberacoes from anon, authenticated;

-- fim da espera (null = pode sacar). Troca liberada pelo administrador depois dela não conta.
create or replace function public._saque_espera_ate(u uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare ult timestamptz; lib timestamptz;
begin
  select max(x) into ult from (
    select max(t.em) x from public.telefones_trocados t where t.user_id = u
    union all
    select max(s.criado_em) from public.avisos_seguranca s where s.user_id = u and s.tipo = 'pix') q;
  if ult is null or ult <= now() - interval '24 hours' then return null; end if;
  select l.em into lib from public.saque_liberacoes l where l.user_id = u;
  if lib is not null and lib >= ult then return null; end if;
  return ult + interval '24 hours';
end $$;
revoke all on function public._saque_espera_ate(uuid) from public, anon, authenticated;

create or replace function public.saque_espera(uid uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'so_admin'; end if;
  return public._saque_espera_ate(uid);
end $$;
revoke all on function public.saque_espera(uuid) from public, anon;
grant execute on function public.saque_espera(uuid) to authenticated;

create or replace function public.liberar_saque(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'so_admin'; end if;
  insert into public.saque_liberacoes (user_id, em, por) values (uid, now(), auth.uid())
  on conflict (user_id) do update set em = now(), por = auth.uid();
end $$;
revoke all on function public.liberar_saque(uuid) from public, anon;
grant execute on function public.liberar_saque(uuid) to authenticated;

create or replace function public.tg_saque_limite_dia() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admins where user_id = new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('saque_dia:' || new.user_id::text));
  if public._saque_espera_ate(new.user_id) is not null then
    raise exception 'espera_troca' using errcode = 'P0001';
  end if;
  if (select count(*) from public.saques
       where user_id = new.user_id and status <> 'falhou'
         and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) >= 3 then
    raise exception 'limite_dia' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.tg_saque_limite_dia() from public, anon, authenticated;

-- publicar: auto
-- Limite de 3 saques por dia não vale para o administrador (Rodrigo 2026-11-21: "posso sacar na hora que eu quiser, quantas vezes eu quiser").
-- O saque da conta da Búzios (sacar_buzios, tabela saques_buzios) já não tinha limite. Idempotente.
create or replace function public.tg_saque_limite_dia() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admins where user_id = new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('saque_dia:' || new.user_id::text));
  if (select count(*) from public.saques
       where user_id = new.user_id and status <> 'falhou'
         and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) >= 3 then
    raise exception 'limite_dia' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.tg_saque_limite_dia() from public, anon, authenticated;

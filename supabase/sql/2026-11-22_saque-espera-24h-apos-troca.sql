-- publicar: auto
-- Saque pelo app espera 24 h depois de trocar o telefone da conta ou a chave Pix (Rodrigo 2026-11-22, "pode").
-- É o que os bancos fazem: se a troca foi golpe, o dono tem tempo de avisar antes de o dinheiro sair.
-- O administrador continua sem trava. Junta com o limite de 3 por dia no mesmo gatilho (a0_limite_dia). Idempotente.
create or replace function public.tg_saque_limite_dia() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admins where user_id = new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('saque_dia:' || new.user_id::text));
  if exists (select 1 from public.telefones_trocados t where t.user_id = new.user_id and t.em > now() - interval '24 hours')
     or exists (select 1 from public.avisos_seguranca s where s.user_id = new.user_id and s.tipo = 'pix' and s.criado_em > now() - interval '24 hours') then
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

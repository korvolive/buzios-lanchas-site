-- Teto de R$ 5.000 em 24 h no Transferir Saldo (todos os administradores juntos; as que falharam não contam).
-- Aprovado pelo Rodrigo em 2026-11-14; aplicado no banco pelo conector nesse dia.
create or replace function public._transferencia_teto() returns trigger
language plpgsql security definer set search_path = public as $$
declare tot numeric;
begin
  perform pg_advisory_xact_lock(hashtext('transferencias_saldo:teto'));
  select coalesce(sum(valor), 0) into tot from public.transferencias_saldo
   where criado_em > now() - interval '24 hours' and status is distinct from 'falhou';
  if tot + new.valor > 5000 then raise exception 'teto diario de transferencias (R$ 5.000 em 24 h)'; end if;
  return new;
end $$;
revoke execute on function public._transferencia_teto() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='a_teto_diario' and tgrelid='public.transferencias_saldo'::regclass) then
    create trigger a_teto_diario before insert on public.transferencias_saldo for each row execute function public._transferencia_teto();
  end if;
end $$;

-- Convite do Google no app e search_path (colado pelo Rodrigo em 2026-11-14)
grant select on public.google_convites to authenticated;
alter function public._auditoria_trava() set search_path = public;
alter function public._epoca(date) set search_path = public;

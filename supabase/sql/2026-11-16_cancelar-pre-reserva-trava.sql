-- 2026-11-16 (revisão, aplicado no SQL Editor): cancelar_pre_reserva trava passeio, anotação e pedidos antes de conferir
-- sinal/comprovante/pagamento, para um comprovante ou confirmação de pagamento no mesmo instante não passar.
-- A função antiga virou _cancelar_pre_reserva_base (sem execução para anon/authenticated) e é chamada pela nova.
alter function public.cancelar_pre_reserva(bigint) rename to _cancelar_pre_reserva_base;
revoke all on function public._cancelar_pre_reserva_base(bigint) from public, anon, authenticated;
create or replace function public.cancelar_pre_reserva(bid bigint)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem permissão'; end if;
  perform 1 from public.bloqueios where id = bid for update;
  perform 1 from public.anotacoes where bloqueio_id = bid for update;
  perform 1 from public.pedidos where bloqueio_id = bid for update;
  perform public._cancelar_pre_reserva_base(bid);
end $function$;
revoke all on function public.cancelar_pre_reserva(bigint) from public, anon;
grant execute on function public.cancelar_pre_reserva(bigint) to authenticated, service_role;
notify pgrst, 'reload schema';

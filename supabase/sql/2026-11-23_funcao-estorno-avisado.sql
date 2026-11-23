-- publicar: auto
-- 23/11/2026: marca o aviso de estorno enviado ao cliente (painel-worker/actions/estorno-aviso.mjs chama pelo painel, sessão admin).
-- Só administrador; só preenche o que ainda está vazio. Idempotente.
create or replace function public.estorno_avisado(p_pedido bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.e_admin() then raise exception 'so admin'; end if;
  update public.pagamentos_asaas set estorno_aviso_em = now() where pedido = p_pedido and estorno_aviso_em is null;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.estorno_avisado(bigint) from public, anon;
grant execute on function public.estorno_avisado(bigint) to authenticated;
-- pedido 96 (Felipe): aviso enviado 23/11 14:10Z
update public.pagamentos_asaas set estorno_aviso_em = '2026-11-23T14:10:29Z' where pedido = 96 and estorno_aviso_em is null;

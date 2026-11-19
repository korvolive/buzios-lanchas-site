-- publicar: auto
-- Remove a reserva de teste do Pix sem vencimento (pedido 82, Miss Bardot 15/03/2027 manhã), autorizado pelo Rodrigo em 19/11 17h47.
-- Só apaga se ainda for a do pedido de teste já cancelado. Idempotente.
do $$
begin
  if exists (select 1 from public.pedidos where id = 82 and status = 'cancelado' and bloqueio_id = 222)
     and exists (select 1 from public.bloqueios where id = 222 and lancha = 'miss-bardot' and data = '2027-03-15') then
    update public.pedidos set bloqueio_id = null where id = 82;
    delete from public.anotacoes where bloqueio_id = 222;
    delete from public.bloqueios where id = 222;
  end if;
end $$;

-- O cliente pode mandar o comprovante também com a reserva já confirmada (Rodrigo 2026-11-01).
-- Antes só aceitava pedido 'pendente'; recusado/cancelado continuam de fora.
CREATE OR REPLACE FUNCTION public.enviar_comprovante(pid bigint, caminho text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if caminho is null or split_part(caminho, '/', 1) <> auth.uid()::text then
    raise exception 'arquivo invalido';
  end if;
  update public.pedidos set comprovante = caminho, comprovante_em = now(), atualizado_em = now()
  where id = pid and cliente = auth.uid() and status in ('pendente', 'aprovado');
  if not found then raise exception 'pedido nao encontrado'; end if;
end $function$;

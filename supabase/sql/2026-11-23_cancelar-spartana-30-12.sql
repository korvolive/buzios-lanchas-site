-- publicar: auto
-- Rodrigo 23/11 (cartão de decisão "Cancelar e devolver tudo"): cliente desistiu do passeio da Spartana em 30/12 à tarde (pedido 96).
-- O pedido já está cancelado e o cartão foi estornado inteiro no Asaas. Aqui só libera a data no site e no painel.
-- Idempotente: só apaga se o passeio ainda existir e o pedido estiver cancelado.
delete from public.bloqueios b
 where b.id = 241 and b.lancha = 'spartana' and b.data = date '2026-12-30'
   and exists (select 1 from public.pedidos p where p.id = 96 and p.status = 'cancelado');

-- publicar: auto
-- Cliente desistiu do passeio da Spartana em 30/12 (pedido 96). Rodrigo escolheu estornar o sinal (cartão do thread, 22/11).
-- Mesmo efeito de apagar o passeio no painel: o gatilho cancela_pedido_do_passeio marca o pedido como cancelado e a data volta a vender.
-- Idempotente: se o passeio já foi apagado, não faz nada.
delete from public.bloqueios where id = 241 and lancha = 'spartana' and data = '2026-12-30';
update public.pedidos set motivo = 'cliente' where id = 96 and status = 'cancelado' and motivo is distinct from 'cliente';

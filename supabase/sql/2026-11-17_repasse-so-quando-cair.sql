-- publicar: auto
-- Repasse ao dono só quando o dinheiro do pedido cai na Búzios (Rodrigo 2026-11-17). Idempotente.
-- A função asaas guarda se o cartão foi antecipado (antecipação já creditada conta como dinheiro no saldo)
-- e o estado da antecipação para a planilha de vendas.
alter table public.pagamentos_asaas add column if not exists antecipada boolean;
alter table public.pagamentos_asaas add column if not exists antecipacao jsonb;

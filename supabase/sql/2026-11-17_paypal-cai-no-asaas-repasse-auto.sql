-- publicar: auto
-- PayPal cai no Asaas e a parte do dono sai sozinha (Rodrigo 2026-11-17).
-- O saque automático do PayPal passa a cair na conta Asaas da Búzios. A função asaas (cron a cada 10 min) registra aqui
-- cada entrada do extrato do Asaas que veio do PayPal e, na ordem em que os clientes pagaram, manda a parte do dono
-- dos pedidos que esse dinheiro já cobre (Miss Bardot fica na Búzios). Idempotente.
create table if not exists public.paypal_entradas (
  tx_id text primary key,              -- id da movimentação no extrato do Asaas
  valor numeric not null,
  data date,
  tipo text,
  visto_em timestamptz not null default now()
);
alter table public.paypal_entradas enable row level security;  -- sem políticas: só o servidor (service role) lê e grava
revoke all on public.paypal_entradas from anon, authenticated;

alter table public.asaas_config add column if not exists paypal_auto boolean not null default true;   -- desliga: update asaas_config set paypal_auto = false
alter table public.asaas_config add column if not exists paypal_desde timestamptz;                    -- entradas do PayPal contadas a partir daqui
alter table public.asaas_config add column if not exists paypal_pedidos_desde timestamptz;            -- pedidos pagos no PayPal a partir daqui entram na fila
-- o saque do PayPal foi apontado para o Asaas em 17/11/2026 ~17:50 de Brasília; o pedido pago hoje no PayPal ainda estava no saldo do PayPal
update public.asaas_config set paypal_desde = coalesce(paypal_desde, '2026-11-17 20:45:00+00'),
  paypal_pedidos_desde = coalesce(paypal_pedidos_desde, '2026-11-17 03:00:00+00') where id = 1;

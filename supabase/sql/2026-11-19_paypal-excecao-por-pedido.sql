-- publicar: auto
-- Liberação manual de PayPal por pedido, mesmo com menos de 3 dias (ex. cliente estrangeiro cujo Pix o Mercado Pago recusa).
-- Só o servidor/admin marca. Idempotente.
alter table public.pedidos add column if not exists pp_excecao boolean not null default false;
revoke update (pp_excecao) on public.pedidos from anon, authenticated;

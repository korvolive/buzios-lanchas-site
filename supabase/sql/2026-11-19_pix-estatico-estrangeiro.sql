-- publicar: auto
-- Pix sem vencimento (QR estático do Asaas, com valor) para estrangeiro (2026-11-19): o Mercado Pago da Argentina recusou o QR
-- com vencimento (cobv). Uma linha por pedido; o aviso do Asaas acha o pedido pelo pixQrCodeId (ou pelo valor exato, se o
-- cliente digitou a chave) e registra o pagamento como Pix normal. Só o servidor lê/escreve. Idempotente.
create table if not exists public.pix_estatico (
  pedido bigint primary key references public.pedidos(id) on delete cascade,
  valor numeric not null,
  qr_id text not null,
  payload text not null,
  img text,
  chave text,
  pago_asaas text,
  criado_em timestamptz not null default now()
);
create index if not exists pix_estatico_qr on public.pix_estatico (qr_id);
alter table public.pix_estatico enable row level security;
revoke all on public.pix_estatico from anon, authenticated;
alter table public.pagamentos_asaas add column if not exists pix_qr text;

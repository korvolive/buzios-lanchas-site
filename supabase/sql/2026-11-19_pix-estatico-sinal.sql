-- publicar: auto
-- Sinal sem a taxa do Pix no QR sem vencimento (o valor do QR já inclui a taxa). Idempotente.
alter table public.pix_estatico add column if not exists sinal numeric;

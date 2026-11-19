-- publicar: auto
-- Aviso ao administrador quando o cartão de lancha parceira ainda não caiu a 2 dias do passeio (Rodrigo 2026-11-19)
alter table public.pedidos add column if not exists aviso_cartao_em timestamptz;

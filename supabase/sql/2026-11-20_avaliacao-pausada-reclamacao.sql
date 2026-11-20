-- publicar: auto
-- Cliente que reclamou não recebe pedido de avaliação (Rodrigo 2026-11-20).
-- O servidor (vigia) grava aqui o passeio quando percebe reclamação na conversa; o aviso no celular, o e-mail
-- e o WhatsApp de avaliação deixam de sair para esse passeio. Só o servidor (service_role) lê e escreve.
-- Idempotente.
create table if not exists public.avaliacao_pausada (
  bloqueio_id bigint primary key references public.bloqueios(id) on delete cascade,
  motivo text,
  criado_em timestamptz not null default now()
);
alter table public.avaliacao_pausada enable row level security;
revoke all on public.avaliacao_pausada from anon, authenticated;

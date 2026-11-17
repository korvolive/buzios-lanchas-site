-- publicar: auto
-- Aviso "Você recebeu R$ X" (Rodrigo 2026-11-17): a função asaas lê o extrato da subconta de cada dono/vendedor
-- e avisa por push cada entrada que já caiu no saldo disponível. Esta tabela evita avisar duas vezes. Idempotente.
create table if not exists public.avisos_entrada (
  tx_id text primary key,
  user_id uuid not null,
  valor numeric(12,2) not null,
  tipo text,
  ref text,
  avisado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_entrada_user on public.avisos_entrada (user_id, criado_em);
create index if not exists avisos_entrada_ref on public.avisos_entrada (user_id, ref);
alter table public.avisos_entrada enable row level security;
-- sem políticas: só a função do servidor (chave de serviço) lê e grava
revoke all on public.avisos_entrada from anon, authenticated;

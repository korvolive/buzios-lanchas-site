-- Búzios Lanchas: preparação do Asaas antes da homologação do BaaS (Rodrigo 2026-10-30). Só cria o que falta; não liga nada.
-- 1) chave de cada subconta (o Asaas só mostra na criação). Guardada CIFRADA pela função asaas (AES-GCM com o segredo
--    ASAAS_CHAVES_SEGREDO das Edge Functions): no banco fica só "v1:<iv>:<cifra>", nunca a chave aberta.
--    Se a chave se perder, a conta principal gera outra no Asaas (Minhas contas > subconta).
create table if not exists public.asaas_chaves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  api_key text not null check (api_key like 'v1:%'),
  criado_em timestamptz not null default now()
);
alter table public.asaas_chaves enable row level security;
revoke all on public.asaas_chaves from anon, authenticated;
grant all on public.asaas_chaves to service_role;

-- 2) saque recusado: o motivo aparece para o dono/vendedor (ex.: a chave Pix não é do CPF/CNPJ dele)
alter table public.saques add column if not exists motivo text;

-- 3) registro de cada pergunta do Asaas ao webhook de validação de saques (função asaas-saques) e da resposta dada
create table if not exists public.asaas_validacoes (
  id bigint generated always as identity primary key,
  tipo text not null,             -- TRANSFER, PIX_REFUND, BILL, PAYMENT_SPLIT...
  asaas_id text,
  valor numeric,
  decisao text not null check (decisao in ('APPROVED','REFUSED')),
  motivo text,
  corpo jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists asaas_validacoes_id on public.asaas_validacoes (asaas_id);
alter table public.asaas_validacoes enable row level security;
revoke all on public.asaas_validacoes from anon, authenticated;
grant all on public.asaas_validacoes to service_role;
drop policy if exists asaas_validacoes_admin on public.asaas_validacoes;
create policy asaas_validacoes_admin on public.asaas_validacoes for select to authenticated using (public.e_admin());
grant select on public.asaas_validacoes to authenticated;

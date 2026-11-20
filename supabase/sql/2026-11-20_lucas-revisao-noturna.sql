-- publicar: auto
-- Revisão noturna das conversas do Lucas (Rodrigo 2026-11-20, créditos da API do Claude).
-- A VPS deixa aqui, de madrugada, as conversas do dia JÁ MASCARADAS (sem nome, telefone, e-mail ou documento: C1, C2...).
-- O workflow claude-noturno.yml (tarefa "lucas") lê, pede a análise ao Claude, grava o resultado em "saida" e APAGA a "entrada".
-- De manhã a VPS pega a "saida", manda o resumo curto ao Rodrigo e os achados ao Diretor (canal direto). Claude não muda o Lucas.
-- Só o servidor acessa (service_role / API de administração). Resultado guardado 90 dias. Idempotente.
create table if not exists public.lucas_revisao (
  dia date primary key,
  status text not null default 'pendente' check (status in ('pendente', 'analisada', 'entregue', 'erro')),
  entrada jsonb,
  saida jsonb,
  erro text,
  criado_em timestamptz not null default now(),
  analisado_em timestamptz,
  entregue_em timestamptz
);
alter table public.lucas_revisao enable row level security;
revoke all on public.lucas_revisao from anon, authenticated;
grant select, insert, update, delete on public.lucas_revisao to service_role;

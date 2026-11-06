-- Valor combinado com o dono em cada passeio (Rodrigo 2026-11-06). Vazio = vale a tabela.
alter table public.anotacoes add column if not exists neto_dono numeric;

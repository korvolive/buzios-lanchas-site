-- publicar: auto
-- Planilha de vendas do administrador (Rodrigo 2026-11-17): cada pagamento do Asaas guarda quando o dinheiro cai na conta.
-- Preenchido pela função asaas (ação "planilha" e aviso do Asaas): valor líquido depois da taxa, data prevista de liberação
-- (cartão), data em que caiu e as parcelas do cartão parcelado. Só o servidor grava; o painel lê pela função. Idempotente.
alter table public.pagamentos_asaas add column if not exists liquido numeric(12,2);
alter table public.pagamentos_asaas add column if not exists credito_previsto date;
alter table public.pagamentos_asaas add column if not exists credito_em date;
alter table public.pagamentos_asaas add column if not exists parcelas jsonb;
alter table public.pagamentos_asaas add column if not exists conferido_em timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pagamentos_asaas_liquido_nao_negativo') then
    alter table public.pagamentos_asaas add constraint pagamentos_asaas_liquido_nao_negativo check (liquido is null or liquido >= 0);
  end if;
end $$;

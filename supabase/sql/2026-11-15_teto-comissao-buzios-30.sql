-- Teto da comissão da Búzios Lanchas na tabela de valores: de 20% para 30% do líquido do dono (Rodrigo 2026-11-15).
-- Não muda o padrão de 10% nem os valores atuais das lanchas. Rodado pelo conector em 2026-11-15.
alter table public.precos_neto drop constraint precos_neto_taxa_pct_ck;
alter table public.precos_neto add constraint precos_neto_taxa_pct_ck check (taxa_pct is null or (taxa_pct >= 0 and taxa_pct <= 30));
alter table public.pedidos drop constraint pedidos_comissao_pct_check;
alter table public.pedidos add constraint pedidos_comissao_pct_check check (comissao_pct >= 0 and comissao_pct <= 30);

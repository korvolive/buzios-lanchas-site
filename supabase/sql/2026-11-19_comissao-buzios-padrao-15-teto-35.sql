-- publicar: auto
-- Comissão da Búzios Lanchas (Rodrigo 2026-11-19): padrão de 10% para 15% do líquido do dono e teto de 30% para 35%.
-- Só vale para embarcações NOVAS. As 11 lanchas que já estavam no site em 19/11 (e os pedidos já feitos) continuam
-- exatamente como estão: elas seguem no padrão antigo de 10% (lista abaixo), e quem tem % própria mantém a sua.
-- Miss Bardot continua 0%. O painel (login/index.html, TAXA_ANTIGA) usa a mesma lista. Idempotente.

create or replace function public.taxa_buzios(l text, neto numeric)
 returns integer
 language sql
 immutable
 set search_path to 'public'
as $function$ select case
  when neto is null or neto <= 0 then null
  when l = 'miss-bardot' then 0
  -- lanchas cadastradas até 19/11/2026: padrão antigo de 10%
  when l in ('angela','bubbles','chefe','compostela','gratidao','jc-pescador-buzios','les-zuzu','midas','pura-vida','spartana','vem-verao')
    then (round(neto * 0.10 / 10) * 10)::int
  else (round(neto * 0.15 / 10) * 10)::int end $function$;

alter table public.precos_neto drop constraint if exists precos_neto_taxa_pct_ck;
alter table public.precos_neto add constraint precos_neto_taxa_pct_ck check (taxa_pct is null or (taxa_pct >= 0 and taxa_pct <= 35));
alter table public.pedidos drop constraint if exists pedidos_comissao_pct_check;
alter table public.pedidos add constraint pedidos_comissao_pct_check check (comissao_pct >= 0 and comissao_pct <= 35);

-- Búzios Lanchas (Rodrigo 2026-11-03): aviso automático ao cliente com conta (celular + e-mail)
-- quando a meia diária condicional se resolve às 20h da véspera. Marca cada passeio avisado uma vez.
alter table public.anotacoes add column if not exists cond_aviso_em timestamptz;
-- as condicionais resolvidas antes de hoje às 20h não recebem aviso atrasado
update public.anotacoes set cond_aviso_em = now()
 where cond_resultado is not null and cond_aviso_em is null and cond_em < '2026-11-03 19:55-03';
select 'ok' as resultado, count(*) filter (where cond_resultado is null and cond_ate is not null) as condicionais_abertas from public.anotacoes;

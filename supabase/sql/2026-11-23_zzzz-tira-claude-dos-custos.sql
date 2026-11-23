-- publicar: auto
-- Rodrigo 23/11: a assinatura do Claude não é custo da Búzios (uso pessoal em vários projetos).
-- A linha tinha ficado só em setembro de 2026 e ainda aparecia ali; agora sai de vez. Idempotente.
delete from public.lucro_custos where nome like 'Claude%' and grupo = 'site';

-- cotação de teste do neto combinado (telefone fictício, já vencida em 23/11)
delete from public.cotacoes_garantidas where id = 250 and tel = '5521900000001';

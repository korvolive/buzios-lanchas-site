-- publicar: auto
-- Rodrigo 23/11: a assinatura do Claude não é custo da Búzios (uso pessoal em vários projetos).
-- A linha tinha ficado só em setembro de 2026 e ainda aparecia ali; agora sai de vez. Idempotente.
delete from public.lucro_custos where nome like 'Claude%' and grupo = 'site';

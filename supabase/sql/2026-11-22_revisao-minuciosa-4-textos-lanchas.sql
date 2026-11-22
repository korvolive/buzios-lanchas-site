-- publicar: auto
-- Revisão minuciosa 22/11: correções de tradução nas descrições das lanchas (só EN/ES; o PT fica igual, então a tradução
-- noturna não refaz). Idempotente: replace não muda nada se o texto já estiver certo. Sem dado de cliente.
update public.lanchas set dados = jsonb_set(dados, '{descricao,en}', to_jsonb(replace(dados->'descricao'->>'en', 'A Chefe is ', 'Chefe is ')))
 where slug = 'chefe' and dados->'descricao'->>'en' like '%A Chefe is %';
update public.lanchas set dados = jsonb_set(dados, '{descricao,es}', to_jsonb(replace(dados->'descricao'->>'es', 'A Chefe es ', 'La Chefe es ')))
 where slug = 'chefe' and dados->'descricao'->>'es' like '%A Chefe es %';
update public.lanchas set dados = jsonb_set(dados, '{descricao,es}', to_jsonb(replace(dados->'descricao'->>'es', 'El gran destaque es', 'Lo más destacado es')))
 where slug = 'miss-bardot' and dados->'descricao'->>'es' like '%El gran destaque es%';

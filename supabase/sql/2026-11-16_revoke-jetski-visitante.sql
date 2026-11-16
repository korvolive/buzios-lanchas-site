-- publicar: auto
-- Revisão de segurança 16/11, item 6 (baixa): funções do jetski não precisam ser chamáveis pelo visitante.
-- Só revoke (idempotente). Gatilhos não dependem de EXECUTE de quem dispara; pode_jetski continua para quem está logado (Storage roda como authenticated).
revoke execute on function public.pode_jetski(uuid) from public, anon;
revoke execute on function public.pode_editar_jetski_pasta(text) from public, anon;
revoke execute on function public.tg_jetski_uso_confere() from public, anon, authenticated;
revoke execute on function public.tg_pedido_jetski() from public, anon, authenticated;
revoke execute on function public.tg_pedido_jetski_uso() from public, anon, authenticated;

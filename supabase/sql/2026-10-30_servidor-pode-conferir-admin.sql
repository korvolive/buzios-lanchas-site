-- Servidor (funções automáticas) volta a poder gravar em anotacoes (2026-10-30)
-- Desde 29/10 o servidor recebia "permission denied for function e_admin" ao atualizar anotacoes: os gatilhos
-- trava_valor_buzios e trava_cliente_conta chamam e_admin(), e o service_role tinha perdido a permissão de usar essa função.
-- Efeito: o aviso automático do WhatsApp oficial ("passeio registrado") não conseguia marcar o passeio e por isso não saía.
-- e_admin() só diz se quem está logado é administrador; para o servidor ela responde "não" (não há usuário logado).
grant execute on function public.e_admin() to service_role;

-- conferência: deve mostrar true
select has_function_privilege('service_role', 'public.e_admin()', 'execute') as servidor_ok;

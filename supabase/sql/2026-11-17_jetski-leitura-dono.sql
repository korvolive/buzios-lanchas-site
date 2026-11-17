-- publicar: auto
-- Revisão de segurança do jet ski (2026-11-17): o app lê jetskis e jetski_usos direto (dono do jet ski e administrador),
-- mas "authenticated" nunca teve SELECT nessas tabelas (o padrão do schema só dá MAINTAIN), então o cartão do jet ski
-- não aparecia para ninguém. Só leitura; quem vê o quê continua nas políticas RLS (dono do jet ski ou administrador).
-- Escrita continua só pelas funções (jetski_salvar, jetski_marcar). Visitante (anon) continua sem acesso. Idempotente.
grant select on table public.jetskis to authenticated;
grant select on table public.jetski_usos to authenticated;

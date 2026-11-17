-- publicar: auto
-- Conserta o envio de fotos das lanchas no painel (2026-11-17).
-- O revoke de 2026-11-16 tirou o EXECUTE de PUBLIC; como "authenticated" só tinha o EXECUTE por PUBLIC,
-- a política "lanchas: dono do jetski envia" passou a dar "permission denied" e o Storage recusava (400)
-- TODO upload no bucket lanchas, inclusive do administrador. Visitante (anon) continua sem acesso.
-- Idempotente.
grant execute on function public.pode_jetski(uuid) to authenticated;
grant execute on function public.pode_editar_jetski_pasta(text) to authenticated;

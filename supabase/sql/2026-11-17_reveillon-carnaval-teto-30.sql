-- publicar: auto
-- Teto do % de Réveillon e Carnaval do dono passa de 25% para 30% (Rodrigo 2026-11-17). Miss Bardot continua com 60%.
-- Idempotente: troca só o trecho "60 else 25" na definição atual de salvar_netos_v2 e salvar_netos_v3.
do $$
declare f record; def text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('salvar_netos_v2', 'salvar_netos_v3') and p.prosrc like '%60 else 25%'
  loop
    def := replace(pg_get_functiondef(f.oid), '60 else 25', '60 else 30');
    execute def;
  end loop;
end $$;

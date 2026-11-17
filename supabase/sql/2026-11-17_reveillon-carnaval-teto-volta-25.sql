-- publicar: auto
-- Rodrigo desistiu do teto de 30%: o % de Réveillon e Carnaval do dono volta a ter máximo de 25% (Miss Bardot segue 60%).
-- Idempotente: troca "60 else 30" por "60 else 25" na definição atual de salvar_netos_v2 e salvar_netos_v3.
do $$
declare f record;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('salvar_netos_v2', 'salvar_netos_v3') and p.prosrc like '%60 else 30%'
  loop
    execute replace(pg_get_functiondef(f.oid), '60 else 30', '60 else 25');
  end loop;
end $$;

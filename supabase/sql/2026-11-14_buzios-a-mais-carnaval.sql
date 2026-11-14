-- "Búzios a mais" do Carnaval separado do Réveillon (Rodrigo 2026-11-14). Rodado pelo conector em 2026-11-14.
-- Começa igual ao do Réveillon: nenhum preço mudou (480 preços conferidos antes/depois).
alter table public.precos add column if not exists bz_carnaval integer;
alter table public.precos add column if not exists bz_carnaval7 integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'precos_bz_carnaval_ck') then
    alter table public.precos add constraint precos_bz_carnaval_ck check (coalesce(bz_carnaval,0) between 0 and 20000 and coalesce(bz_carnaval7,0) between 0 and 20000);
  end if;
end $$;
update public.precos set bz_carnaval = bz_reveillon, bz_carnaval7 = bz_reveillon7 where lancha is not null;
-- _valor_na_data: no Carnaval (época reveillon em fev/mar) soma bz_carnaval(7) em vez de bz_reveillon(7):
--   if not neto then rx := coalesce(case when h7 then r.bz_carnaval7 else r.bz_carnaval end, 0); end if;
-- (função completa: ver o banco; mesma de 2026-11-13_carnaval-separado.sql com essa troca)

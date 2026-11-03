-- Búzios Lanchas, 2026-11-03: Cabo Frio e Arraial do Cabo (Rodrigo).
-- A cidade da lancha fica em lanchas.dados->>'cidade' (sem valor = Búzios), então lanchas não muda.
-- Vendedores e parceiros ganham as cidades em que vendem: buzios, cabo-frio, arraial, ou 'todas' (global).
-- Quem já é vendedor fica como Búzios. Rode no Supabase › SQL Editor; nada é apagado.
alter table public.vendedores add column if not exists cidades text[] not null default '{buzios}';

create or replace function public.definir_cidades_vendedor(uid uuid, c text[])
 returns text[] language plpgsql security definer set search_path to 'public' as $function$
begin
  if not e_admin() then raise exception 'so_admin'; end if;
  if c is null or cardinality(c) = 0 or not (c <@ array['buzios','cabo-frio','arraial','todas']) then raise exception 'cidade_invalida'; end if;
  if 'todas' = any(c) then c := array['todas']; end if;
  update vendedores set cidades = c where user_id = uid;
  if not found then raise exception 'nao_e_vendedor'; end if;
  return c;
end $function$;
revoke all on function public.definir_cidades_vendedor(uuid, text[]) from public, anon;
grant execute on function public.definir_cidades_vendedor(uuid, text[]) to authenticated;

-- Conferir (deve mostrar a coluna e a função):
select (select count(*) from information_schema.columns where table_name='vendedores' and column_name='cidades') as coluna,
       (select count(*) from pg_proc where proname='definir_cidades_vendedor') as funcao;

-- Ordem das lanchas na vitrine do site (2026-11-14). Já aplicado no banco pela migração lanchas_posicao_no_site.
alter table public.lanchas add column if not exists posicao integer;
comment on column public.lanchas.posicao is 'Ordem da lancha na vitrine do site (1 = primeira). Vazia = depois das numeradas, da maior para a menor. Definida pelo administrador no app (2026-11-14).';

create or replace function public.ordenar_lanchas(slugs text[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not e_admin() then raise exception 'so_admin'; end if;
  if slugs is null or array_length(slugs,1) is null or array_length(slugs,1) > 200 then raise exception 'lista_invalida'; end if;
  update lanchas l set posicao = x.i::int, atualizado_em = now()
    from unnest(slugs) with ordinality as x(s, i)
   where l.slug = x.s and l.posicao is distinct from x.i::int;
end $$;
revoke all on function public.ordenar_lanchas(text[]) from public, anon;
grant execute on function public.ordenar_lanchas(text[]) to authenticated;

-- ordem inicial: Miss Bardot, Midas, Spartana e as demais como já estavam
update public.lanchas l set posicao = v.p
  from (values ('miss-bardot',1),('midas',2),('spartana',3),('vem-verao',4),('bubbles',5),('jc-pescador-buzios',6),('gratidao',7),('les-zuzu',8),('angela',9),('compostela',10)) as v(s,p)
 where l.slug = v.s;

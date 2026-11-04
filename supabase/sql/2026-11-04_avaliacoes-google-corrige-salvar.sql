-- Corrige salvar_avaliacao_google (2026-11-04): o nome dos parâmetros (autor, nota, texto, data, perfil) era igual ao das colunas
-- e o banco recusava com "column reference autor is ambiguous" (erro 400 no "Salvar avaliação").
create or replace function public.salvar_avaliacao_google(l text, autor text, nota int, texto text default null, data date default null, perfil text default 'buzios')
returns bigint language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare i bigint;
begin
  if not public.pode_avaliacao_google() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.lanchas where slug = salvar_avaliacao_google.l) then raise exception 'lancha' using errcode = 'P0001'; end if;
  insert into public.avaliacoes_google (lancha, autor, nota, texto, data, perfil)
    values (salvar_avaliacao_google.l, btrim(salvar_avaliacao_google.autor), salvar_avaliacao_google.nota,
            nullif(btrim(salvar_avaliacao_google.texto), ''), salvar_avaliacao_google.data, coalesce(salvar_avaliacao_google.perfil, 'buzios'))
  on conflict on constraint avaliacoes_google_lancha_autor_data_key
    do update set nota = excluded.nota, texto = excluded.texto, perfil = excluded.perfil
  returning id into i;
  return i;
end $$;
revoke all on function public.salvar_avaliacao_google(text, text, int, text, date, text) from public, anon;
grant execute on function public.salvar_avaliacao_google(text, text, int, text, date, text) to authenticated;

-- conferir: deve mostrar 0 (nenhuma avaliação ainda)
select count(*) from public.avaliacoes_google;

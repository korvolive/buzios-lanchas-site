-- Registro: versão que está no banco desde 04/11 (corrigida direto no Supabase; o arquivo de 04/11 tinha a anterior).
CREATE OR REPLACE FUNCTION public.salvar_avaliacao_google(l text, autor text, nota integer, texto text DEFAULT NULL::text, data date DEFAULT NULL::date, perfil text DEFAULT 'buzios'::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

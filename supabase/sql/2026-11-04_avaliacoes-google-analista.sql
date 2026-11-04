-- O Analista (login com papel 'auditor', só leitura no resto do painel) pode lançar e apagar avaliações do Google (Rodrigo 2026-11-04).
-- Só muda quem pode usar salvar_avaliacao_google, apagar_avaliacao_google e passeios_para_google; o auditor continua sem alterar mais nada.
create or replace function public.pode_avaliacao_google() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.e_admin() or coalesce(public.papel_painel() in ('operador','auditor'), false);
$$;

-- conferir: deve listar operador e auditor
select papel from public.papeis_painel;

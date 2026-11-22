-- publicar: auto
-- Revisão minuciosa 22/11 (Rodrigo): mudou a lotação no cadastro, o texto tem que acompanhar em todos os lugares.
-- 1) Gatilho: ao salvar uma lancha, "até N pessoas / up to N people / hasta N personas" na descrição e na frase (PT/EN/ES)
--    passa a ser o número do cadastro (dados.capacidade). Vale para site, Bordazul, Lucas e tudo que lê o banco.
-- 2) Corrige o que já estava diferente (Les Zuzu: cadastro 9, texto 8).
-- 3) Chefe não tem banheiro (Rodrigo 22/11): tira "banheiro" da descrição e da frase.
-- Idempotente, sem dado de cliente.
create or replace function public._lancha_lotacao_texto() returns trigger
language plpgsql set search_path = public as $$
declare n int; k text; campo text; v text;
begin
  if new.dados is null or coalesce(new.dados->>'capacidade', '') !~ '^\d{1,3}$' then return new; end if;
  n := (new.dados->>'capacidade')::int;
  if n <= 0 then return new; end if;
  foreach campo in array array['descricao', 'frase'] loop
    if jsonb_typeof(new.dados->campo) = 'object' then
      foreach k in array array['pt', 'en', 'es'] loop
        v := new.dados->campo->>k;
        if v is not null and v ~* '(até|up to|hasta) \d{1,3} (pessoas|people|personas)' then
          new.dados := jsonb_set(new.dados, array[campo, k],
            to_jsonb(regexp_replace(v, '(até|up to|hasta) \d{1,3} (pessoas|people|personas)', '\1 ' || n || ' \2', 'gi')));
        end if;
      end loop;
    end if;
  end loop;
  return new;
end $$;
revoke all on function public._lancha_lotacao_texto() from public, anon, authenticated;
drop trigger if exists lancha_lotacao_texto on public.lanchas;
create trigger lancha_lotacao_texto before insert or update of dados on public.lanchas
  for each row execute function public._lancha_lotacao_texto();

-- passa todas pelo gatilho uma vez (só muda o que estiver diferente)
update public.lanchas set dados = dados
 where dados ? 'capacidade'
   and (coalesce(dados->'descricao'->>'pt','') || coalesce(dados->'descricao'->>'en','') || coalesce(dados->'descricao'->>'es','')
        || coalesce(dados->'frase'->>'pt','') || coalesce(dados->'frase'->>'en','') || coalesce(dados->'frase'->>'es',''))
       ~* '(até|up to|hasta) \d{1,3} (pessoas|people|personas)'
   and (coalesce(dados->'descricao'->>'pt','') || coalesce(dados->'descricao'->>'en','') || coalesce(dados->'descricao'->>'es','')
        || coalesce(dados->'frase'->>'pt','') || coalesce(dados->'frase'->>'en','') || coalesce(dados->'frase'->>'es',''))
       ~* ('(até|up to|hasta) (?!' || (dados->>'capacidade') || ' )\d{1,3} (pessoas|people|personas)');

-- Chefe sem banheiro
update public.lanchas set dados = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(dados,
    '{descricao,pt}', to_jsonb(replace(dados->'descricao'->>'pt', 'Tem banheiro, tapete flutuante,', 'Tem tapete flutuante,'))),
    '{descricao,en}', to_jsonb(replace(dados->'descricao'->>'en', 'It has a restroom, floating mat,', 'It has a floating mat,'))),
    '{descricao,es}', to_jsonb(replace(dados->'descricao'->>'es', 'Cuenta con baño, alfombra flotante,', 'Cuenta con alfombra flotante,'))),
    '{frase,pt}', to_jsonb(replace(dados->'frase'->>'pt', 'com banheiro, tapete flutuante e toldo com sombra', 'com tapete flutuante, toldo com sombra e ducha de água doce'))),
    '{frase,en}', to_jsonb(replace(dados->'frase'->>'en', 'with restroom, floating mat and shade awning', 'with floating mat, shade awning and freshwater shower'))),
    '{frase,es}', to_jsonb(replace(dados->'frase'->>'es', 'con baño, alfombra flotante y toldo con sombra', 'con alfombra flotante, toldo con sombra y ducha de agua dulce')))
 where slug = 'chefe'
   and (dados->'descricao'->>'pt' like '%Tem banheiro,%' or dados->'frase'->>'pt' like '%com banheiro,%'
        or dados->'descricao'->>'en' like '%restroom%' or dados->'descricao'->>'es' like '%con baño,%'
        or dados->'frase'->>'en' like '%restroom%' or dados->'frase'->>'es' like '%con baño,%');

-- Les Zuzu sem reserva automática (Rodrigo 22/11): agora o próprio dono aprova pelo WhatsApp; reserva automática só na Miss Bardot.
update public.lanchas set reserva_auto = false where slug = 'les-zuzu' and reserva_auto;

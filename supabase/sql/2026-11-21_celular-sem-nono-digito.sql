-- publicar: auto
-- Celular brasileiro salvo sem o 9 (ex.: +55 3298130775): o banco coloca o 9 sozinho (Rodrigo 2026-11-21: "quando for assim, é só você adicionar").
-- Regra: DDI 55 + DDD + 8 dígitos começando com 6, 7, 8 ou 9 (celular antigo) vira DDD + 9 + 8 dígitos. Fixo (começa com 2 a 5) fica como está.
-- Idempotente: recria a função usada pelo gatilho a0_tel_padrao e corrige os passeios de hoje em diante.
CREATE OR REPLACE FUNCTION public._tel_padrao(t text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare m text[]; d text;
begin
  if t is null or regexp_replace(t, '\D', '', 'g') = '' then return null; end if;
  m := regexp_match(btrim(t), '^\+\s*([0-9]{1,4})\s+(.*)$');
  if m is not null then
    d := regexp_replace(m[2], '\D', '', 'g');
    if d = '' then return '+' || m[1]; end if;
    if m[1] = '55' and d ~ '^[1-9][1-9][6-9][0-9]{7}$' then d := substr(d, 1, 2) || '9' || substr(d, 3); end if;
    return '+' || m[1] || ' ' || d;
  end if;
  return btrim(t);  -- sem DDI separado: deixa como veio (as regras do banco decidem)
end $function$;

update public.anotacoes a set telefone = public._tel_padrao(a.telefone)
  from public.bloqueios b
 where b.id = a.bloqueio_id and b.data >= current_date
   and a.telefone ~ '^\+55 [1-9][1-9][6-9][0-9]{7}$';

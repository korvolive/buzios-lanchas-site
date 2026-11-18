-- publicar: auto
-- Julho volta para a baixa (Rodrigo 2026-11-18: férias de julho já têm o feriado próprio, 15 a 31/07).
--   Alta: 15/12 a 28/02 | Média: 01/03 a 30/04 e 01/11 a 14/12 | Baixa: 01/05 a 31/10
--   Réveillon (27/12 a 05/01) e Carnaval (sexta a terça) continuam por cima da alta.
-- Igual a seasonBase() em index.html e login/index.html. Idempotente.
CREATE OR REPLACE FUNCTION public._epoca(d date)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare m int := extract(month from d)::int; dd int := extract(day from d)::int; md text := to_char(d, 'MM-DD'); p date := public._pascoa(extract(year from d)::int);
begin
  if md >= '12-27' or md <= '01-05' or (d >= p - 51 and d <= p - 47) then return 'reveillon'; end if;
  if m in (1,2) or (m = 12 and dd >= 15) then return 'alta'; end if;
  if m in (3,4,11,12) then return 'media'; end if;
  return 'baixa';
end $function$;

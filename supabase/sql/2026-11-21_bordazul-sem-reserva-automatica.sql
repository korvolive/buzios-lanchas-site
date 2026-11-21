-- publicar: auto
-- Bordazul (2026-11-21): lancha que exige o ok do dono (fora de Búzios) nunca vira pré-reserva automática,
-- mesmo se alguém ligar a reserva automática nela. Búzios não muda (lancha_confirma_dono é false lá). Idempotente.
create or replace function public.lancha_auto(s text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select coalesce((select reserva_auto from public.lanchas where slug = s), false) and not public.lancha_confirma_dono(s) $function$;

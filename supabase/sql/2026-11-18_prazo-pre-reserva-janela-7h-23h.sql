-- publicar: auto
-- Rodrigo 2026-11-18: mensagens automáticas das 7h às 23h. O prazo da pré-reserva (passeio a 2+ dias) não vence entre 23h e 9h:
-- passa para as 9h (antes 22h-10h). Mesmo cálculo no painel (holdEnd) e no notificar. Idempotente.
create or replace function public._prazo_pre_fim(criado timestamptz, d date)
 returns timestamptz language sql stable set search_path to 'public'
as $$
  with x as (
    select (criado at time zone 'America/Sao_Paulo') as ini_local,
           d - (criado at time zone 'America/Sao_Paulo')::date as dias
  ), h as (
    select ini_local, dias,
           case when dias >= 7 then interval '12 hours'
                when dias >= 2 then interval '6 hours'
                when dias = 1 then
                  case when public._epoca(d) in ('baixa', 'media') and public._feriadao(d, '{}'::text[]) is null
                       then interval '3 hours' else interval '2 hours' end
                else interval '1 hour' end as dur
    from x
  ), f as (select dias, ini_local + dur as fim_local from h)
  select (case
            when dias >= 2 and extract(hour from fim_local) >= 23 then date_trunc('day', fim_local) + interval '1 day 9 hours'
            when dias >= 2 and extract(hour from fim_local) < 9 then date_trunc('day', fim_local) + interval '9 hours'
            else fim_local end) at time zone 'America/Sao_Paulo'
  from f
$$;
revoke all on function public._prazo_pre_fim(timestamptz, date) from public, anon;
grant execute on function public._prazo_pre_fim(timestamptz, date) to authenticated, service_role;

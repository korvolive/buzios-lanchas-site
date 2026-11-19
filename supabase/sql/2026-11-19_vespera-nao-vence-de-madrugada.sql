-- publicar: auto
-- Caso pedido 77 (2026-11-19): pré-reserva da véspera liberada às 21h38 tinha prazo de 3 h e vencia às 00h38.
-- Regra nova: véspera (passeio no dia seguinte) nunca vence entre 23h e 8h (Brasília): passa para as 8h do dia do passeio.
-- Passeio a 2+ dias continua indo para as 9h. Mesmo cálculo no painel (login holdEnd) e no notificar (prazoFim). Idempotente.

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
            -- véspera liberada à noite (caso pedido 77, 2026-11-19): não vence de madrugada, vai para as 8h do dia do passeio
            when dias = 1 and extract(hour from fim_local) >= 23 then date_trunc('day', fim_local) + interval '1 day 8 hours'
            when dias = 1 and extract(hour from fim_local) < 8 then date_trunc('day', fim_local) + interval '8 hours'
            else fim_local end) at time zone 'America/Sao_Paulo'
  from f
$$;

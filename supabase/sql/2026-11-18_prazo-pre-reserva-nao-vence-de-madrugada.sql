-- publicar: auto
-- Caso Paulo (Angela 30/12) e Joaquin (Compostela 19/11), 2026-11-18: pré-reservas aprovadas no fim da tarde
-- tinham prazo de 12 h / 6 h e venciam de madrugada (05h09 e 23h17). Os lembretes saíram às 23h10 e 04h10,
-- a data foi solta às 05h15/23h30 e a pré-reserva voltou para Consultas, onde foi aprovada de novo (link novo).
-- Regra nova: quando o passeio é daqui a 2 dias ou mais (prazo de 6 h ou 12 h), o prazo nunca termina entre
-- 22h e 10h (Brasília): passa para as 10h da manhã seguinte. Véspera e mesmo dia continuam curtos (sem mudança).
-- Os dias até o passeio contam a partir da criação da pré-reserva (antes contavam de "agora", e o prazo encolhia
-- na virada do dia). Mesmo cálculo no painel (login/index.html holdEnd) e no notificar (vencerPre).
-- Idempotente: a função é create or replace e as trocas nas outras funções só acontecem se o texto antigo existir.

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
            when dias >= 2 and extract(hour from fim_local) >= 22 then date_trunc('day', fim_local) + interval '1 day 10 hours'
            when dias >= 2 and extract(hour from fim_local) < 10 then date_trunc('day', fim_local) + interval '10 hours'
            else fim_local end) at time zone 'America/Sao_Paulo'
  from f
$$;
revoke all on function public._prazo_pre_fim(timestamptz, date) from public, anon;
grant execute on function public._prazo_pre_fim(timestamptz, date) to authenticated, service_role;

do $$
declare def text;
begin
  -- trava do servidor: não apaga a pré-reserva antes do fim do prazo
  def := pg_get_functiondef('public._pre_prazo_segura()'::regprocedure);
  if position('old.criado_em > now() - public._prazo_pre(old.data)' in def) > 0 then
    execute replace(def, 'old.criado_em > now() - public._prazo_pre(old.data)', 'now() < public._prazo_pre_fim(old.criado_em, old.data)');
  end if;
  -- pedido de cliente com conta: cancela só depois do prazo
  def := pg_get_functiondef('public.vencer_pre_pedidos()'::regprocedure);
  if position('b.criado_em < now() - public._prazo_pre(b.data)' in def) > 0 then
    execute replace(def, 'b.criado_em < now() - public._prazo_pre(b.data)', 'public._prazo_pre_fim(b.criado_em, b.data) < now()');
  end if;
  -- pagar_ate do pedido e o "guardada até" do chat
  def := pg_get_functiondef('public._ligar_passeio(bigint, uuid)'::regprocedure);
  if position('b.criado_em + public._prazo_pre(b.data)' in def) > 0 then
    execute replace(def, 'b.criado_em + public._prazo_pre(b.data)', 'public._prazo_pre_fim(b.criado_em, b.data)');
  end if;
  -- cotação garantida até o fim do mesmo prazo
  def := pg_get_functiondef('public.registrar_cotacao(text, text, date, text, numeric, text, text)'::regprocedure);
  if position('now() + public._prazo_pre(p_data)' in def) > 0 then
    execute replace(def, 'now() + public._prazo_pre(p_data)', 'public._prazo_pre_fim(now(), p_data)');
  end if;
end $$;

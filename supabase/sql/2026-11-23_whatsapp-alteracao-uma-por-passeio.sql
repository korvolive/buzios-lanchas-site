-- publicar: auto
-- Rodrigo 2026-11-23: o card "WhatsApp pendente" mostrava 3 linhas iguais para a mesma reserva (Oksana, Miss Bardot 04/01),
-- uma por alteração feita no formulário. A mensagem sempre mostra a reserva como está agora, então um envio já avisa tudo.
-- marcar_wa('alteracao') passa a marcar como enviadas todas as alterações aprovadas e ainda não avisadas do mesmo passeio.
-- Idempotente.

create or replace function public.marcar_wa(tipo text, rid bigint)
 returns timestamp with time zone
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare agora timestamptz := now(); lch text; atend boolean := public.e_admin() or coalesce(public.papel_painel() = 'operador', false);
begin
  if tipo in ('pix','central','aprovado_cliente','aprovado_dono','consulta','lead') then
    if not atend then raise exception 'Sem acesso'; end if;
    if tipo = 'pix' then update public.pedidos set wa_pix_em = agora where id = rid;
    elsif tipo = 'central' then update public.pedidos set wa_central_em = agora where id = rid;
    elsif tipo = 'aprovado_cliente' then update public.pedidos set wa_aprovado_cliente_em = agora where id = rid;
    elsif tipo = 'aprovado_dono' then update public.pedidos set wa_aprovado_dono_em = agora where id = rid;
    elsif tipo = 'consulta' then update public.consultas set wa_resposta_em = agora where id = rid;
    else update public.vendedor_leads set wa_lead_em = agora where id = rid;
    end if;
  elsif tipo in ('condicional','cond_inicio','lembrete') then
    if not atend then raise exception 'Sem acesso'; end if;
    if tipo = 'condicional' then update public.anotacoes set wa_cond_em = agora where bloqueio_id = rid;
    elsif tipo = 'cond_inicio' then update public.anotacoes set wa_cond_ini_em = agora where bloqueio_id = rid;
    else update public.anotacoes set wa_lembrete_em = agora where bloqueio_id = rid;
    end if;
  elsif tipo = 'alteracao' then
    if not atend then raise exception 'Sem acesso'; end if;
    update public.alteracoes_pedidas set wa_em = agora where id = rid;
    -- a mensagem mostra o passeio como está agora: avisa também as outras alterações aprovadas do mesmo passeio
    update public.alteracoes_pedidas set wa_em = agora
     where bloqueio_id = (select bloqueio_id from public.alteracoes_pedidas where id = rid)
       and status = 'aprovada' and wa_em is null and not condicional;
  elsif tipo in ('dono','confirma') then
    if not atend then raise exception 'Sem acesso'; end if;
    if tipo = 'dono' then update public.anotacoes set wa_dono_em = agora where bloqueio_id = rid;
    else update public.anotacoes set wa_confirma_em = agora where bloqueio_id = rid;
    end if;
  elsif tipo in ('cobranca','convite','aviso','embarque') then
    select lancha into lch from public.bloqueios where id = rid;
    if lch is null then raise exception 'Passeio não encontrado'; end if;
    if not atend and not exists (select 1 from public.donos d where d.lancha = lch and d.user_id = auth.uid()) then
      raise exception 'Sem acesso';
    end if;
    if tipo = 'cobranca' then update public.anotacoes set wa_cobranca_em = agora where bloqueio_id = rid;
    elsif tipo = 'convite' then update public.anotacoes set wa_convite_em = agora where bloqueio_id = rid;
    elsif tipo = 'aviso' then update public.anotacoes set wa_aviso_em = agora where bloqueio_id = rid;
    else update public.anotacoes set wa_embarque_em = agora where bloqueio_id = rid;
    end if;
  else
    raise exception 'Tipo inválido';
  end if;
  return agora;
end $function$;

-- as duplicadas que já existem: se uma alteração do passeio já foi avisada, as outras aprovadas anteriores a esse aviso também foram
update public.alteracoes_pedidas a set wa_em = s.wa_em
  from (select bloqueio_id, max(wa_em) wa_em from public.alteracoes_pedidas where wa_em is not null group by bloqueio_id) s
 where a.bloqueio_id = s.bloqueio_id and a.wa_em is null and a.status = 'aprovada' and not a.condicional and a.resolvido_em <= s.wa_em;

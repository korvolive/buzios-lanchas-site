-- Lembrete do sinal (Rodrigo 2026-10-31): o Lucas (operador) ou o administrador lembram pelo WhatsApp o cliente
-- de uma pré-reserva que ainda não pagou o sinal. O app guarda a hora do último lembrete.

alter table public.anotacoes add column if not exists wa_lembrete_em timestamptz;

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
    -- aviso de reserva alterada (rid = id da alteração)
    if not atend then raise exception 'Sem acesso'; end if;
    update public.alteracoes_pedidas set wa_em = agora where id = rid;
  elsif tipo in ('cobranca','convite','aviso','embarque') then
    -- avisos do passeio: administrador, operador ou dono da lancha
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

-- O cliente desistiu pelo WhatsApp: o administrador ou o operador cancela a pré-reserva (sem sinal e sem comprovante).
-- A data fica livre e a consulta vai para Recusadas, onde o Rodrigo pode resgatar se o cliente voltar.
create or replace function public.cancelar_pre_reserva(bid bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; em text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem permissão'; end if;
  select * into b from public.bloqueios where id = bid for update;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if b.id is null or a.bloqueio_id is null then raise exception 'Passeio não encontrado'; end if;
  if a.origem is distinct from 'buzios' or not (a.valor > 0) or coalesce(a.sinal, 0) <> 0 then raise exception 'Só dá para cancelar aqui uma pré-reserva sem sinal'; end if;
  if a.comprovante is not null then raise exception 'Este passeio já tem comprovante: fale com o Rodrigo'; end if;
  if exists (select 1 from public.pedidos where bloqueio_id = bid and status not in ('cancelado','recusado')) then
    raise exception 'Cliente com conta no app: o Rodrigo cancela pelo pedido'; end if;
  select nullif(btrim(email), '') into em from public.convites where bloqueio_id = bid;
  begin
    insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang,
                                  valor, sinal, hora_ini, hora_fim, obs, recusada_em)
      values (true, now(), b.criado_por, b.lancha, b.data, b.horario, a.pessoas, a.embarque,
              coalesce(nullif(btrim(a.cliente), ''), 'Cliente'), coalesce(a.telefone, ''), lower(coalesce(em, '')), 'pt',
              a.valor, nullif(a.sinal_combinado, 0), a.hora_ini, a.hora_fim,
              concat_ws(' · ', '🚫 Cliente desistiu em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24"h"MI'), nullif(btrim(a.obs), '')),
              case when b.data >= hoje then now() end);
  exception when others then null; -- a cópia nunca impede o cancelamento
  end;
  delete from public.bloqueios where id = bid;
end $$;
revoke all on function public.cancelar_pre_reserva(bigint) from public, anon;
grant execute on function public.cancelar_pre_reserva(bigint) to authenticated;

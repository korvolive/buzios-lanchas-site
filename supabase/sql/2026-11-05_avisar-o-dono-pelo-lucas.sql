-- Avisar o dono pelo WhatsApp (Rodrigo 2026-11-05): passeio da Búzios confirmado aparece no card "📲 Avisar o dono"
-- do Lucas e do administrador; o toque no WhatsApp grava a hora (marcar_wa 'dono') e o passeio sai da lista.
alter table public.anotacoes add column if not exists wa_dono_em timestamptz;

CREATE OR REPLACE FUNCTION public.marcar_wa(tipo text, rid bigint)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  elsif tipo = 'dono' then
    -- aviso ao dono da lancha de um passeio confirmado pela Búzios (rid = id do passeio)
    if not atend then raise exception 'Sem acesso'; end if;
    update public.anotacoes set wa_dono_em = agora where bloqueio_id = rid;
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

-- Conferir (deve dar dono_ok = true):
select exists (select 1 from information_schema.columns where table_schema='public' and table_name='anotacoes' and column_name='wa_dono_em')
   and (select prosrc like '%wa_dono_em%' from pg_proc where proname='marcar_wa') as dono_ok;

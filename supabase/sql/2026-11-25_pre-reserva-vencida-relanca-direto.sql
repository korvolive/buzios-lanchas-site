-- publicar: auto
-- 25/11/2026 (Rodrigo, continuação do caso Marcelo / pedido 107):
-- 1) Prazo curto do relançamento pelo dia do passeio: mesmo dia 40 min, véspera 1 h, 2 dias ou mais 2 h.
--    Nunca passa de 40 min antes do início (quando o pagamento fecha) e segue a regra de não vencer de madrugada.
-- 2) Relançamento da MESMA lancha, data e horário (mesmo telefone, até 3 dias depois de vencer) não passa de novo
--    pelo dono: vira pré-reserva na hora, como lancha automática. Exceção: se o dono já foi avisado de que a
--    pré-reserva caiu (aviso 1 h depois, feito pela VPS), volta para a aprovação normal do dono.
-- Idempotente.

-- donos avisados de que a pré-reserva vencida não voltou (a VPS grava; só admin/operador)
create table if not exists public.vencidas_dono_avisado (
  bid text primary key,
  em timestamptz not null default now()
);
alter table public.vencidas_dono_avisado enable row level security;
revoke all on table public.vencidas_dono_avisado from public, anon, authenticated;

create or replace function public.marcar_dono_avisado_vencida(p_bid text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if p_bid is null or p_bid !~ '^[0-9]{1,12}$' then raise exception 'bloqueio inválido'; end if;
  insert into public.vencidas_dono_avisado(bid) values (p_bid) on conflict (bid) do nothing;
end $$;
revoke all on function public.marcar_dono_avisado_vencida(text) from public, anon;
grant execute on function public.marcar_dono_avisado_vencida(text) to authenticated;

-- pré-reserva vencida sem sinal (últimos 3 dias) do mesmo telefone, mesma lancha, data e horário, com o dono ainda não avisado
create or replace function public._vencida_relancavel(p_tel text, p_lancha text, p_data date, p_horario text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select regexp_replace(coalesce(public._tel_padrao(p_tel), ''), '\D', '', 'g') <> '' and exists (
    select 1
      from public.auditoria ab
      join public.auditoria aa on aa.tabela = 'anotacoes' and aa.operacao = 'DELETE' and aa.quem is null
                              and (aa.antes->>'bloqueio_id') = ab.registro
     where ab.tabela = 'bloqueios' and ab.operacao = 'DELETE' and ab.quem is null
       and ab.em >= now() - interval '3 days'
       and ab.antes->>'lancha' = p_lancha and (ab.antes->>'data')::date = p_data and ab.antes->>'horario' = p_horario
       and regexp_replace(coalesce(aa.antes->>'telefone', ''), '\D', '', 'g') = regexp_replace(public._tel_padrao(p_tel), '\D', '', 'g')
       and coalesce((aa.antes->>'valor')::numeric, 0) > 0
       and coalesce((aa.antes->>'sinal')::numeric, 0) = 0
       and public._prazo_pre_fim((ab.antes->>'criado_em')::timestamptz, (ab.antes->>'data')::date) <= ab.em + interval '5 minutes'
       and not exists (select 1 from public.vencidas_dono_avisado v where v.bid = ab.registro)
  )
$$;
revoke all on function public._vencida_relancavel(text, text, date, text) from public, anon, authenticated;

-- lançamento do Lucas/operador: relançamento de vencida = direto, sem esperar o dono
create or replace function public.lancar_reserva_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text DEFAULT NULL::text, p_valor numeric DEFAULT NULL::numeric, p_sinal numeric DEFAULT NULL::numeric, p_hora_ini text DEFAULT NULL::text, p_hora_fim text DEFAULT NULL::text, p_obs text DEFAULT NULL::text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare nid bigint; r jsonb; relanca boolean;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  nid := public.lancar_pedido_operador(p_lancha, p_data, p_horario, p_pessoas, p_nome, p_tel, p_email, p_lang, p_embarque, p_valor, p_sinal, p_hora_ini, p_hora_fim, p_obs);
  -- lancha com reserva automática (botão do administrador; antes só a Miss Bardot): vira pré-reserva na hora
  -- 25/11/2026: relançamento de pré-reserva vencida (mesma lancha, data e horário; dono ainda não avisado) também
  relanca := public._vencida_relancavel(p_tel, p_lancha, p_data, p_horario);
  if not (public.lancha_auto(p_lancha) or relanca) then return jsonb_build_object('cid', nid, 'auto', false); end if;
  perform set_config('app.auto_op', '1', true);
  r := public._aprovar_consulta(nid, false);
  perform set_config('app.auto_op', '', true);
  return r || jsonb_build_object('auto', true, 'cid', nid, 'relancamento', relanca);
end $function$;

-- prazo curto pelo dia do passeio (substitui a versão de 2 h fixas; o parâmetro p_horas fica só por compatibilidade)
create or replace function public._aplicar_prazo_curto(p_bid bigint, p_horas int default 2)
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare b record; alvo timestamptz; normal timestamptz; c timestamptz; f timestamptz; melhor timestamptz; melhor_c timestamptz;
        k int; ids bigint[]; dias int; dur interval; ini timestamptz; teto timestamptz;
begin
  select * into b from public.bloqueios where id = p_bid;
  if not found then return null; end if;
  dias := b.data - (now() at time zone 'America/Sao_Paulo')::date;
  dur := case when dias <= 0 then interval '40 minutes' when dias = 1 then interval '1 hour' else interval '2 hours' end;
  alvo := now() + dur;
  ini := public.inicio_combinado(b.data, b.horario, null, b.id) at time zone 'America/Sao_Paulo';
  teto := ini - interval '40 minutes'; -- pagamento fecha 40 min antes do passeio
  if teto <= now() then return null; end if;
  if alvo > teto then alvo := teto; end if;
  normal := public._prazo_pre_fim(b.criado_em, b.data);
  foreach k in array array[12, 6, 3, 2, 1] loop
    c := alvo - make_interval(hours => k);
    if c > now() then continue; end if; -- criado no futuro mudaria a contagem de dias
    f := public._prazo_pre_fim(c, b.data);
    if f >= alvo - interval '1 minute' and (melhor is null or f < melhor) then melhor := f; melhor_c := c; end if;
  end loop;
  if melhor is null or melhor >= normal - interval '1 minute' then return null; end if; -- o prazo normal já é curto
  select coalesce(array_agg(a.bloqueio_id), array[p_bid]) into ids from public.anotacoes a
   where a.grupo is not null and a.grupo = (select grupo from public.anotacoes where bloqueio_id = p_bid);
  if not (p_bid = any(ids)) then ids := ids || p_bid; end if;
  update public.bloqueios set criado_em = melhor_c where id = any(ids) and data = b.data;
  insert into public.prazo_curto(bloqueio_id, ate) select x, melhor from unnest(ids) x
    on conflict (bloqueio_id) do update set ate = excluded.ate, criado_em = now();
  update public.pedidos set pagar_ate = melhor, atualizado_em = now() where bloqueio_id = any(ids) and status = 'pendente';
  return melhor;
end $$;
revoke all on function public._aplicar_prazo_curto(bigint, int) from public, anon, authenticated;

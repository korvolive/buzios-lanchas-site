-- Jetski no pedido do Lucas (Rodrigo, 2026-11-15): o Lucas cota e lança o jetski como adicional da lancha.
-- Caminho do pedido do Lucas: consulta (lancar_pedido_operador) -> aprovação (_aprovar_consulta, na hora se a lancha
-- tem reserva automática) -> bloqueio + anotações -> vira pedido em _ligar_passeio quando o cliente resgata o convite.
-- O jetski vai junto em todas as etapas:
--   consulta: colunas jetski* (conferidas na hora do lançamento);
--   aprovação: o jetski fica SEGURADO numa linha de jetski_usos presa ao bloqueio_id (sem pedido ainda);
--   pedido: o pedido herda o jetski segurado e adota a mesma linha (não choca consigo mesmo).
-- Se o jetski não couber na aprovação, a lancha é aprovada assim mesmo e a anotação diz que o jetski ficou de fora.
-- Roda pelo conector.

alter table public.consultas
  add column if not exists jetski uuid references public.jetskis(id) on delete set null,
  add column if not exists jetski_min int,
  add column if not exists jetski_ini time,
  add column if not exists jetski_cortesia boolean;

-- Confere uma escolha de jetski para um passeio (mesmas regras do pedido do site). Dá erro se não serve.
create or replace function public._jetski_confere(p_jetski uuid, p_lancha text, p_horario text, p_hi text, p_hf text,
  p_min int, p_ini time, p_cortesia boolean, p_oculto_ok boolean,
  out ini time, out tot int, out cortesia int, out valor numeric, out neto numeric)
language plpgsql stable security definer set search_path = public as $$
declare j public.jetskis; w record; a int;
begin
  select * into j from public.jetskis where id = p_jetski;
  if j.id is null or not j.ativo or (j.oculto and not p_oculto_ok) then
    raise exception 'JETSKI_INDISPONIVEL: este jetski não está disponível.'; end if;
  if exists (select 1 from public.lanchas l where l.slug = p_lancha and l.dados->>'tipo' = 'escuna') then
    raise exception 'JETSKI_SO_LANCHA: jetski só vai junto com lancha, não com escuna.'; end if;
  cortesia := case when coalesce(p_cortesia, false) and j.cortesia_lancha = p_lancha and coalesce(j.cortesia_min, 0) > 0 then j.cortesia_min else 0 end;
  if p_ini is null or (p_min is null and cortesia = 0) then raise exception 'JETSKI_HORARIO: escolha o tempo e o horário do jetski.'; end if;
  if p_min is not null then
    neto := public.jetski_neto(j, p_min);
    if neto is null or neto <= 0 then raise exception 'JETSKI_TEMPO: o jetski vai de 1h a 3h, em passos de 30 min.'; end if;
    valor := public.jetski_valor(neto);
  end if;
  tot := coalesce(p_min, 0) + cortesia;
  w := public.jetski_janela(p_horario, p_hi, p_hf);
  if w.ini is null or w.fim is null then
    raise exception 'JETSKI_JANELA: o jetski não vai em passeio noturno nem que passa da meia-noite.'; end if;
  a := extract(epoch from p_ini)::int / 60;
  if a % 30 <> 0 or a < w.ini + 60 or a + tot > w.fim - 60 then
    raise exception 'JETSKI_JANELA: o jetski tem de começar 1 h depois da saída e terminar 1 h antes da volta (início de 30 em 30 min).'; end if;
  ini := p_ini;
end $$;

-- Horários de início livres para um jetski num passeio (lista HH:MM).
create or replace function public._jetski_livres(p_jetski uuid, p_data date, p_lancha text, p_horario text, p_hi text, p_hf text, p_tot int)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(to_char(make_time(s / 60, s % 60, 0), 'HH24:MI') order by s), '{}')
  from public.jetski_janela(p_horario, p_hi, p_hf) w, generate_series(w.ini + 60, w.fim - 60 - p_tot, 30) s
  where w.ini is not null and w.fim is not null and p_tot > 0
    and not public.jetski_choca(p_jetski, p_data, make_time(s / 60, s % 60, 0), make_time(s / 60, s % 60, 0) + make_interval(mins => p_tot), p_lancha, null)
$$;

-- Cotação do jetski para o Lucas (cotar na VPS): tabela de preço e horários livres para a lancha/dia/horário.
create or replace function public.jetski_cotar(p_lancha text, p_data date, p_horario text, p_hora_ini text default null, p_hora_fim text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare adm boolean := public.e_admin(); r jsonb := '[]'::jsonb; j public.jetskis; c int; tab jsonb; m int; w record;
begin
  if not (adm or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if exists (select 1 from public.lanchas l where l.slug = p_lancha and l.dados->>'tipo' = 'escuna') then
    return jsonb_build_object('jetskis', '[]'::jsonb, 'motivo', 'jetski só vai com lancha, não com escuna'); end if;
  w := public.jetski_janela(p_horario, p_hora_ini, p_hora_fim);
  if w.ini is null or w.fim is null then
    return jsonb_build_object('jetskis', '[]'::jsonb, 'motivo', 'jetski não vai em passeio noturno nem que passa da meia-noite'); end if;
  for j in select * from public.jetskis x where x.ativo and (adm or not x.oculto) and (x.neto_hora is not null or x.precos <> '{}'::jsonb) order by x.criado_em loop
    c := case when j.cortesia_lancha = p_lancha and coalesce(j.cortesia_min, 0) > 0 then j.cortesia_min else 0 end;
    tab := '[]'::jsonb;
    for m in select g from generate_series(greatest(60, j.min_minutos), 180, 30) g where public.jetski_neto(j, g) > 0 loop
      tab := tab || jsonb_build_array(jsonb_build_object('min', m, 'tempo', public.jetski_min_txt(m), 'valor', public.jetski_valor(public.jetski_neto(j, m)),
        'livres', public._jetski_livres(j.id, p_data, p_lancha, p_horario, p_hora_ini, p_hora_fim, m))
        || case when c > 0 then jsonb_build_object('livres_com_cortesia', public._jetski_livres(j.id, p_data, p_lancha, p_horario, p_hora_ini, p_hora_fim, m + c)) else '{}'::jsonb end);
    end loop;
    r := r || jsonb_build_array(jsonb_build_object('id', j.id, 'nome', j.nome, 'modelo', j.modelo, 'oculto', j.oculto, 'tabela', tab,
      'cortesia_min', nullif(c, 0),
      'cortesia_livres', case when c > 0 then to_jsonb(public._jetski_livres(j.id, p_data, p_lancha, p_horario, p_hora_ini, p_hora_fim, c)) end));
  end loop;
  return jsonb_build_object('jetskis', r, 'janela', to_char(make_time((w.ini + 60) / 60, (w.ini + 60) % 60, 0), 'HH24:MI') || '-' || to_char(make_time((w.fim - 60) / 60, (w.fim - 60) % 60, 0), 'HH24:MI'),
    'regras', 'de 1h a 3h em passos de 30 min; começa 1h depois da saída e termina 1h antes da volta; valor pago inteiro online junto com o sinal; cortesia só se o cliente quiser');
end $$;

-- Segura o jetski da consulta no bloqueio recém-criado (chamado na aprovação). Nunca derruba a aprovação da lancha.
create or replace function public._jetski_segura(bid bigint, c public.consultas)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k record; s int; achou int; w record; err text;
begin
  if c.jetski is null then return null; end if;
  begin
    select * into k from public._jetski_confere(c.jetski, c.lancha, c.horario, c.hora_ini, c.hora_fim, c.jetski_min, c.jetski_ini, c.jetski_cortesia, true);
    w := public.jetski_janela(c.horario, c.hora_ini, c.hora_fim);
    achou := null;
    for s in select x from generate_series(w.ini + 60, w.fim - 60 - k.tot, 30) x
             order by (x = extract(epoch from k.ini)::int / 60) desc, abs(x - extract(epoch from k.ini)::int / 60), x loop
      if not public.jetski_choca(c.jetski, c.data, make_time(s / 60, s % 60, 0), make_time(s / 60, s % 60, 0) + make_interval(mins => k.tot), c.lancha, null) then
        achou := s; exit; end if;
    end loop;
    if achou is null then raise exception 'JETSKI_OCUPADO: o jetski não tem mais horário livre nesse passeio.'; end if;
    insert into public.jetski_usos (jetski, data, ini, fim, tipo, lancha, bloqueio_id, minutos, cortesia_min, valor, neto, obs, criado_por)
      values (c.jetski, c.data, make_time(achou / 60, achou % 60, 0), make_time(achou / 60, achou % 60, 0) + make_interval(mins => k.tot), 'uso', c.lancha, bid,
              k.tot, coalesce(k.cortesia, 0), k.valor, k.neto, 'Segurado na aprovação (pedido do Lucas)', auth.uid());
    return jsonb_build_object('ok', true, 'ini', to_char(make_time(achou / 60, achou % 60, 0), 'HH24:MI'), 'minutos', k.tot,
      'cortesia', nullif(k.cortesia, 0), 'valor', k.valor, 'mudou_horario', achou <> extract(epoch from k.ini)::int / 60);
  exception when others then
    err := sqlerrm;
    update public.anotacoes set obs = left(concat_ws(' · ', nullif(obs, ''), 'Jetski ficou de fora: ' || err), 300) where bloqueio_id = bid;
    return jsonb_build_object('ok', false, 'erro', err);
  end;
end $$;

-- Lançamento do Lucas com jetski (mesmo lancar_reserva_operador + jetski opcional).
create or replace function public.lancar_reserva_com_jetski(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text,
  p_embarque text default null, p_valor numeric default null, p_sinal numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null,
  p_jetski uuid default null, p_jetski_min int default null, p_jetski_ini text default null, p_jetski_cortesia boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare nid bigint; r jsonb; k record; ji time; jr jsonb; u public.jetski_usos;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if p_jetski is not null then
    if coalesce(p_jetski_ini, '') !~ '^\d{1,2}:\d{2}$' then raise exception 'JETSKI_HORARIO: horário do jetski no formato HH:MM.'; end if;
    ji := p_jetski_ini::time;
    select * into k from public._jetski_confere(p_jetski, p_lancha, p_horario, p_hora_ini, p_hora_fim, p_jetski_min, ji, p_jetski_cortesia, public.e_admin());
    if public.jetski_choca(p_jetski, p_data, k.ini, k.ini + make_interval(mins => k.tot), p_lancha, null) then
      raise exception 'JETSKI_OCUPADO: o jetski já está ocupado nesse horário. Livres para %: %', public.jetski_min_txt(k.tot),
        coalesce(nullif(array_to_string(public._jetski_livres(p_jetski, p_data, p_lancha, p_horario, p_hora_ini, p_hora_fim, k.tot), ', '), ''), 'nenhum');
    end if;
  end if;
  nid := public.lancar_pedido_operador(p_lancha, p_data, p_horario, p_pessoas, p_nome, p_tel, p_email, p_lang, p_embarque, p_valor, p_sinal, p_hora_ini, p_hora_fim, p_obs);
  if p_jetski is null then
    update public.consultas set jetski = null, jetski_min = null, jetski_ini = null, jetski_cortesia = null where id = nid and jetski is not null;
  else
    jr := jsonb_build_object('tempo', public.jetski_min_txt(k.tot), 'ini', to_char(k.ini, 'HH24:MI'), 'cortesia', nullif(k.cortesia, 0), 'valor', k.valor);
    update public.consultas set jetski = p_jetski, jetski_min = p_jetski_min, jetski_ini = k.ini, jetski_cortesia = k.cortesia > 0,
           obs = left(concat_ws(' · ', nullif(obs, ''), 'Jetski ' || public.jetski_min_txt(k.tot) || ' às ' || to_char(k.ini, 'HH24:MI')
                 || case when k.cortesia > 0 then ' (com ' || k.cortesia || ' min de cortesia)' else '' end
                 || case when k.valor > 0 then ', R$ ' || k.valor else ', cortesia' end), 300)
     where id = nid;
  end if;
  if not public.lancha_auto(p_lancha) then return jsonb_build_object('cid', nid, 'auto', false, 'jetski', jr); end if;
  perform set_config('app.auto_op', '1', true);
  r := public._aprovar_consulta(nid, false);
  perform set_config('app.auto_op', '', true);
  if p_jetski is not null then
    select * into u from public.jetski_usos where bloqueio_id = (r->>'bid')::bigint and removido_em is null order by id limit 1;
    jr := case when u.id is null then jsonb_build_object('ok', false, 'erro', 'o jetski não coube na aprovação; a lancha foi lançada sem ele')
               else jsonb_build_object('ok', true, 'tempo', public.jetski_min_txt(u.minutos), 'ini', to_char(u.ini, 'HH24:MI'), 'cortesia', u.cortesia_min, 'valor', u.valor) end;
  end if;
  return r || jsonb_build_object('auto', true, 'cid', nid, 'jetski', jr);
end $$;
revoke all on function public.lancar_reserva_com_jetski(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text, uuid, int, text, boolean) from public, anon;
grant execute on function public.lancar_reserva_com_jetski(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text, uuid, int, text, boolean) to authenticated;
revoke all on function public.jetski_cotar(text, date, text, text, text) from public, anon;
grant execute on function public.jetski_cotar(text, date, text, text, text) to authenticated;
revoke all on function public._jetski_confere(uuid, text, text, text, text, int, time, boolean, boolean) from public, anon, authenticated;
revoke all on function public._jetski_livres(uuid, date, text, text, text, text, int) from public, anon, authenticated;
revoke all on function public._jetski_segura(bigint, public.consultas) from public, anon, authenticated;

-- Aprovação: _aprovar_consulta (sem mudança) insere a anotação logo depois do bloqueio e antes do convite.
-- Esse gatilho acha a consulta do mesmo cliente/lancha/dia/horário e segura o jetski no bloqueio.
create or replace function public.tg_anotacao_jetski_segura()
returns trigger language plpgsql set search_path = public as $$
declare b public.bloqueios; c public.consultas;
begin
  if new.origem is distinct from 'buzios' or current_user in ('authenticated', 'anon') then return null; end if;
  select * into b from public.bloqueios where id = new.bloqueio_id;
  if b.id is null then return null; end if;
  select * into c from public.consultas x
   where x.jetski is not null and x.lancha = b.lancha and x.data = b.data and x.horario = b.horario
     and regexp_replace(coalesce(x.telefone, ''), '\D', '', 'g') = regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g')
     and length(regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g')) >= 8
   order by x.id desc limit 1;
  if c.id is null then return null; end if;
  if exists (select 1 from public.jetski_usos u where u.bloqueio_id = b.id and u.removido_em is null) then return null; end if;
  perform public._jetski_segura(b.id, c);
  return null;
end $$;
create or replace trigger zz_anotacao_jetski_segura after insert on public.anotacoes for each row execute function public.tg_anotacao_jetski_segura();

-- Pedido criado a partir do bloqueio (só pelas funções do sistema, nunca direto pelo cliente): herda o jetski segurado.
create or replace function public.tg_pedido_jetski_segurado()
returns trigger language plpgsql set search_path = public as $$
declare h public.jetski_usos; j public.jetskis; w record; a int; m int;
begin
  perform set_config('app.jetski_segurado', '', true);
  if new.bloqueio_id is null or new.jetski is not null or current_user in ('authenticated', 'anon') then return new; end if;
  select * into h from public.jetski_usos u where u.bloqueio_id = new.bloqueio_id and u.pedido_id is null and u.removido_em is null and u.tipo = 'uso' order by u.id limit 1;
  if h.id is null then return new; end if;
  select * into j from public.jetskis where id = h.jetski;
  w := public.jetski_janela(new.horario, new.hora_ini, new.hora_fim);
  a := extract(epoch from h.ini)::int / 60;
  m := h.minutos - coalesce(h.cortesia_min, 0);
  if j.id is null or not j.ativo or w.ini is null or w.fim is null or a < w.ini + 60 or a + h.minutos > w.fim - 60
     or (m > 0 and public.jetski_neto(j, m) is null) or (m <= 0 and coalesce(h.cortesia_min, 0) = 0)
     or (coalesce(h.cortesia_min, 0) > 0 and j.cortesia_lancha is distinct from new.lancha)
     or exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then
    update public.jetski_usos set removido_em = now(), obs = left(concat_ws(' · ', obs, 'não coube no pedido'), 200) where id = h.id;
    return new;
  end if;
  new.jetski := h.jetski; new.jetski_ini := h.ini; new.jetski_min := nullif(m, 0); new.jetski_cortesia := nullif(h.cortesia_min, 0);
  perform set_config('app.jetski_segurado', h.id::text, true);
  return new;
end $$;
create or replace trigger a_pedido_jetski_segurado before insert on public.pedidos for each row execute function public.tg_pedido_jetski_segurado();

-- tg_pedido_jetski: jetski oculto passa só quando vem do segurado (pedido do Lucas aprovado pelo sistema).
CREATE OR REPLACE FUNCTION public.tg_pedido_jetski()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare j public.jetskis; w record; a int; n numeric; c int; tot int; mudou boolean; escolha boolean; uid bigint; s int; achou int; segurado boolean;
begin
  if tg_op = 'UPDATE' then
    if (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_valor, new.jetski_neto, new.jetski_cortesia) is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_valor, old.jetski_neto, old.jetski_cortesia)
       and auth.uid() is not null and not public.e_admin() then
      new.jetski := old.jetski; new.jetski_min := old.jetski_min; new.jetski_ini := old.jetski_ini; new.jetski_valor := old.jetski_valor; new.jetski_neto := old.jetski_neto; new.jetski_cortesia := old.jetski_cortesia;
    end if;
    if new.jetski_repasse is distinct from old.jetski_repasse or new.jetski_repasse_em is distinct from old.jetski_repasse_em then
      if auth.uid() is not null and not public.e_admin() then new.jetski_repasse := old.jetski_repasse; new.jetski_repasse_em := old.jetski_repasse_em; end if;
    end if;
    mudou := (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_cortesia, new.lancha, new.data, new.horario, new.hora_ini, new.hora_fim)
             is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_cortesia, old.lancha, old.data, old.horario, old.hora_ini, old.hora_fim);
    if not mudou then return new; end if;
    escolha := (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_cortesia) is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_cortesia);
    if not escolha and new.status not in ('pendente', 'aprovado') then return new; end if;
  else
    new.jetski_repasse := null; new.jetski_repasse_em := null;
    escolha := true;
  end if;
  if new.jetski is null then
    new.jetski_min := null; new.jetski_ini := null; new.jetski_valor := null; new.jetski_neto := null; new.jetski_cortesia := null; return new;
  end if;
  segurado := tg_op = 'INSERT' and coalesce(current_setting('app.jetski_segurado', true), '') <> '';
  select * into j from public.jetskis where id = new.jetski;
  if j.id is null or not j.ativo or (escolha and j.oculto and not public.e_admin() and not segurado) then
    raise exception 'JETSKI_INDISPONIVEL: este jetski não está disponível.'; end if;
  if exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then
    raise exception 'JETSKI_SO_LANCHA: jetski só vai junto com lancha, não com escuna. Tire o jetski do pedido antes.'; end if;
  c := case when coalesce(new.jetski_cortesia,0) > 0 and j.cortesia_lancha = new.lancha and coalesce(j.cortesia_min,0) > 0 then j.cortesia_min else 0 end;
  new.jetski_cortesia := nullif(c, 0);
  if new.jetski_ini is null or (new.jetski_min is null and c = 0) then raise exception 'JETSKI_HORARIO: escolha o tempo e o horário do jetski.'; end if;
  if new.jetski_min is null then n := null;
  else
    n := public.jetski_neto(j, new.jetski_min);
    if n is null or n <= 0 then raise exception 'JETSKI_TEMPO: esse tempo de jetski não está à venda.'; end if;
  end if;
  tot := coalesce(new.jetski_min, 0) + c;
  w := public.jetski_janela(new.horario, new.hora_ini, new.hora_fim);
  if w.ini is null or w.fim is null then
    raise exception 'JETSKI_JANELA: o jetski não vai em passeio noturno nem que passa da meia-noite. Tire o jetski do pedido antes.'; end if;
  a := extract(epoch from new.jetski_ini)::int / 60;
  if not escolha then
    select id into uid from public.jetski_usos where pedido_id = new.id and removido_em is null limit 1;
    achou := null;
    for s in select x from generate_series(w.ini + 60, w.fim - 60 - tot, 30) x order by (x = a) desc, x loop
      if not public.jetski_choca(new.jetski, new.data, make_time(s / 60, s % 60, 0), make_time(s / 60, s % 60, 0) + make_interval(mins => tot), new.lancha, uid) then
        achou := s; exit;
      end if;
    end loop;
    if achou is null then
      raise exception 'JETSKI_OCUPADO: o jetski deste pedido (%) não cabe no novo dia/horário (ocupado ou janela curta). Tire o jetski do pedido ou escolha outro horário.', public.jetski_min_txt(tot);
    end if;
    a := achou; new.jetski_ini := make_time(a / 60, a % 60, 0);
  end if;
  if a % 30 <> 0 or a < w.ini + 60 or a + tot > w.fim - 60 then
    raise exception 'JETSKI_JANELA: o jetski tem de começar 1 h depois da saída e terminar 1 h antes da volta.'; end if;
  new.jetski_neto := n; new.jetski_valor := case when n is null then null else public.jetski_valor(n) end;
  if tg_op = 'UPDATE' and (new.jetski, new.jetski_min) is not distinct from (old.jetski, old.jetski_min) and old.jetski_valor is not null
     and (exists (select 1 from public.pagamentos_asaas x where x.pedido = new.id and x.pago_em is not null)
          or exists (select 1 from public.pagamentos_pp x where x.pedido = new.id and x.pago_em is not null)) then
    new.jetski_neto := old.jetski_neto; new.jetski_valor := old.jetski_valor;
  end if;
  return new;
end $function$;

-- tg_pedido_jetski_uso: o pedido que herdou o jetski adota a linha segurada (mesmo id, não choca consigo mesma).
CREATE OR REPLACE FUNCTION public.tg_pedido_jetski_uso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare vivo boolean := new.status = 'aprovado' or (new.status = 'pendente' and (new.prazo_vencido_em is null or new.comprovante_em is not null));
  u bigint; a time; f time; tot int; tolera boolean; h bigint;
begin
  select id into u from public.jetski_usos where pedido_id = new.id and removido_em is null limit 1;
  if u is null and tg_op = 'INSERT' and new.jetski is not null then
    h := nullif(current_setting('app.jetski_segurado', true), '')::bigint;
    perform set_config('app.jetski_segurado', '', true);
    if h is not null then
      begin
        update public.jetski_usos set pedido_id = new.id, ini = new.jetski_ini,
          fim = new.jetski_ini + make_interval(mins => coalesce(new.jetski_min, 0) + coalesce(new.jetski_cortesia, 0)),
          minutos = coalesce(new.jetski_min, 0) + coalesce(new.jetski_cortesia, 0), cortesia_min = coalesce(new.jetski_cortesia, 0),
          lancha = new.lancha, valor = new.jetski_valor, neto = new.jetski_neto
        where id = h and bloqueio_id = new.bloqueio_id and pedido_id is null and removido_em is null and jetski = new.jetski
        returning id into u;
      exception when raise_exception then u := null;
      end;
      if u is not null then
        if not vivo then update public.jetski_usos set removido_em = now() where id = u; end if;
        return null;
      end if;
    end if;
  end if;
  if new.jetski is null or not vivo then
    if u is not null then update public.jetski_usos set removido_em = now() where id = u; end if;
    return null;
  end if;
  tot := coalesce(new.jetski_min, 0) + coalesce(new.jetski_cortesia, 0);
  a := new.jetski_ini; f := new.jetski_ini + make_interval(mins => tot);
  if u is null then
    -- veio do segurado e não deu para adotar: nunca derruba a criação do pedido (avisa o conflito)
    tolera := (tg_op = 'UPDATE' and (new.status = 'aprovado' or new.prazo_vencido_em is not null)) or h is not null;
    if tolera then
      begin
        insert into public.jetski_usos (jetski, data, ini, fim, tipo, lancha, pedido_id, bloqueio_id, minutos, valor, neto, criado_por)
          values (new.jetski, new.data, a, f, 'uso', new.lancha, new.id, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto, new.cliente);
      exception when raise_exception then
        raise warning 'JETSKI_CONFLITO pedido % pago mas o jetski ficou ocupado', new.id;
        perform public.jetski_avisa_conflito(new.id);
      end;
    else
      insert into public.jetski_usos (jetski, data, ini, fim, tipo, lancha, pedido_id, bloqueio_id, minutos, valor, neto, criado_por)
        values (new.jetski, new.data, a, f, 'uso', new.lancha, new.id, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto, new.cliente);
    end if;
  else
    update public.jetski_usos set jetski = new.jetski, data = new.data, ini = a, fim = f, lancha = new.lancha, bloqueio_id = new.bloqueio_id,
      minutos = tot, valor = new.jetski_valor, neto = new.jetski_neto
    where id = u and (jetski, data, ini, fim, lancha, bloqueio_id, minutos, valor, neto)
      is distinct from (new.jetski, new.data, a, f, new.lancha, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto);
  end if;
  return null;
end $function$;

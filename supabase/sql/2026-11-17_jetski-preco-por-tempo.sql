-- publicar: auto
-- Preço do jet ski por tempo e por temporada (Rodrigo 2026-11-17):
-- * o dono escolhe quanto cobra em cada tempo: 30 min, 1h, 1h30, 2h, 2h30 e 3h (não é mais proporcional à hora);
-- * cada temporada tem a sua tabela (baixa, média, alta, réveillon/carnaval), mesmas épocas de _epoca();
-- * tempo sem valor ou com 0 = o dono não vende esse tempo (não aparece no site nem para o Lucas);
-- * temporada toda vazia usa a anterior (réveillon -> alta -> média -> baixa).
-- Chaves em jetskis.precos: "baixa:30", "media:60"... As chaves antigas ("60") continuam valendo o ano todo.
-- Idempotente: só CREATE OR REPLACE.

-- 1) valor neto do dono num tempo e numa época
create or replace function public._jetski_neto_ep(j public.jetskis, m int, e text)
returns numeric language plpgsql immutable set search_path to 'public' as $$
declare ord text[] := array['reveillon','alta','media','baixa']; i int; v numeric;
begin
  if m is null or m < 30 or m > 180 or m % 30 <> 0 then return null; end if;
  i := coalesce(array_position(ord, e), 4);
  for k in i..4 loop
    if exists (select 1 from jsonb_object_keys(coalesce(j.precos, '{}'::jsonb)) x where x like ord[k] || ':%') then
      v := nullif(j.precos->>(ord[k] || ':' || m), '')::numeric;
      return case when v > 0 then v end;
    end if;
  end loop;
  -- formato antigo: mesmo valor o ano todo (mínimo 1 h)
  if m < 60 then return null; end if;
  if j.precos ? (m::text) then v := nullif(j.precos->>(m::text), '')::numeric; return case when v > 0 then v end; end if;
  if j.neto_hora > 0 then return round(j.neto_hora * m / 600.0) * 10; end if;
  return null;
end $$;

create or replace function public.jetski_neto(j public.jetskis, m int, d date)
returns numeric language sql immutable set search_path to 'public' as $$
  select public._jetski_neto_ep(j, m, public._epoca(d))
$$;

-- versão antiga (sem data): usa a época de hoje; nada novo chama mais
create or replace function public.jetski_neto(j public.jetskis, m int)
returns numeric language sql stable set search_path to 'public' as $$
  select public._jetski_neto_ep(j, m, public._epoca((now() at time zone 'America/Sao_Paulo')::date))
$$;

-- 2) conferência com a data do passeio (a temporada sai da data)
create or replace function public._jetski_confere(p_jetski uuid, p_lancha text, p_horario text, p_hi text, p_hf text, p_min integer, p_ini time without time zone, p_cortesia boolean, p_oculto_ok boolean, p_data date, OUT ini time without time zone, OUT tot integer, OUT cortesia integer, OUT valor numeric, OUT neto numeric)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    neto := public.jetski_neto(j, p_min, p_data);
    if neto is null or neto <= 0 then raise exception 'JETSKI_TEMPO: esse tempo de jetski não está à venda nessa data (veja a tabela do jetski_cotar).'; end if;
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
end $function$;
revoke execute on function public._jetski_confere(uuid,text,text,text,text,integer,time,boolean,boolean,date) from public, anon, authenticated;

create or replace function public._jetski_segura(bid bigint, c consultas)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k record; s int; achou int; w record; err text;
begin
  if c.jetski is null then return null; end if;
  begin
    select * into k from public._jetski_confere(c.jetski, c.lancha, c.horario, c.hora_ini, c.hora_fim, c.jetski_min, c.jetski_ini, c.jetski_cortesia, true, c.data);
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
end $function$;

create or replace function public.lancar_reserva_com_jetski(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text DEFAULT NULL::text, p_valor numeric DEFAULT NULL::numeric, p_sinal numeric DEFAULT NULL::numeric, p_hora_ini text DEFAULT NULL::text, p_hora_fim text DEFAULT NULL::text, p_obs text DEFAULT NULL::text, p_jetski uuid DEFAULT NULL::uuid, p_jetski_min integer DEFAULT NULL::integer, p_jetski_ini text DEFAULT NULL::text, p_jetski_cortesia boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nid bigint; r jsonb; k record; ji time; jr jsonb; u public.jetski_usos;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if p_jetski is not null then
    if coalesce(p_jetski_ini, '') !~ '^\d{1,2}:\d{2}$' then raise exception 'JETSKI_HORARIO: horário do jetski no formato HH:MM.'; end if;
    ji := p_jetski_ini::time;
    select * into k from public._jetski_confere(p_jetski, p_lancha, p_horario, p_hora_ini, p_hora_fim, p_jetski_min, ji, p_jetski_cortesia, public.e_admin(), p_data);
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
end $function$;

-- 3) cotação do Lucas: tabela da temporada da data, de 30 min a 3 h, só os tempos à venda
create or replace function public.jetski_cotar(p_lancha text, p_data date, p_horario text, p_hora_ini text DEFAULT NULL::text, p_hora_fim text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    for m in select g from generate_series(30, 180, 30) g where public.jetski_neto(j, g, p_data) > 0 loop
      tab := tab || jsonb_build_array(jsonb_build_object('min', m, 'tempo', public.jetski_min_txt(m), 'valor', public.jetski_valor(public.jetski_neto(j, m, p_data)),
        'livres', public._jetski_livres(j.id, p_data, p_lancha, p_horario, p_hora_ini, p_hora_fim, m))
        || case when c > 0 then jsonb_build_object('livres_com_cortesia', public._jetski_livres(j.id, p_data, p_lancha, p_horario, p_hora_ini, p_hora_fim, m + c)) else '{}'::jsonb end);
    end loop;
    if jsonb_array_length(tab) = 0 and c = 0 then continue; end if;
    r := r || jsonb_build_array(jsonb_build_object('id', j.id, 'nome', j.nome, 'modelo', j.modelo, 'oculto', j.oculto, 'tabela', tab,
      'cortesia_min', nullif(c, 0),
      'cortesia_livres', case when c > 0 then to_jsonb(public._jetski_livres(j.id, p_data, p_lancha, p_horario, p_hora_ini, p_hora_fim, c)) end));
  end loop;
  return jsonb_build_object('jetskis', r, 'janela', to_char(make_time((w.ini + 60) / 60, (w.ini + 60) % 60, 0), 'HH24:MI') || '-' || to_char(make_time((w.fim - 60) / 60, (w.fim - 60) % 60, 0), 'HH24:MI'),
    'regras', 'só os tempos da tabela (o dono escolhe o valor de cada tempo e de cada temporada); começa 1h depois da saída e termina 1h antes da volta; valor pago inteiro online junto com o sinal; cortesia só se o cliente quiser');
end $function$;

-- 4) pedido: valor pela temporada da data do passeio
create or replace function public.tg_pedido_jetski()
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
    n := public.jetski_neto(j, new.jetski_min, new.data);
    if n is null or n <= 0 then
      -- pedido já pago que mudou de data: o tempo combinado continua, com o valor já pago (abaixo)
      if not (tg_op = 'UPDATE' and not escolha and old.jetski_valor is not null) then
        raise exception 'JETSKI_TEMPO: esse tempo de jetski não está à venda nessa data.'; end if;
    end if;
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
  if n is null or n <= 0 then
    if new.jetski_min is not null then new.jetski_neto := old.jetski_neto; new.jetski_valor := old.jetski_valor; return new; end if;
    new.jetski_neto := null; new.jetski_valor := null;
  else
    new.jetski_neto := n; new.jetski_valor := public.jetski_valor(n);
  end if;
  if tg_op = 'UPDATE' and (new.jetski, new.jetski_min) is not distinct from (old.jetski, old.jetski_min) and old.jetski_valor is not null
     and (exists (select 1 from public.pagamentos_asaas x where x.pedido = new.id and x.pago_em is not null)
          or exists (select 1 from public.pagamentos_pp x where x.pedido = new.id and x.pago_em is not null)) then
    new.jetski_neto := old.jetski_neto; new.jetski_valor := old.jetski_valor;
  end if;
  return new;
end $function$;

create or replace function public.tg_pedido_jetski_segurado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
     or (m > 0 and public.jetski_neto(j, m, new.data) is null) or (m <= 0 and coalesce(h.cortesia_min, 0) = 0)
     or (coalesce(h.cortesia_min, 0) > 0 and j.cortesia_lancha is distinct from new.lancha)
     or exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then
    update public.jetski_usos set removido_em = now(), obs = left(concat_ws(' · ', obs, 'não coube no pedido'), 200) where id = h.id;
    return new;
  end if;
  new.jetski := h.jetski; new.jetski_ini := h.ini; new.jetski_min := nullif(m, 0); new.jetski_cortesia := nullif(h.cortesia_min, 0);
  perform set_config('app.jetski_segurado', h.id::text, true);
  return new;
end $function$;

-- 5) site: tabela de cada temporada (o site escolhe pela data do passeio)
create or replace function public.jetskis_site_v2()
returns table (id uuid, nome text, modelo text, pessoas int, chave_aprendiz boolean, min_minutos int, fotos jsonb,
               cortesia_lancha text, cortesia_min int, tabela jsonb, tabelas jsonb)
language sql stable security definer set search_path to 'public' as $$
  select j.id, j.nome, j.modelo, j.pessoas, j.chave_aprendiz, j.min_minutos, j.fotos, j.cortesia_lancha, j.cortesia_min,
    (select coalesce(jsonb_agg(jsonb_build_object('min', m, 'valor', public.jetski_valor(public.jetski_neto(j, m, (now() at time zone 'America/Sao_Paulo')::date))) order by m), '[]'::jsonb)
       from generate_series(30, 180, 30) m where public.jetski_neto(j, m, (now() at time zone 'America/Sao_Paulo')::date) > 0),
    (select jsonb_object_agg(e, (select coalesce(jsonb_agg(jsonb_build_object('min', m, 'valor', public.jetski_valor(public._jetski_neto_ep(j, m, e))) order by m), '[]'::jsonb)
                                   from generate_series(30, 180, 30) m where public._jetski_neto_ep(j, m, e) > 0))
       from unnest(array['baixa','media','alta','reveillon']) e)
  from public.jetskis j
  where j.ativo and not j.oculto and (j.neto_hora is not null or j.precos <> '{}'::jsonb)
  order by j.criado_em
$$;
grant execute on function public.jetskis_site_v2() to anon, authenticated;

-- 6) salvar: aceita "temporada:minutos" (30 a 180, de 30 em 30) e 0 (= não vende esse tempo)
create or replace function public.jetski_salvar(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid := nullif(p->>'id','')::uuid; v public.jetskis; adm boolean := public.e_admin();
  k text; val text; fotos jsonb; cl text; cm int; mm int;
begin
  if auth.uid() is null then raise exception 'SEM_LOGIN'; end if;
  if v_id is null then
    if not adm then raise exception 'SO_ADMIN'; end if;
    if nullif(p->>'dono','') is null then raise exception 'SEM_DONO'; end if;
    insert into public.jetskis(nome, dono) values (left(coalesce(nullif(trim(p->>'nome'),''),'Jetski'),60), (p->>'dono')::uuid) returning id into v_id;
  elsif not public.pode_jetski(v_id) then raise exception 'SEM_PERMISSAO';
  end if;
  select * into v from public.jetskis where id = v_id for update;
  if p ? 'nome' then v.nome := left(coalesce(nullif(trim(p->>'nome'),''), v.nome), 60); end if;
  if p ? 'modelo' then v.modelo := nullif(left(trim(coalesce(p->>'modelo','')),60),''); end if;
  if p ? 'pessoas' then v.pessoas := greatest(1, least(3, coalesce((p->>'pessoas')::int, 2))); end if;
  if p ? 'chave_aprendiz' then v.chave_aprendiz := coalesce((p->>'chave_aprendiz')::boolean, true); end if;
  if p ? 'min_minutos' then v.min_minutos := (p->>'min_minutos')::int; end if;
  if p ? 'neto_hora' then v.neto_hora := nullif(p->>'neto_hora','')::numeric; end if;
  if p ? 'precos' then
    if jsonb_typeof(p->'precos') <> 'object' then raise exception 'PRECOS'; end if;
    for k, val in select * from jsonb_each_text(p->'precos') loop
      if k ~ '^(baixa|media|alta|reveillon):\d{2,3}$' then
        mm := split_part(k, ':', 2)::int;
        if mm < 30 or mm > 180 or mm % 30 <> 0 then raise exception 'PRECOS'; end if;
      elsif k ~ '^\d{2,3}$' then
        if k::int < 15 or k::int > 180 or k::int % 15 <> 0 then raise exception 'PRECOS'; end if;
      else raise exception 'PRECOS';
      end if;
      if val is not null and val <> '' and (val !~ '^\d+(\.\d+)?$' or val::numeric < 0 or val::numeric > 30000) then raise exception 'PRECOS'; end if;
    end loop;
    select coalesce(jsonb_object_agg(key, to_jsonb(value::numeric)), '{}'::jsonb) into v.precos
      from jsonb_each_text(p->'precos') where value is not null and value <> '';
    -- tempo maior nunca sai mais caro por minuto que um tempo menor (Rodrigo 2026-11-17: 2 h no máximo o dobro de 1 h)
    select a.e || ':' || b.m into k
      from (select split_part(key, ':', 1) e, split_part(key, ':', 2)::int m, value::numeric x from jsonb_each_text(v.precos) where key like '%:%') a
      join (select split_part(key, ':', 1) e, split_part(key, ':', 2)::int m, value::numeric x from jsonb_each_text(v.precos) where key like '%:%') b
        on b.e = a.e and b.m > a.m and a.x > 0 and b.x > 0 and b.x * a.m > a.x * b.m
      order by b.m limit 1;
    if k is not null then raise exception 'PRECO_SOBE:%', k; end if;
  end if;
  if p ? 'fotos' then
    fotos := p->'fotos';
    if jsonb_typeof(fotos) <> 'array' or jsonb_array_length(fotos) > 15 then raise exception 'FOTOS'; end if;
    if exists (select 1 from jsonb_array_elements_text(fotos) f
               where f !~ ('^https://sqoperylsqcbcjpcrlnp\.supabase\.co/storage/v1/object/public/lanchas/jetski-' || v_id::text || '/[A-Za-z0-9._-]+$')) then
      raise exception 'FOTOS'; end if;
    v.fotos := fotos;
  end if;
  if p ? 'cortesia_lancha' or p ? 'cortesia_min' then
    cl := case when p ? 'cortesia_lancha' then nullif(p->>'cortesia_lancha','') else v.cortesia_lancha end;
    cm := case when p ? 'cortesia_min' then coalesce((p->>'cortesia_min')::int, 0) else v.cortesia_min end;
    if cl is not null and not (adm or exists (select 1 from public.donos d where d.lancha = cl and d.user_id = v.dono)) then raise exception 'CORTESIA_LANCHA'; end if;
    if cl is not null and exists (select 1 from public.lanchas l where l.slug = cl and l.dados->>'tipo' = 'escuna') then raise exception 'CORTESIA_LANCHA'; end if;
    v.cortesia_lancha := cl; v.cortesia_min := case when cl is null then 0 else cm end;
  end if;
  if p ? 'oculto' then v.oculto := coalesce((p->>'oculto')::boolean, true); end if;
  if adm and p ? 'ativo' then v.ativo := coalesce((p->>'ativo')::boolean, true); end if;
  if adm and p ? 'dono' and nullif(p->>'dono','') is not null then v.dono := (p->>'dono')::uuid; end if;
  update public.jetskis set nome = v.nome, modelo = v.modelo, pessoas = v.pessoas, chave_aprendiz = v.chave_aprendiz,
    min_minutos = v.min_minutos, neto_hora = v.neto_hora, precos = v.precos, fotos = v.fotos,
    cortesia_lancha = v.cortesia_lancha, cortesia_min = v.cortesia_min, oculto = v.oculto, ativo = v.ativo, dono = v.dono,
    atualizado_em = now()
  where id = v_id;
  return v_id;
end $function$;

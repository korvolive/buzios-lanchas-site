-- publicar: auto
-- Disponibilidade pelo horário REAL, não só pelo turno (Rodrigo 2026-11-22).
-- Caso: Compostela vendida hoje das 11h às 15h (turno "manha"); o turno "tarde" aparecia livre e o Lucas ofereceu 14h às 18h.
-- Regra: qualquer sobreposição de horário bloqueia. Depois de uma manhã que termina entre 14h e 15h, a tarde continua à venda
-- deslocada (do fim da manhã até 4 horas depois, no máximo 19h), como periodos_ajustados() já faz no site.
-- Sem anotação de horário, vale o padrão do turno: manhã 10h-14h, tarde 14h-18h, dia 10h-17h, noite (31/12) 20h-4h.
-- Linhas de revenda não são passeio da lancha e ficam de fora (como no site).
-- Sem dado de cliente; idempotente.

-- "11:30" -> 690 (minutos do dia); qualquer outra coisa -> null
create or replace function public._hm_min(t text)
returns int language sql immutable set search_path = public as $$
  select case when t ~ '^\s*\d{1,2}:\d{2}' then split_part(trim(t), ':', 1)::int * 60 + substr(split_part(trim(t), ':', 2), 1, 2)::int end
$$;

-- janela em minutos [início, fim) pelo horário anotado ou, sem ele, pelo padrão do turno (passar da meia-noite soma 1440)
create or replace function public._janela_min(h text, hi text, hf text)
returns int4range language sql immutable set search_path = public as $$
  select case
    when public._hm_min(hi) is not null and public._hm_min(hf) is not null then
      int4range(public._hm_min(hi), public._hm_min(hf) + case when public._hm_min(hf) <= public._hm_min(hi) then 1440 else 0 end)
    else case h when 'manha' then int4range(600, 840) when 'tarde' then int4range(840, 1080)
                when 'dia' then int4range(600, 1020) when 'noite' then int4range(1200, 1680) end
  end
$$;

-- janela que um passeio ocupa/ocuparia: horário anotado; sem ele, tarde depois de manhã terminando entre 14h e 15h fica deslocada
create or replace function public._janela_pedida(p_lancha text, p_data date, p_horario text, p_hi text, p_hf text, p_ignorar bigint default null)
returns int4range language plpgsql stable security definer set search_path = public as $$
declare fim int;
begin
  if (public._hm_min(p_hi) is not null and public._hm_min(p_hf) is not null) or p_horario is distinct from 'tarde' then
    return public._janela_min(p_horario, p_hi, p_hf);
  end if;
  select max(upper(public._janela_min(b.horario, a.hora_ini, a.hora_fim))) into fim
    from public.bloqueios b left join public.anotacoes a on a.bloqueio_id = b.id
   where b.lancha = p_lancha and b.data = p_data and b.revenda is null and b.horario = 'manha' and b.id is distinct from p_ignorar;
  if fim > 840 and fim <= 900 then return int4range(fim, fim + 240); end if;
  return public._janela_min(p_horario, p_hi, p_hf);
end $$;

-- algum passeio da lancha nesse dia cruza a janela pedida? (p_ignorar = o próprio passeio)
create or replace function public._choca_janela(p_lancha text, p_data date, p_horario text, p_hi text, p_hf text, p_ignorar bigint default null)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(exists (
    select 1 from public.bloqueios x left join public.anotacoes a on a.bloqueio_id = x.id
     where x.lancha = p_lancha and x.data = p_data and x.revenda is null and x.id is distinct from p_ignorar
       and public._janela_pedida(x.lancha, x.data, x.horario, a.hora_ini, a.hora_fim, x.id)
           && public._janela_pedida(p_lancha, p_data, p_horario, p_hi, p_hf, p_ignorar)
  ), false)
$$;

revoke all on function public._janela_pedida(text, date, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public._choca_janela(text, date, text, text, text, bigint) from public, anon, authenticated;

-- Para o Lucas/ponte, painel e site: o turno está livre pelo horário real? Se estiver, com qual horário (ex.: tarde 15:00-19:00).
create or replace function public.janela_livre(p_lancha text, p_data date, p_horario text)
returns table(livre boolean, hora_ini text, hora_fim text)
language plpgsql stable security definer set search_path = public as $$
declare j int4range;
begin
  j := public._janela_pedida(p_lancha, p_data, p_horario, null, null, null);
  if j is null then return query select false, null::text, null::text; return; end if;
  return query select
    not public._choca_janela(p_lancha, p_data, p_horario, null, null, null)
      and not exists (select 1 from public.manutencoes m where m.lancha = p_lancha and m.de <= p_data and p_data <= m.ate),
    to_char(make_time((lower(j) / 60) % 24, lower(j) % 60, 0), 'HH24:MI'),
    to_char(make_time((upper(j) / 60) % 24, upper(j) % 60, 0), 'HH24:MI');
end $$;
revoke all on function public.janela_livre(text, date, text) from public;
grant execute on function public.janela_livre(text, date, text) to anon, authenticated, service_role;

-- Já usada no aprovar consulta e nas alternativas: agora reserva sem horário anotado conta pelo padrão do turno
create or replace function public._choca_horas_reais(p_lancha text, p_data date, p_hi text, p_hf text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_hi, '') <> '' and coalesce(p_hf, '') <> '' and public._choca_janela(p_lancha, p_data, null, p_hi, p_hf, null)
$$;

-- Trava final, vale para qualquer caminho (painel, Lucas, aprovação do dono, site, vendedor):
-- 1) anotação de tarde sem horário, depois de manhã terminando entre 14h e 15h, já nasce com o horário deslocado;
-- 2) nenhum passeio novo pode cruzar outro pelo horário real;
-- 3) mudar o horário de um passeio que já começou (atraso) continua livre.
create or replace function public.tg_anotacao_horario_real()
returns trigger language plpgsql security definer set search_path = public as $$
declare b public.bloqueios%rowtype; j int4range; hoje date := (now() at time zone 'America/Sao_Paulo')::date; agora int;
begin
  select * into b from public.bloqueios where id = new.bloqueio_id;
  if b.id is null or b.revenda is not null or b.data < hoje then return new; end if;
  if tg_op = 'INSERT' and b.horario = 'tarde' and (public._hm_min(new.hora_ini) is null or public._hm_min(new.hora_fim) is null) then
    j := public._janela_pedida(b.lancha, b.data, 'tarde', null, null, b.id);
    if j is not null and j <> int4range(840, 1080) then
      new.hora_ini := to_char(make_time(lower(j) / 60, lower(j) % 60, 0), 'HH24:MI');
      new.hora_fim := to_char(make_time((upper(j) / 60) % 24, upper(j) % 60, 0), 'HH24:MI');
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.hora_ini is not distinct from old.hora_ini and new.hora_fim is not distinct from old.hora_fim then return new; end if;
    agora := extract(hour from now() at time zone 'America/Sao_Paulo')::int * 60 + extract(minute from now() at time zone 'America/Sao_Paulo')::int;
    if b.data = hoje and lower(public._janela_pedida(b.lancha, b.data, b.horario, old.hora_ini, old.hora_fim, b.id)) <= agora then
      return new;
    end if;
  end if;
  if public._choca_janela(b.lancha, b.data, b.horario, new.hora_ini, new.hora_fim, b.id) then
    j := public._janela_pedida(b.lancha, b.data, b.horario, new.hora_ini, new.hora_fim, b.id);
    raise exception 'O horário das % às % cruza outra reserva da lancha % nesse dia',
      to_char(make_time((lower(j) / 60) % 24, lower(j) % 60, 0), 'HH24:MI'),
      to_char(make_time((upper(j) / 60) % 24, upper(j) % 60, 0), 'HH24:MI'), b.lancha
      using errcode = '23P01';
  end if;
  return new;
end $$;
revoke all on function public.tg_anotacao_horario_real() from public, anon, authenticated;

drop trigger if exists a00_horario_real on public.anotacoes;
create trigger a00_horario_real before insert or update of hora_ini, hora_fim on public.anotacoes
  for each row execute function public.tg_anotacao_horario_real();

-- Lancha alternativa sugerida: também pelo horário real
create or replace function public.alternativas_livres(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_hi text DEFAULT NULL::text, p_hf text DEFAULT NULL::text, p_max integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.lanchas%rowtype; s record; base numeric; pr numeric; out jsonb := '[]'::jsonb; lista jsonb := '[]'::jsonb;
begin
  select * into o from public.lanchas where slug = p_lancha;
  begin base := public.preco_tabela(p_lancha, p_data, p_horario); exception when others then base := null; end;
  for s in select l.* from public.lanchas l
            where l.slug <> p_lancha and coalesce(l.ativa, true) and not coalesce(l.oculta, false) and not public.e_exemplo(l.slug)
              and coalesce(l.dados->>'cidade', 'buzios') = coalesce(o.dados->>'cidade', 'buzios')
              and coalesce(l.dados->>'tipo', 'lancha') = coalesce(o.dados->>'tipo', 'lancha')
              and public._capacidade(l.slug) >= coalesce(p_pessoas, 1)
              and not exists (select 1 from public.bloqueios x where x.lancha = l.slug and x.data = p_data and public.choca_horario(x.horario, p_horario))
              and not exists (select 1 from public.manutencoes m where m.lancha = l.slug and m.de <= p_data and p_data <= m.ate)
              and not public._choca_janela(l.slug, p_data, p_horario, p_hi, p_hf, null)
  loop
    begin pr := public.preco_tabela(s.slug, p_data, p_horario); exception when others then pr := null; end;
    if not (pr > 0) then continue; end if;
    lista := lista || jsonb_build_object('slug', s.slug, 'nome', s.nome, 'cap', public._capacidade(s.slug), 'preco', pr,
      'ord', case when s.slug = 'miss-bardot' then -1 else abs(pr - coalesce(base, pr)) end);
  end loop;
  select coalesce(jsonb_agg(x - 'ord' order by (x->>'ord')::numeric), '[]'::jsonb) into out
    from (select x from jsonb_array_elements(lista) x order by (x->>'ord')::numeric limit greatest(coalesce(p_max, 2), 1)) t;
  return out;
end $function$;

-- Pagamento pelo site: a vaga também é conferida pelo horário real (antes de cobrar e antes de confirmar)
create or replace function public.pp_vaga(pid bigint, segurar boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record;
begin
  select id, lancha, data, horario, hora_ini, hora_fim, bloqueio_id, jetski, jetski_ini, jetski_min, jetski_cortesia into p from pedidos where id = pid;
  if not found then return 'pedido'; end if;
  perform pg_advisory_xact_lock(hashtext('vaga:' || p.lancha || ':' || p.data::text));
  if exists (select 1 from bloqueios b where b.lancha = p.lancha and b.data = p.data and b.revenda is null and choca_horario(b.horario, p.horario)
               and not exists (select 1 from pedidos q where q.id = pid and q.bloqueio_id = b.id))
     or public._choca_janela(p.lancha, p.data, p.horario, p.hora_ini, p.hora_fim, p.bloqueio_id)
     or exists (select 1 from pedidos o left join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and choca_horario(o.horario, p.horario)
                 and (o.status = 'aprovado' or (o.status = 'pendente' and (g.pago_em is not null or g.captura is not null or o.comprovante_em is not null))))
     or exists (select 1 from manutencoes m where m.lancha = p.lancha and p.data between m.de and m.ate) then
    return 'ocupada';
  end if;
  if p.jetski is not null and p.jetski_ini is not null
     and not exists (select 1 from jetski_usos u where u.pedido_id = pid and u.removido_em is null)
     and (not exists (select 1 from jetskis j where j.id = p.jetski and j.ativo)
          or public.jetski_choca(p.jetski, p.data, p.jetski_ini, p.jetski_ini + make_interval(mins => coalesce(p.jetski_min, 0) + coalesce(p.jetski_cortesia, 0)), p.lancha, null)) then
    return 'jetski';
  end if;
  if exists (select 1 from pedidos o join pagamentos_asaas a on a.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and o.status = 'pendente' and choca_horario(o.horario, p.horario)
                 and a.pago_em is null)
     or exists (select 1 from pedidos o join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and o.status = 'pendente' and choca_horario(o.horario, p.horario)
                 and g.reservado_em > now() - interval '10 minutes' and g.pago_em is null) then
    return 'pagando';
  end if;
  if segurar then update pagamentos_pp set reservado_em = now() where pedido = pid; end if;
  return 'livre';
end $function$;

create or replace function public.pp_vaga_h(pid bigint, h text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record;
begin
  select id, lancha, data, bloqueio_id into p from pedidos where id = pid;
  if not found then return 'pedido'; end if;
  if exists (select 1 from bloqueios b where b.lancha = p.lancha and b.data = p.data and b.revenda is null and choca_horario(b.horario, h)
               and not exists (select 1 from pedidos q where q.id = pid and q.bloqueio_id = b.id))
     or public._choca_janela(p.lancha, p.data, h, null, null, p.bloqueio_id)
     or exists (select 1 from pedidos o left join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and choca_horario(o.horario, h)
                 and (o.status = 'aprovado' or (o.status = 'pendente' and (g.pago_em is not null or g.captura is not null or o.comprovante_em is not null))))
     or exists (select 1 from manutencoes m where m.lancha = p.lancha and p.data between m.de and m.ate) then
    return 'ocupada';
  end if;
  if exists (select 1 from pedidos o join pagamentos_asaas a on a.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and o.status = 'pendente' and choca_horario(o.horario, h) and a.pago_em is null)
     or exists (select 1 from pedidos o join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = p.data and o.status = 'pendente' and choca_horario(o.horario, h)
                 and g.reservado_em > now() - interval '10 minutes' and g.pago_em is null) then
    return 'pagando';
  end if;
  return 'livre';
end $function$;

-- Confirmação do pagamento do site: confere o horário real e grava no passeio o horário do pedido (ex.: tarde 15h-19h)
create or replace function public.confirmar_pago(pid bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p pedidos; c clientes; bid bigint; tot numeric;
begin
  select * into p from pedidos where id = pid for update;
  if not found then return jsonb_build_object('erro', 'pedido'); end if;
  if p.status = 'aprovado' and p.bloqueio_id is not null then return jsonb_build_object('ja', true, 'bloqueio', p.bloqueio_id); end if;
  if p.status <> 'pendente' then return jsonb_build_object('erro', 'status'); end if;
  -- pré-reserva: o passeio já está na agenda guardando a data para este cliente; só falta o sinal
  if p.bloqueio_id is not null and exists (select 1 from bloqueios where id = p.bloqueio_id) then
    perform set_config('app.auto_op', '1', true);
    update anotacoes set sinal = p.sinal_valor
     where bloqueio_id = p.bloqueio_id and coalesce(sinal, 0) = 0 and coalesce(p.sinal_valor, 0) > 0;
    update pedidos set status = 'aprovado', atualizado_em = now() where id = pid and status = 'pendente';
    return jsonb_build_object('ok', true, 'bloqueio', p.bloqueio_id, 'pre', true);
  end if;
  perform pg_advisory_xact_lock(hashtext('vaga:' || p.lancha || ':' || p.data::text));
  if exists (select 1 from bloqueios b where b.lancha = p.lancha and b.data = p.data and b.revenda is null and choca_horario(b.horario, p.horario))
     or public._choca_janela(p.lancha, p.data, p.horario, p.hora_ini, p.hora_fim, null)
     or exists (select 1 from pedidos o where o.id <> pid and o.lancha = p.lancha and o.data = p.data and o.status = 'aprovado' and choca_horario(o.horario, p.horario))
     or exists (select 1 from manutencoes m where m.lancha = p.lancha and p.data between m.de and m.ate) then
    return jsonb_build_object('erro', 'ocupada');
  end if;
  select * into c from clientes where user_id = p.cliente;
  tot := nullif(coalesce(p.preco_cliente, p.preco_base), 0);
  if tot is not null and coalesce(p.cupom_valor, 0) > 0 then tot := tot - p.cupom_valor; end if;
  if tot is not null and tot < coalesce(p.sinal_valor, 0) then tot := null; end if;
  insert into bloqueios (lancha, data, horario) values (p.lancha, p.data, p.horario) returning id into bid;
  insert into anotacoes (bloqueio_id, origem, cliente, telefone, pessoas, valor, sinal, embarque, cliente_conta, hora_ini, hora_fim)
    values (bid, 'buzios', c.nome, c.whatsapp, p.pessoas, tot, p.sinal_valor, p.embarque, p.cliente, p.hora_ini, p.hora_fim);
  update pedidos set status = 'aprovado', bloqueio_id = bid, atualizado_em = now() where id = pid;
  return jsonb_build_object('ok', true, 'bloqueio', bid);
end $function$;

-- conferência (Compostela 22/11: manhã 11h-15h): tarde livre 15:00-19:00, manhã e dia ocupados
-- select * from public.janela_livre('compostela', '2026-11-22', 'tarde');

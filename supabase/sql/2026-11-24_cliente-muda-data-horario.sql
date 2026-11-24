-- publicar: auto
-- Búzios Lanchas (Rodrigo 2026-11-24): o próprio cliente muda a data (até 7 dias para trás ou para frente da data que pediu,
-- nunca antes de hoje) e o horário (manhã, tarde, dia todo) do pedido feito no site, na página de pagamento, antes de pagar.
-- Só horários livres, com o preço de tabela do novo dia. Lancha parceira: o pagamento espera o dono aprovar de novo
-- (a função dono-aprovacao manda o pedido de aprovação sozinha). Lancha automática: segue para o pagamento na hora
-- (réveillon e feriadão esperam o administrador, igual à liberação automática).
-- Fora do alcance (fala com o Lucas): pedido com pré-reserva lançada, vendedor, jetski, oferta, desconto de parceiro, grupo
-- ou preço combinado diferente da tabela. Idempotente. Funções só para o servidor (service_role).

alter table public.pedidos add column if not exists data_pedida date;

create or replace function public._vaga_pedido_em(pid bigint, d date, h text)
 returns text language plpgsql stable security definer set search_path to 'public'
as $function$
declare p record;
begin
  select id, lancha, bloqueio_id into p from pedidos where id = pid;
  if not found then return 'pedido'; end if;
  if exists (select 1 from bloqueios b where b.lancha = p.lancha and b.data = d and b.revenda is null and choca_horario(b.horario, h)
               and not exists (select 1 from pedidos q where q.id = pid and q.bloqueio_id = b.id))
     or public._choca_janela(p.lancha, d, h, null, null, p.bloqueio_id)
     or exists (select 1 from pedidos o left join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = d and choca_horario(o.horario, h)
                 and (o.status = 'aprovado' or (o.status = 'pendente' and (g.pago_em is not null or g.captura is not null or o.comprovante_em is not null))))
     or exists (select 1 from manutencoes m where m.lancha = p.lancha and d between m.de and m.ate) then
    return 'ocupada';
  end if;
  if exists (select 1 from pedidos o join pagamentos_asaas a on a.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = d and o.status = 'pendente' and choca_horario(o.horario, h) and a.pago_em is null)
     or exists (select 1 from pedidos o join pagamentos_pp g on g.pedido = o.id
               where o.id <> pid and o.lancha = p.lancha and o.data = d and o.status = 'pendente' and choca_horario(o.horario, h)
                 and g.reservado_em > now() - interval '10 minutes' and g.pago_em is null) then
    return 'pagando';
  end if;
  return 'livre';
end $function$;

-- o que impede o cliente de mudar sozinho (null = pode)
create or replace function public._cliente_muda_bloqueio(p public.pedidos)
 returns text language plpgsql stable security definer set search_path to 'public'
as $function$
declare tab numeric;
begin
  if p.id is null then return 'pedido'; end if;
  if p.status <> 'pendente' then return 'status'; end if;
  if p.comprovante_em is not null or exists (select 1 from pagamentos_pp x where x.pedido = p.id and (x.pago_em is not null or x.captura is not null))
     or exists (select 1 from pagamentos_asaas a where a.pedido = p.id and a.pago_em is not null) then return 'pago'; end if;
  if p.bloqueio_id is not null or p.vendedor is not null or coalesce(p.jetski_valor, 0) > 0 or p.jetski_min is not null
     or p.oferta is not null or p.desc_parceiro is not null then return 'lucas'; end if;
  if exists (select 1 from anotacoes a where a.grupo is not null and a.bloqueio_id = p.bloqueio_id) then return 'lucas'; end if;
  if p.horario not in ('manha', 'tarde', 'dia') or p.hora_ini is not null then return 'lucas'; end if;
  if p.preco_base is not null then
    begin tab := public._valor_na_data(p.lancha, p.data, p.horario, false); exception when others then tab := null; end;
    if tab is null or abs(p.preco_base - tab) > 0.5 then return 'lucas'; end if; -- preço combinado: quem muda é o atendimento
  end if;
  return null;
end $function$;

-- todos os dias da janela (até 7 antes e 7 depois da data pedida, nunca antes de hoje) com SÓ os horários livres;
-- dia sem nenhum horário livre não vem. O horário atual vem marcado (atual) para a página mostrar onde ele está.
create or replace function public.cliente_opcoes_pedido(pid bigint)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare p public.pedidos%rowtype; hoje date := (now() at time zone 'America/Sao_Paulo')::date; base date; d date;
        bl text; h text; v numeric; ops jsonb; dias jsonb := '[]'::jsonb; at boolean;
begin
  select * into p from pedidos where id = pid;
  bl := public._cliente_muda_bloqueio(p);
  if bl is not null then return jsonb_build_object('erro', bl); end if;
  base := coalesce(p.data_pedida, p.data);
  for d in select g::date from generate_series(greatest(hoje, base - 7), base + 7, interval '1 day') g loop
    ops := '[]'::jsonb;
    foreach h in array array['manha', 'tarde', 'dia'] loop
      at := d = p.data and h = p.horario;
      begin v := public._valor_na_data(p.lancha, d, h, false); exception when others then v := null; end;
      if at or (coalesce(v, 0) > 0 and public._vaga_pedido_em(pid, d, h) = 'livre') then
        ops := ops || jsonb_build_object('horario', h, 'valor', v, 'sinal', case when v > 0 then round((v - coalesce(p.cupom_valor, 0)) / 2) end, 'atual', at);
      end if;
    end loop;
    if jsonb_array_length(ops) > 0 then dias := dias || jsonb_build_object('data', d, 'opcoes', ops); end if;
  end loop;
  return jsonb_build_object('ok', true, 'atual_data', p.data, 'atual_horario', p.horario, 'dias', dias);
end $function$;

create or replace function public.cliente_alterar_pedido(pid bigint, d date, h text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare p public.pedidos%rowtype; hoje date := (now() at time zone 'America/Sao_Paulo')::date; base date; bl text; v numeric; vg text;
        r jsonb; ok_dono boolean;
begin
  select * into p from pedidos where id = pid for update;
  bl := public._cliente_muda_bloqueio(p);
  if bl is not null then return jsonb_build_object('erro', bl); end if;
  if h not in ('manha', 'tarde', 'dia') then return jsonb_build_object('erro', 'horario'); end if;
  base := coalesce(p.data_pedida, p.data);
  if d is null or d < greatest(hoje, base - 7) or d > base + 7 then return jsonb_build_object('erro', 'data'); end if;
  if d = p.data and h = p.horario then return jsonb_build_object('erro', 'igual'); end if;
  begin v := public._valor_na_data(p.lancha, d, h, false); exception when others then v := null; end;
  if not (coalesce(v, 0) > 0) then return jsonb_build_object('erro', 'fechado'); end if;
  perform pg_advisory_xact_lock(hashtext('vaga:' || p.lancha || ':' || d::text));
  vg := public._vaga_pedido_em(pid, d, h);
  if vg <> 'livre' then return jsonb_build_object('erro', vg); end if;
  begin
    if d <> p.data then
      perform set_config('buzios.troca', '1', true);
      update pedidos set data = d, data_pedida = coalesce(data_pedida, data), atualizado_em = now() where id = pid;
      perform set_config('buzios.troca', '', true);
    end if;
    r := public.alterar_pedido(pid, h, null, null, v, null);
    if r ? 'erro' then raise exception using message = 'ALTERAR:' || (r->>'erro'); end if;
  exception when others then
    perform set_config('buzios.troca', '', true);
    if sqlerrm like 'ALTERAR:%' then return jsonb_build_object('erro', substr(sqlerrm, 9)); end if;
    raise;
  end;
  -- lancha parceira (ou réveillon/feriadão na automática): o pagamento espera a nova aprovação
  ok_dono := not public.lancha_auto(p.lancha) or public._epoca(d) = 'reveillon'
             or public._feriadao(d, (select sem_feriados from public.precos where lancha = p.lancha)) is not null;
  if ok_dono then
    update pedidos set sinal_liberado_em = null where id = pid;
    update aprovacoes_dono set data = d, horario = h, resposta = null, respondido_em = null, fim_avisado_em = null, fim_estado = null,
           slot = 'mudou-cliente' where pedido_id = pid;
  end if;
  return r || jsonb_build_object('data', d, 'de_data', p.data, 'espera_dono', ok_dono, 'parceira', not public.lancha_auto(p.lancha));
end $function$;

revoke all on function public._vaga_pedido_em(bigint, date, text) from public, anon, authenticated;
revoke all on function public._cliente_muda_bloqueio(public.pedidos) from public, anon, authenticated;
revoke all on function public.cliente_opcoes_pedido(bigint) from public, anon, authenticated;
revoke all on function public.cliente_alterar_pedido(bigint, date, text) from public, anon, authenticated;
grant execute on function public.cliente_opcoes_pedido(bigint) to service_role;
grant execute on function public.cliente_alterar_pedido(bigint, date, text) to service_role;
grant execute on function public._vaga_pedido_em(bigint, date, text) to service_role;
grant execute on function public._cliente_muda_bloqueio(public.pedidos) to service_role;

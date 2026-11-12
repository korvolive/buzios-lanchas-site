-- Cliente troca 4h <-> 7h na página de pagamento (Rodrigo 2026-11-12, pedido 49): só antes de pagar, se a lancha estiver livre.
create or replace function public.pp_vaga_h(pid bigint, h text)
returns text language plpgsql security definer set search_path to 'public' as $f$
declare p record;
begin
  select id, lancha, data into p from pedidos where id = pid;
  if not found then return 'pedido'; end if;
  if exists (select 1 from bloqueios b where b.lancha = p.lancha and b.data = p.data and b.revenda is null and choca_horario(b.horario, h)
               and not exists (select 1 from pedidos q where q.id = pid and q.bloqueio_id = b.id))
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
end $f$;

-- o pedido pode trocar de horário? (pedido do site com preço de tabela, sem vendedor, oferta, horário especial, nem pagamento)
create or replace function public._troca_ok(pid bigint)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select exists (
    select 1 from pedidos p left join pagamentos_pp g on g.pedido = p.id
    where p.id = pid and p.status = 'pendente' and p.data > current_date
      and p.horario in ('manha', 'tarde', 'dia') and p.lancha <> 'miss-bardot'
      and p.vendedor is null and p.oferta is null and p.hora_ini is null and p.desc_parceiro is null
      and coalesce(p.preco_cliente, p.preco_base) = p.preco_base and p.comprovante_em is null
      and g.pago_em is null and g.captura is null
      and p.preco_base = public.preco_tabela(p.lancha, p.data, p.horario)
      and not exists (select 1 from pagamentos_asaas a where a.pedido = p.id and a.pago_em is not null));
$f$;

-- opções para a página: [{h, preco, sinal}] só dos horários livres
create or replace function public.trocas_pedido(pid bigint)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $f$
declare p record; h text; tb numeric; r jsonb := '[]'::jsonb; ot numeric;
begin
  if not public._troca_ok(pid) then return r; end if;
  select * into p from pedidos where id = pid;
  ot := p.preco_base - coalesce(p.cupom_valor, 0);
  foreach h in array array['manha', 'tarde', 'dia'] loop
    continue when h = p.horario;
    continue when (h = 'dia') = (p.horario = 'dia'); -- só 4h <-> 7h
    tb := public.preco_tabela(p.lancha, p.data, h);
    continue when tb is null or tb <= 0 or tb - coalesce(p.cupom_valor, 0) <= 0 or ot <= 0;
    continue when public.pp_vaga_h(pid, h) <> 'livre';
    r := r || jsonb_build_object('h', h, 'preco', tb - coalesce(p.cupom_valor, 0),
      'sinal', case when p.sinal_valor > 0 then round(p.sinal_valor * (tb - coalesce(p.cupom_valor, 0)) / ot) end);
  end loop;
  return r;
end $f$;

create or replace function public.trocar_horario_pedido(pid bigint, novo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare p record; g record; tb numeric; ot numeric; nt numeric; ns numeric; v text; nv numeric;
begin
  select * into p from pedidos where id = pid for update;
  if not found then return jsonb_build_object('erro', 'pedido'); end if;
  if not public._troca_ok(pid) then return jsonb_build_object('erro', 'nao_pode'); end if;
  if novo not in ('manha', 'tarde', 'dia') or novo = p.horario or (novo = 'dia') = (p.horario = 'dia') then return jsonb_build_object('erro', 'horario'); end if;
  perform pg_advisory_xact_lock(hashtext('vaga:' || p.lancha || ':' || p.data::text));
  v := public.pp_vaga_h(pid, novo);
  if v <> 'livre' then return jsonb_build_object('erro', v); end if;
  tb := public.preco_tabela(p.lancha, p.data, novo);
  ot := p.preco_base - coalesce(p.cupom_valor, 0);
  nt := tb - coalesce(p.cupom_valor, 0);
  if tb is null or tb <= 0 or nt <= 0 or ot <= 0 then return jsonb_build_object('erro', 'sem_horario'); end if;
  ns := case when p.sinal_valor > 0 then round(p.sinal_valor * nt / ot) end;
  perform set_config('buzios.troca', '1', true);
  update pedidos set horario = novo, preco_base = tb, sinal_valor = ns, repasse_dono = null, atualizado_em = now() where id = pid;
  perform set_config('buzios.troca', '', true);
  select * into g from pagamentos_pp where pedido = pid;
  if found then
    nv := case when g.moeda = 'BRL' then ns when p.sinal_valor > 0 then ceil(g.valor * ns / p.sinal_valor) else g.valor end;
    update pagamentos_pp set valor = nv, order_id = null, atualizado_em = now() where pedido = pid;
  end if;
  return jsonb_build_object('ok', true, 'de', p.horario, 'para', novo, 'preco', nt, 'sinal', ns, 'moeda', g.moeda, 'valor', nv);
end $f$;

revoke execute on function public.pp_vaga_h(bigint, text) from public, anon, authenticated;
revoke execute on function public._troca_ok(bigint) from public, anon, authenticated;
revoke execute on function public.trocas_pedido(bigint) from public, anon, authenticated;
revoke execute on function public.trocar_horario_pedido(bigint, text) from public, anon, authenticated;
grant execute on function public.pp_vaga_h(bigint, text) to service_role;
grant execute on function public._troca_ok(bigint) to service_role;
grant execute on function public.trocas_pedido(bigint) to service_role;
grant execute on function public.trocar_horario_pedido(bigint, text) to service_role;

-- o gatilho pedido_vendedor trava o preço para quem não é administrador; a troca de horário (só pela função acima) passa
do $d$
declare s text := pg_get_functiondef('public.pedido_vendedor()'::regprocedure);
begin
  if position('buzios.troca' in s) = 0 then
    if (length(s) - length(replace(s, 'elsif not public.e_admin() then', ''))) / length('elsif not public.e_admin() then') <> 1 then
      raise exception 'pedido_vendedor mudou, confira';
    end if;
    execute replace(s, 'elsif not public.e_admin() then', 'elsif not public.e_admin() and coalesce(current_setting(''buzios.troca'', true), '''') <> ''1'' then');
  end if;
end $d$;

-- Aplicado em duas partes: as funções pelo Claude; o bloco do gatilho pedido_vendedor (acima) colado pelo Rodrigo no SQL Editor.
-- Trava extra (aplicada): _troca_ok só libera quando o gatilho já tem 'buzios.troca', e trocar_horario_pedido desfaz se o preço não mudar.

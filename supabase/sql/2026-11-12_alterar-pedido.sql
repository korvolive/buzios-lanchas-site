-- Lucas (pela ponte, chave de serviço) ou o administrador alteram o pedido antes do pagamento: horário livre, duração e valor (Rodrigo 2026-11-12).
-- O valor vem de quem chama (a ponte aplica as regras de cotação e o piso do neto do dono). Aqui: confere vaga, recalcula o sinal, ajusta a cobrança.
create or replace function public.alterar_pedido(pid bigint, p_horario text, p_hi text, p_hf text, p_valor numeric, p_sinal numeric default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare p record; g record; v text; ot numeric; nt numeric; ns numeric; nv numeric; ok numeric;
begin
  select * into p from pedidos where id = pid for update;
  if not found then return jsonb_build_object('erro', 'pedido'); end if;
  if p.status <> 'pendente' or p.data < current_date then return jsonb_build_object('erro', 'status'); end if;
  if p.vendedor is not null then return jsonb_build_object('erro', 'vendedor'); end if;
  if p.comprovante_em is not null or exists (select 1 from pagamentos_pp x where x.pedido = pid and (x.pago_em is not null or x.captura is not null))
     or exists (select 1 from pagamentos_asaas a where a.pedido = pid and a.pago_em is not null) then return jsonb_build_object('erro', 'pago'); end if;
  if p_horario not in ('manha', 'tarde', 'dia', 'noite') then return jsonb_build_object('erro', 'horario'); end if;
  if not (p_valor > 0) or (p_sinal is not null and (p_sinal < 0 or p_sinal > p_valor)) then return jsonb_build_object('erro', 'valor'); end if;
  if (p_hi is null) <> (p_hf is null) then return jsonb_build_object('erro', 'horas'); end if;
  if p_hi is not null and (p_hi !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_hf !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then return jsonb_build_object('erro', 'horas'); end if;
  perform pg_advisory_xact_lock(hashtext('vaga:' || p.lancha || ':' || p.data::text));
  v := public.pp_vaga_h(pid, p_horario);
  if v <> 'livre' then return jsonb_build_object('erro', v); end if;
  ot := coalesce(p.preco_cliente, p.preco_base) - coalesce(p.cupom_valor, 0);
  nt := p_valor - coalesce(p.cupom_valor, 0);
  if nt <= 0 then return jsonb_build_object('erro', 'valor'); end if;
  ns := coalesce(p_sinal, case when p.sinal_valor > 0 and ot > 0 then round(p.sinal_valor * nt / ot) else round(nt / 2) end);
  perform set_config('buzios.troca', '1', true);
  update pedidos set horario = p_horario, hora_ini = p_hi, hora_fim = p_hf, preco_base = p_valor, preco_cliente = null,
    sinal_valor = ns, repasse_dono = null, atualizado_em = now() where id = pid returning preco_base into ok;
  perform set_config('buzios.troca', '', true);
  if ok is distinct from p_valor then raise exception 'alterar: preco nao mudou'; end if;
  select * into g from pagamentos_pp where pedido = pid;
  if found then
    nv := case when g.moeda = 'BRL' then ns when p.sinal_valor > 0 then ceil(g.valor * ns / p.sinal_valor) else g.valor end;
    update pagamentos_pp set valor = nv, order_id = null, atualizado_em = now() where pedido = pid;
  end if;
  return jsonb_build_object('ok', true, 'de', p.horario, 'para', p_horario, 'hi', p_hi, 'hf', p_hf, 'preco', nt, 'sinal', ns, 'moeda', g.moeda, 'valor', nv);
end $f$;
revoke execute on function public.alterar_pedido(bigint, text, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.alterar_pedido(bigint, text, text, text, numeric, numeric) to service_role;

-- chaves de serviços externos que as edge functions leem com a chave de serviço
create table if not exists public.segredos_app (nome text primary key, valor text not null, atualizado_em timestamptz not null default now());
alter table public.segredos_app enable row level security;
revoke all on public.segredos_app from public, anon, authenticated;
grant select, insert, update on public.segredos_app to service_role;

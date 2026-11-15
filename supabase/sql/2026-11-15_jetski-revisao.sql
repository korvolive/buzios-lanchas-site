-- Revisão de segurança do jetski no pagamento (2026-11-15). Aplicar depois de 2026-11-15_jetski-pedido.sql.
-- 1) Pedido já pago: trocar data/horário/lancha não reprecifica o jetski (o repasse ao dono usa o que o cliente pagou).
-- 2) alterar_pedido e trocar_horario_pedido: a cobrança da central (pagamentos_pp) passa a incluir o jetski,
--    igual ao Asaas (antes voltava só para o sinal da lancha e o cliente pagava sem o jetski).

create or replace function public.tg_pedido_jetski()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare j public.jetskis; w record; a int; n numeric; mudou boolean;
begin
  if tg_op = 'UPDATE' then
    -- cliente não troca o jetski depois de pedir (só o administrador ou o servidor)
    if (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_valor, new.jetski_neto) is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_valor, old.jetski_neto)
       and auth.uid() is not null and not public.e_admin() then
      new.jetski := old.jetski; new.jetski_min := old.jetski_min; new.jetski_ini := old.jetski_ini; new.jetski_valor := old.jetski_valor; new.jetski_neto := old.jetski_neto;
    end if;
    if new.jetski_repasse is distinct from old.jetski_repasse or new.jetski_repasse_em is distinct from old.jetski_repasse_em then
      if auth.uid() is not null and not public.e_admin() then new.jetski_repasse := old.jetski_repasse; new.jetski_repasse_em := old.jetski_repasse_em; end if;
    end if;
    mudou := (new.jetski, new.jetski_min, new.jetski_ini, new.lancha, new.data, new.horario, new.hora_ini, new.hora_fim)
             is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.lancha, old.data, old.horario, old.hora_ini, old.hora_fim);
    if not mudou then return new; end if;
  else
    new.jetski_repasse := null; new.jetski_repasse_em := null;
  end if;
  if new.jetski is null then
    new.jetski_min := null; new.jetski_ini := null; new.jetski_valor := null; new.jetski_neto := null; return new;
  end if;
  select * into j from public.jetskis where id = new.jetski;
  if j.id is null or not j.ativo or (j.oculto and not public.e_admin()) then raise exception 'JETSKI_INDISPONIVEL'; end if;
  if exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then raise exception 'JETSKI_SO_LANCHA'; end if;
  if new.jetski_min is null or new.jetski_ini is null then raise exception 'JETSKI_HORARIO'; end if;
  n := public.jetski_neto(j, new.jetski_min);
  if n is null or n <= 0 then raise exception 'JETSKI_TEMPO'; end if;
  w := public.jetski_janela(new.horario, new.hora_ini, new.hora_fim);
  a := extract(epoch from new.jetski_ini)::int / 60;
  -- começa 1 h depois da saída e termina até 1 h antes da volta; inícios de meia em meia hora
  if w.ini is null or w.fim is null or a % 30 <> 0 or a < w.ini + 60 or a + new.jetski_min > w.fim - 60 then raise exception 'JETSKI_JANELA'; end if;
  new.jetski_neto := n; new.jetski_valor := public.jetski_valor(n);
  -- já pago online: mudar data/horário/lancha não muda o preço do jetski que o cliente pagou nem o líquido do dono (revisão 2026-11-15)
  if tg_op = 'UPDATE' and (new.jetski, new.jetski_min) is not distinct from (old.jetski, old.jetski_min) and old.jetski_valor is not null
     and (exists (select 1 from public.pagamentos_asaas x where x.pedido = new.id and x.pago_em is not null)
          or exists (select 1 from public.pagamentos_pp x where x.pedido = new.id and x.pago_em is not null)) then
    new.jetski_neto := old.jetski_neto; new.jetski_valor := old.jetski_valor;
  end if;
  return new;
end $$;
CREATE OR REPLACE FUNCTION public.alterar_pedido(pid bigint, p_horario text, p_hi text, p_hf text, p_valor numeric, p_sinal numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record; g record; v text; ot numeric; nt numeric; ns numeric; nv numeric; ok numeric; jn numeric;
begin
  select * into p from pedidos where id = pid for update;
  if not found then return jsonb_build_object('erro', 'pedido'); end if;
  if p.status <> 'pendente' or p.data < current_date then return jsonb_build_object('erro', 'status'); end if;
  if p.vendedor is not null then return jsonb_build_object('erro', 'vendedor'); end if;
  if p.comprovante_em is not null or exists (select 1 from pagamentos_pp x where x.pedido = pid and (x.pago_em is not null or x.captura is not null))
     or exists (select 1 from pagamentos_asaas a where a.pedido = pid and a.pago_em is not null) then return jsonb_build_object('erro', 'pago'); end if;
  if p_horario not in ('manha', 'tarde', 'dia', 'noite') then return jsonb_build_object('erro', 'horario'); end if;
  if not (p_valor > 0) or (p_sinal is not null and (p_sinal < 0 or p_sinal > p_valor)) then return jsonb_build_object('erro', 'valor'); end if;
  -- Rodrigo 2026-11-13: no máximo 20% abaixo do neto do dono (evita erro de digitação)
  if p_valor < 0.8 * coalesce(public.preco_neto_tabela(p.lancha, p.data, p_horario), 0) then return jsonb_build_object('erro', 'piso'); end if;
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
  begin
    update pedidos set horario = p_horario, hora_ini = p_hi, hora_fim = p_hf, preco_base = p_valor, preco_cliente = null,
      sinal_valor = ns, repasse_dono = null, atualizado_em = now() where id = pid returning preco_base, jetski_valor into ok, jn;
  exception when raise_exception then
    perform set_config('buzios.troca', '', true);
    if sqlerrm like 'JETSKI_%' then return jsonb_build_object('erro', 'jetski'); end if; -- o jetski não cabe no novo horário
    raise;
  end;
  perform set_config('buzios.troca', '', true);
  if ok is distinct from p_valor then raise exception 'alterar: preco nao mudou'; end if;
  select * into g from pagamentos_pp where pedido = pid;
  if found then
    -- a central cobra o sinal da lancha + o jetski inteiro (revisão 2026-11-15)
    nv := case when g.moeda = 'BRL' then ns + coalesce(jn, 0)
               when p.sinal_valor > 0 then ceil(g.valor * (ns + coalesce(jn, 0)) / (p.sinal_valor + coalesce(p.jetski_valor, 0))) else g.valor end;
    update pagamentos_pp set valor = nv, order_id = null, atualizado_em = now() where pedido = pid;
  end if;
  return jsonb_build_object('ok', true, 'de', p.horario, 'para', p_horario, 'hi', p_hi, 'hf', p_hf, 'preco', nt, 'sinal', ns, 'moeda', g.moeda, 'valor', nv);
end $function$;

CREATE OR REPLACE FUNCTION public.trocar_horario_pedido(pid bigint, novo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record; g record; tb numeric; ot numeric; nt numeric; ns numeric; v text; nv numeric; ok numeric; jn numeric;
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
  begin
    update pedidos set horario = novo, preco_base = tb, sinal_valor = ns, repasse_dono = null, atualizado_em = now() where id = pid returning preco_base, jetski_valor into ok, jn;
  exception when raise_exception then
    perform set_config('buzios.troca', '', true);
    if sqlerrm like 'JETSKI_%' then return jsonb_build_object('erro', 'jetski'); end if; -- o jetski não cabe no novo horário
    raise;
  end;
  perform set_config('buzios.troca', '', true);
  if ok is distinct from tb then raise exception 'troca: preco nao mudou'; end if;
  select * into g from pagamentos_pp where pedido = pid;
  if found then
    -- a central cobra o sinal da lancha + o jetski inteiro (revisão 2026-11-15)
    nv := case when g.moeda = 'BRL' then case when ns > 0 then ns + coalesce(jn, 0) else ns end
               when p.sinal_valor > 0 then ceil(g.valor * (ns + coalesce(jn, 0)) / (p.sinal_valor + coalesce(p.jetski_valor, 0))) else g.valor end;
    update pagamentos_pp set valor = nv, order_id = null, atualizado_em = now() where pedido = pid;
  end if;
  return jsonb_build_object('ok', true, 'de', p.horario, 'para', novo, 'preco', nt, 'sinal', ns, 'moeda', g.moeda, 'valor', nv);
end $function$;

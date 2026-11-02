-- Parceiro (pousada, restaurante): desconto real só no 1º passeio do cliente com aquele parceiro (Rodrigo 2026-11-02).
-- 1º passeio: o cliente paga a tabela; os 3% do parceiro saem da parte da Búzios Lanchas
--   (preco_cliente = tabela, preco_base = tabela - 3%, desc_parceiro = os 3% em R$).
-- Do 2º em diante: tabela + 3%, sem preço riscado (igual ao vendedor).
-- A comissão continua sendo preco_cliente - preco_base em todo lugar.

alter table public.pedidos add column if not exists desc_parceiro numeric;

create or replace function public.pedido_vendedor()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v public.vendedores%rowtype; r public.cliente_vendedor%rowtype; dp numeric;
begin
  if tg_op = 'INSERT' then
    new.vendedor := null; new.comissao_paga := null; new.indicacao_paga := null; new.desc_parceiro := null;
    select * into r from cliente_vendedor where cliente = new.cliente;
    if r.vendedor is not null and r.ate > now() then
      select * into v from vendedores where user_id = r.vendedor and ativo;
    end if;
    if v.user_id is null and new.vendedor_cod is not null then
      select * into v from vendedores where codigo = upper(btrim(new.vendedor_cod)) and ativo;
      if v.user_id = r.desvinculado_de then v := null; end if;
    end if;
    if v.user_id = new.cliente then v := null; end if; -- o vendedor não ganha comissão dele mesmo
    if public.e_equipe(new.cliente) then v := null; end if; -- só cliente fica com vendedor (Rodrigo 2026-10-24)
    if v.user_id is null then
      new.vendedor_cod := null; new.acrescimo_pct := null; new.preco_cliente := null;
    else
      new.vendedor := v.user_id; new.vendedor_cod := v.codigo;
      if exists (select 1 from donos d where d.user_id = v.user_id and d.lancha = new.lancha) then new.preco_cliente := new.preco_base; end if;
      if v.parceiro and new.preco_base > 0 and new.oferta is null
         and not exists (select 1 from donos d where d.user_id = v.user_id and d.lancha = new.lancha)
         and not exists (select 1 from pedidos p where p.cliente = new.cliente and p.vendedor = v.user_id and p.status in ('pendente', 'aprovado')) then
        -- 1º passeio com o parceiro: o cliente paga a tabela, a comissão do parceiro sai da parte da Búzios (Rodrigo 2026-11-02)
        dp := round(new.preco_base * v.teto_pct / 100);
        new.preco_cliente := least(coalesce(nullif(new.preco_cliente, 0), new.preco_base), new.preco_base);
        new.preco_base := new.preco_cliente - dp;
        new.desc_parceiro := dp;
        new.acrescimo_pct := null;
      else
        new.preco_cliente := case when new.preco_base > 0 then least(greatest(coalesce(new.preco_cliente, new.preco_base), new.preco_base), round(new.preco_base * (1 + v.teto_pct / 100))) end;
        new.acrescimo_pct := case when new.preco_base > 0 then round((new.preco_cliente / new.preco_base - 1) * 100, 1) end;
      end if;
      -- cada reserva com o vendedor renova o vínculo: data do passeio + 12 meses (Rodrigo 2026-10-24)
      insert into cliente_vendedor (cliente, vendedor, ate)
        values (new.cliente, v.user_id, greatest(now(), coalesce(new.data, current_date)::timestamptz) + interval '12 months')
        on conflict (cliente) do update set vendedor = excluded.vendedor,
          ate = case when cliente_vendedor.vendedor = excluded.vendedor and cliente_vendedor.ate > excluded.ate
                     then cliente_vendedor.ate else excluded.ate end;
    end if;
  elsif not public.e_admin() then
    new.vendedor := old.vendedor; new.vendedor_cod := old.vendedor_cod; new.acrescimo_pct := old.acrescimo_pct;
    new.preco_base := old.preco_base; new.preco_cliente := old.preco_cliente; new.desc_parceiro := old.desc_parceiro;
    new.indicacao_paga := old.indicacao_paga;
    -- comissão paga: só o administrador ou o robô do envio automático (chave de serviço)
    if coalesce(auth.role(), '') <> 'service_role' then new.comissao_paga := old.comissao_paga; end if;
  end if;
  return new;
end $function$;

-- passeio lançado à mão para cliente de parceiro: o app sabe se é o 1º passeio dele com o parceiro
drop function if exists public.vendedor_do_cliente(text);
create function public.vendedor_do_cliente(tel text)
 returns table(codigo text, nome text, empresa text, parceiro boolean, pct numeric, primeiro boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with d as (select public._dig(tel) t),
  x as (
    select cv.vendedor, cl.user_id cliente, 1 ordem from clientes cl join cliente_vendedor cv on cv.cliente = cl.user_id, d
      where length(d.t) >= 10 and right(public._dig(cl.whatsapp), 10) = right(d.t, 10) and cv.ate > now()
    union all
    select l.vendedor, null::uuid, 2 from vendedor_leads l, d
      where length(d.t) >= 10 and right(l.telefone, 10) = right(d.t, 10) and l.concluido_em is null
        and l.criado_em > now() - interval '12 months' and (l.origem <> 'link' or l.wa_ok_em is not null))
  select v.codigo,
    coalesce(p.nome, c.nome, f.nome, (select m.nome from marinheiros m where m.user_id = v.user_id limit 1), v.codigo),
    case when v.parceiro then v.empresa end, coalesce(v.parceiro, false),
    case when v.parceiro then 3 else coalesce((v.pcts->>'alta')::numeric, 3) end,
    coalesce(v.parceiro, false) and not exists (select 1 from pedidos pd where pd.cliente = x.cliente and pd.vendedor = v.user_id and pd.status in ('pendente', 'aprovado'))
  from x join vendedores v on v.user_id = x.vendedor and v.ativo
    left join perfis p on p.user_id = v.user_id left join clientes c on c.user_id = v.user_id left join freelancers f on f.user_id = v.user_id
  where public.painel_le()
  order by x.ordem limit 1;
$function$;

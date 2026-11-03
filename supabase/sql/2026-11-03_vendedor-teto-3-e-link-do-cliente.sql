-- 2026-11-03: ajustes da revisão diária nas regras do vendedor e do parceiro (rodar inteiro no Supabase).
-- 1) Link do vendedor: 3% fixo também no banco (todos os vendedores estavam com teto 10).
-- 2) Link feito pelo vendedor para um cliente (ofertas): a comissão em R$ combinada (até R$ 1.000 e 30%)
--    passava pelo teto de % e era cortada. Agora vale a comissão da oferta, conferida pelo teto em R$.
-- 3) Parceiro, 1º passeio: a comissão sai do menor valor entre o preço do cliente e a tabela
--    (mesma correção do arquivo 2026-11-03_supabase-revisao-diaria.sql; pode rodar os dois, em qualquer ordem).

update public.vendedores set teto_pct = 3 where teto_pct is distinct from 3;
alter table public.vendedores alter column teto_pct set default 3;

create or replace function public.pedido_vendedor()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v public.vendedores%rowtype; r public.cliente_vendedor%rowtype; dp numeric; oc numeric;
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
      if new.oferta is not null then
        select o.comissao into oc from ofertas o where o.id = new.oferta and o.vendedor = v.user_id and o.comissao is not null;
      end if;
      if exists (select 1 from donos d where d.user_id = v.user_id and d.lancha = new.lancha) then
        new.preco_cliente := new.preco_base;
        new.acrescimo_pct := case when new.preco_base > 0 then 0 end;
      elsif oc is not null and new.preco_base > 0 then
        -- link do vendedor para este cliente: comissão em R$ combinada, até R$ 1.000 e 30% (Rodrigo 2026-11-02)
        new.preco_cliente := new.preco_base + least(greatest(oc, 0), public._teto_comissao_manual(new.preco_base));
        new.acrescimo_pct := round((new.preco_cliente / new.preco_base - 1) * 100, 1);
      elsif v.parceiro and new.preco_base > 0 and new.oferta is null
         and not exists (select 1 from pedidos p where p.cliente = new.cliente and p.vendedor = v.user_id and p.status in ('pendente', 'aprovado')) then
        -- 1º passeio com o parceiro: o cliente paga a tabela, a comissão do parceiro sai da parte da Búzios (Rodrigo 2026-11-02)
        new.preco_cliente := least(coalesce(nullif(new.preco_cliente, 0), new.preco_base), new.preco_base);
        dp := round(least(new.preco_cliente, coalesce(nullif(public.preco_tabela(new.lancha, new.data, new.horario), 0), new.preco_cliente)) * least(v.teto_pct, 3) / 100);
        new.preco_base := new.preco_cliente - dp;
        new.desc_parceiro := dp;
        new.acrescimo_pct := null;
      else
        -- link do vendedor ou do parceiro: 3% fixo (Rodrigo 2026-11-02)
        new.preco_cliente := case when new.preco_base > 0 then least(greatest(coalesce(new.preco_cliente, new.preco_base), new.preco_base), round(new.preco_base * (1 + least(v.teto_pct, 3) / 100))) end;
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

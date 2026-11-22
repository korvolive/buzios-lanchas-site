-- publicar: auto
-- Parte do dono depois dos 7 dias de arrependimento do cliente (Rodrigo 2026-11-22): o app do dono mostra quando o valor libera.
-- Libera no 8º dia depois do pagamento (data do pagamento + 7), ou 7 dias antes do passeio se isso vier antes
-- (passeio a 7 dias ou menos: na hora). Mesma conta da função asaas (donoLiberaEm). Idempotente.
create or replace function public.meu_saldo_v2()
 returns table(tipo text, pedido bigint, lancha text, data date, horario text, valor numeric, liberado boolean, libera_em date)
 language sql stable security definer
 set search_path to 'public'
as $function$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  dono as (
    select p.id, p.lancha, p.data, p.horario, p.repasse_dono,
      least(p.data - 7,
            coalesce((select min(x.pago_em) from (
                select a.pago_em from pagamentos_asaas a where a.pedido = p.id and a.pago_em is not null
                union all select g.pago_em from pagamentos_pp g where g.pedido = p.id and g.pago_em is not null and g.captura is not null) x)
              at time zone 'America/Sao_Paulo', now() at time zone 'America/Sao_Paulo')::date + 7) as libera
    from pedidos p
    where p.status = 'aprovado' and coalesce(p.repasse_dono, 0) > 0 and p.lancha <> 'miss-bardot'
      and p.lancha in (select d.lancha from donos d where d.user_id = auth.uid())
      and (exists (select 1 from pagamentos_asaas a where a.pedido = p.id and a.pago_em is not null and (a.wallet_id is null or coalesce(a.repasse, 0) = 0))
        or (exists (select 1 from pagamentos_pp g where g.pedido = p.id and g.pago_em is not null and g.captura is not null)
            and not exists (select 1 from pagamentos_asaas a where a.pedido = p.id and a.pago_em is not null)))
      and not exists (select 1 from repasses_pp r where r.pedido = p.id)
  )
  select 'dono'::text, dono.id, dono.lancha, dono.data, dono.horario, dono.repasse_dono, dono.libera <= hoje.d, dono.libera
  from dono, hoje
  union all
  select 'comissao'::text, p.id, p.lancha, p.data, p.horario,
    round((greatest(coalesce(p.preco_cliente, 0) - coalesce(p.preco_base, 0), 0)
      * (1 - case when v.indicado_por is not null then coalesce(v.indicacao_pct, 0) else 0 end / 100))::numeric, 2),
    p.data < (now() at time zone 'America/Sao_Paulo')::date, null::date
  from pedidos p left join vendedores v on v.user_id = p.vendedor
  where p.vendedor = auth.uid() and p.status = 'aprovado' and p.comissao_paga is null and p.comissao_comprovante is null
    and coalesce(p.preco_cliente, 0) > coalesce(p.preco_base, 0)
    and not exists (select 1 from realizados x where x.bloqueio_id = p.bloqueio_id and x.aconteceu = false)
  order by 4, 2;
$function$;
revoke all on function public.meu_saldo_v2() from public, anon;
grant execute on function public.meu_saldo_v2() to authenticated;

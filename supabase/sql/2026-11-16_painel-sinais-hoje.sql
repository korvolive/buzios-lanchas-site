-- publicar: auto
-- painel_sinais_hoje(): sinais pagos HOJE (dia de America/Sao_Paulo) para o painel da TV do Mac mini.
-- Fontes: Asaas (CONFIRMED/RECEIVED/RECEIVED_IN_CASH), PayPal pago e comprovante manual. Um registro por pedido.
-- Só para admin, auditor ou operador. Sem dados pessoais (sem nome, telefone, CPF, link, token, payload Pix).
-- Idempotente (create or replace). Criado em 16/11/2026: a TV mostrava "0 sinais pagos" porque o Asaas não preenche comprovante_em.
create or replace function public.painel_sinais_hoje()
returns table(pedido bigint, lancha text, metodo text, valor numeric, pago_em timestamptz)
language sql stable security definer set search_path = public
as $$
  with dia as (
    select ((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo') as ini
  ), pg as (
    select a.pedido::bigint as pedido,
           case a.metodo when 'cartao' then 'cartão' when 'pix' then 'Pix' else coalesce(a.metodo, 'Asaas') end as metodo,
           coalesce(a.sinal, a.valor)::numeric as valor, a.pago_em
      from public.pagamentos_asaas a, dia
     where a.status in ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH') and a.pago_em >= dia.ini
    union all
    select pp.pedido::bigint, 'PayPal', null::numeric, pp.pago_em
      from public.pagamentos_pp pp, dia
     where pp.pago_em >= dia.ini
    union all
    select p.id::bigint, 'comprovante', p.sinal_valor::numeric, p.comprovante_em
      from public.pedidos p, dia
     where p.comprovante_em >= dia.ini
  )
  select distinct on (pg.pedido) pg.pedido, p.lancha::text, pg.metodo, coalesce(pg.valor, p.sinal_valor::numeric), pg.pago_em
    from pg join public.pedidos p on p.id = pg.pedido
   where p.status <> 'cancelado'
     and (public.e_admin() or coalesce(public.papel_painel() in ('operador', 'auditor'), false))
   order by pg.pedido, pg.pago_em;
$$;

revoke all on function public.painel_sinais_hoje() from public, anon;
grant execute on function public.painel_sinais_hoje() to authenticated;

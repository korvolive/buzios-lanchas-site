-- publicar: auto
-- Painel da TV (revisão 16/11/2026): sinais pagos desde 'ini' (máx. 40 dias), para o Resumo (7 dias / mês).
-- Igual a painel_sinais_hoje(); só admin/operador/auditor; sem dados pessoais.
CREATE OR REPLACE FUNCTION public.painel_sinais_desde(ini timestamptz)
 RETURNS TABLE(pedido bigint, lancha text, metodo text, valor numeric, pago_em timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with pg as (
    select a.pedido::bigint as pedido,
           case a.metodo when 'cartao' then 'cartão' when 'pix' then 'Pix' else coalesce(a.metodo, 'Asaas') end as metodo,
           coalesce(a.sinal, a.valor)::numeric as valor, a.pago_em
      from public.pagamentos_asaas a
     where a.status in ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH') and a.pago_em >= greatest(ini, now() - interval '40 days')
    union all
    select pp.pedido::bigint, 'PayPal', null::numeric, pp.pago_em
      from public.pagamentos_pp pp
     where pp.pago_em >= greatest(ini, now() - interval '40 days') and pp.captura is not null
    union all
    select p.id::bigint, 'comprovante', p.sinal_valor::numeric, p.comprovante_em
      from public.pedidos p
     where p.comprovante_em >= greatest(ini, now() - interval '40 days')
  )
  select distinct on (pg.pedido) pg.pedido, p.lancha::text, pg.metodo, coalesce(pg.valor, p.sinal_valor::numeric), pg.pago_em
    from pg join public.pedidos p on p.id = pg.pedido
   where p.status <> 'cancelado'
     and (public.e_admin() or coalesce(public.papel_painel() in ('operador', 'auditor'), false))
   order by pg.pedido, (pg.metodo = 'comprovante'), pg.pago_em;
$function$;
revoke all on function public.painel_sinais_desde(timestamptz) from public, anon;
grant execute on function public.painel_sinais_desde(timestamptz) to authenticated;

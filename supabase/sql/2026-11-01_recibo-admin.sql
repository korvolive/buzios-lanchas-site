-- Administrador vê o recibo do sinal de uma reserva (Rodrigo 2026-11-01): o mesmo que o cliente vê em Meus passeios (meus_recibos).
-- Só quem está na tabela admins; mesmas regras: passeio da Búzios Lanchas com sinal, ou pendente já pago.
create or replace function public.recibo_admin(pid bigint)
returns table(pedido_id bigint, nome text, forma text, em timestamptz, valor_brl numeric, valor_txt text)
language sql stable security definer set search_path to 'public'
as $$
  select p.id,
    left(trim(coalesce(c.nome, a.cliente, '')), 80),
    case when pa.pedido is not null then (case when pa.metodo = 'cartao' then 'cartao' else 'pix' end)
         when pp.pago_em is not null and pp.moeda <> 'BRL' then 'paypal' else 'pix' end,
    coalesce(pa.pago_em, pp.pago_em, p.comprovante_em),
    coalesce(pa.valor, nullif(a.sinal, 0), nullif(p.sinal_valor, 0)),
    case when pa.pedido is null and pp.pago_em is not null and pp.moeda <> 'BRL' then pp.pago_valor end
  from public.pedidos p
  left join public.anotacoes a on a.bloqueio_id = p.bloqueio_id
  left join public.clientes c on c.user_id = p.cliente
  left join public.pagamentos_pp pp on pp.pedido = p.id
  left join lateral (select x.pedido, x.metodo, x.valor, x.pago_em from public.pagamentos_asaas x
                     where x.pedido = p.id and x.pago_em is not null order by x.pago_em desc limit 1) pa on true
  where p.id = pid
    and exists (select 1 from public.admins ad where ad.user_id = auth.uid())
    and ((p.status = 'aprovado' and p.bloqueio_id is not null and a.origem = 'buzios' and coalesce(a.sinal, 0) > 0)
      or (p.status = 'pendente' and (pp.pago_em is not null or pa.pedido is not null)));
$$;
revoke all on function public.recibo_admin(bigint) from public, anon;
grant execute on function public.recibo_admin(bigint) to authenticated;

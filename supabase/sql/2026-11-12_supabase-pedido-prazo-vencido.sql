-- Pedido com prazo de pagamento vencido (Rodrigo 2026-11-12)
-- Card mostra "Prazo vencido, data liberada"; sem pagamento em 24h o pedido é cancelado sozinho (motivo 'prazo'), sem mensagem ao cliente.
alter table public.pedidos add column if not exists prazo_vencido_em timestamptz;

create or replace function public.pedidos_prazo_vencido()
 returns table(id bigint, cliente uuid, lancha text, data date)
 language sql security definer set search_path to 'public'
as $$
  update pedidos p set status = 'cancelado', motivo = 'prazo', atualizado_em = now()
   where p.status = 'pendente' and p.prazo_vencido_em is not null
     and p.prazo_vencido_em < now() - interval '24 hours'
     and p.comprovante_em is null and p.bloqueio_id is null
     and not exists (select 1 from pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))
     and not exists (select 1 from pagamentos_asaas a where a.pedido = p.id)
  returning p.id, p.cliente, p.lancha, p.data;
$$;
revoke all on function public.pedidos_prazo_vencido() from public, anon, authenticated;
grant execute on function public.pedidos_prazo_vencido() to service_role;

-- pedidos que já venceram antes desta mudança (ex.: pedido 49)
update public.pedidos p set prazo_vencido_em = m.em
  from (select pedido, max(criado_em) em from public.mensagens where sistema = 'expirou:' and pedido is not null group by pedido) m
 where m.pedido = p.id and p.status = 'pendente' and p.prazo_vencido_em is null
   and not exists (select 1 from public.pagamentos_asaas a where a.pedido = p.id);

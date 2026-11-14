-- Parte do dono a pagar (2026-11-14): sinais pagos no Asaas sem divisão automática (dono sem conta aprovada).
-- Mesma regra do enviarSaldos (função asaas). O app mostra a lista em Usuários com "Já repassei por fora",
-- que grava em repasses_pp (repasse_por_fora) e faz o envio automático pular o pedido.
create or replace function public.repasses_asaas_pendentes()
returns table(pedido bigint, lancha text, data date, horario text, valor numeric, dono uuid, tem_conta boolean, cliente text, pago_em timestamptz, enviando boolean, pix_tipo text, pix_chave text)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not e_admin() then raise exception 'so_admin'; end if;
  return query
  select p.id, p.lancha, p.data, p.horario, p.repasse_dono,
         d.user_id, exists (select 1 from asaas_contas a where a.user_id = d.user_id and a.wallet_id is not null and a.aprovada_em is not null),
         coalesce(c.nome, n.cliente), g.pago_em, coalesce(r.comprovante = 'asaas:enviando', false), v.pix_tipo, v.pix_chave
  from pedidos p
  join lateral (select max(x.pago_em) pago_em from pagamentos_asaas x where x.pedido = p.id and x.pago_em is not null and (x.wallet_id is null or coalesce(x.repasse, 0) <= 0)) g on g.pago_em is not null
  left join lateral (select y.user_id from donos y where y.lancha = p.lancha limit 1) d on true
  left join vendedores v on v.user_id = d.user_id
  left join clientes c on c.user_id = p.cliente
  left join anotacoes n on n.bloqueio_id = p.bloqueio_id
  left join repasses_pp r on r.pedido = p.id
  where p.status = 'aprovado' and coalesce(p.repasse_dono, 0) > 0 and p.lancha <> 'miss-bardot'
    and r.enviado_em is null
    and not exists (select 1 from pagamentos_asaas z where z.pedido = p.id and z.pago_em is not null and z.wallet_id is not null and coalesce(z.repasse, 0) > 0)
  order by p.data, p.id;
end $$;
revoke execute on function public.repasses_asaas_pendentes() from public, anon;
grant execute on function public.repasses_asaas_pendentes() to authenticated;

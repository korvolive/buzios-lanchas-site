-- publicar: auto
-- Revisão diária 2026-11-18: "Repasses pendentes" do painel dizia "Pronto: sai sozinho" para cartão confirmado havia 4 dias,
-- mas desde o #1095 o repasse só sai quando o dinheiro cai (RECEIVED/RECEIVED_IN_CASH ou antecipação creditada, por parcela).
-- Agora "recebido" segue a mesma regra da função asaas (CAIU) e volta a data prevista do crédito (previsto).
-- O dono escolhido é o mesmo da planilha: o que tem conta Asaas aprovada primeiro.
-- Idempotente (drop + create).
drop function if exists public.repasses_asaas_pendentes();
create function public.repasses_asaas_pendentes()
 returns table(pedido bigint, lancha text, data date, horario text, valor numeric, dono uuid, tem_conta boolean, cliente text, pago_em timestamp with time zone, enviando boolean, pix_tipo text, pix_chave text, dono_nome text, recebido boolean, previsto date)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not e_admin() then raise exception 'so_admin'; end if;
  return query
  select p.id, p.lancha, p.data, p.horario, p.repasse_dono,
         d.user_id, exists (select 1 from asaas_contas a where a.user_id = d.user_id and a.wallet_id is not null and a.aprovada_em is not null),
         coalesce(c.nome, n.cliente), g.pago_em, coalesce(r.comprovante = 'asaas:enviando', false), v.pix_tipo, v.pix_chave,
         coalesce(nullif(trim(pf.nome), ''), nullif(trim(ac.nome), '')),
         g.recebido, g.previsto
  from pedidos p
  join lateral (
    select max(x.pago_em) pago_em,
           bool_and(
             coalesce(x.status, '') in ('RECEIVED', 'RECEIVED_IN_CASH') or coalesce(x.antecipada, false)
             or (jsonb_typeof(x.parcelas) = 'array' and jsonb_array_length(x.parcelas) > 0
                 and not exists (select 1 from jsonb_array_elements(x.parcelas) e
                                  where coalesce(e->>'status', '') not in ('RECEIVED', 'RECEIVED_IN_CASH')
                                    and coalesce((e->>'antecipada')::boolean, false) = false))
           ) recebido,
           max(x.credito_previsto)::date previsto
      from pagamentos_asaas x
     where x.pedido = p.id and x.pago_em is not null and (x.wallet_id is null or coalesce(x.repasse, 0) <= 0)) g on g.pago_em is not null
  left join lateral (select y.user_id from donos y where y.lancha = p.lancha
                      order by (exists (select 1 from asaas_contas a2 where a2.user_id = y.user_id and a2.aprovada_em is not null)) desc,
                               (exists (select 1 from asaas_contas a3 where a3.user_id = y.user_id)) desc
                      limit 1) d on true
  left join vendedores v on v.user_id = d.user_id
  left join perfis pf on pf.user_id = d.user_id
  left join asaas_contas ac on ac.user_id = d.user_id
  left join clientes c on c.user_id = p.cliente
  left join anotacoes n on n.bloqueio_id = p.bloqueio_id
  left join repasses_pp r on r.pedido = p.id
  where p.status = 'aprovado' and coalesce(p.repasse_dono, 0) > 0 and p.lancha <> 'miss-bardot'
    and r.enviado_em is null
    and not exists (select 1 from pagamentos_asaas z where z.pedido = p.id and z.pago_em is not null and z.wallet_id is not null and coalesce(z.repasse, 0) > 0)
  order by p.data, p.id;
end $function$;
revoke all on function public.repasses_asaas_pendentes() from public, anon;
grant execute on function public.repasses_asaas_pendentes() to authenticated;

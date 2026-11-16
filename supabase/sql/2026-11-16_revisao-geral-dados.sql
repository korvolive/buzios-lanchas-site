-- publicar: auto
-- Revisão geral 16/11/2026 (Rodrigo: "a revisão diária tem que pegar o que eu vejo nos prints").
-- Idempotente (create or replace / if not exists).
--
-- 1) repasses_feitos(): o card do pedido no admin passa a saber que a parte do dono já saiu (pelo saldo do Asaas ou por fora).
--    Antes, nos pedidos pagos sem divisão (50, 51, 69), mandava "repasse por fora" o que já tinha sido pago: risco de pagar duas vezes.
create or replace function public.repasses_feitos()
returns table(pedido bigint, valor numeric, enviado_em timestamptz, por_fora boolean)
language sql stable security definer set search_path = public
as $$
  select r.pedido::bigint, r.valor, r.enviado_em, coalesce(r.comprovante like 'fora%', false)
    from public.repasses_pp r
   where r.enviado_em is not null and public.e_admin();
$$;
revoke all on function public.repasses_feitos() from public, anon;
grant execute on function public.repasses_feitos() to authenticated;

-- 2) meus_repasses_pp(): o app do dono mostrava só "a sua parte vem da Búzios", sem valor, quando o cliente pagou pelo Asaas
--    sem divisão (só olhava PayPal). Agora: PayPal capturado, Asaas sem divisão (enviado pelo saldo ou por fora) e Asaas com divisão (já foi na hora).
create or replace function public.meus_repasses_pp()
returns table(bloqueio_id bigint, valor numeric, enviado_em timestamptz, por_fora boolean)
language sql stable security definer set search_path = public
as $$
  select p.bloqueio_id,
         coalesce(sp.repasse, p.repasse_dono),
         coalesce(r.enviado_em, sp.pago_em),
         coalesce(r.comprovante like 'fora%', false)
    from public.pedidos p
    left join public.repasses_pp r on r.pedido = p.id
    left join lateral (select a.repasse, a.pago_em from public.pagamentos_asaas a
                        where a.pedido = p.id and a.pago_em is not null and a.wallet_id is not null and coalesce(a.repasse, 0) > 0
                        order by a.pago_em limit 1) sp on true
   where p.status = 'aprovado' and p.bloqueio_id is not null and coalesce(p.repasse_dono, 0) > 0 and p.lancha <> 'miss-bardot'
     and p.data >= current_date - 30
     and (exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and g.pago_em is not null and g.captura is not null)
          or exists (select 1 from public.pagamentos_asaas a where a.pedido = p.id and a.pago_em is not null))
     and p.lancha in (select d.lancha from public.donos d where d.user_id = auth.uid());
$$;
revoke all on function public.meus_repasses_pp() from public, anon;
grant execute on function public.meus_repasses_pp() to authenticated;

-- 3) painel_sinais_hoje(): o Asaas também grava uma cópia em pagamentos_pp (captura nula); o ramo PayPal agora só conta PayPal capturado,
--    para a TV nunca chamar Pix/cartão de "PayPal".
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
     where pp.pago_em >= dia.ini and pp.captura is not null
    union all
    select p.id::bigint, 'comprovante', p.sinal_valor::numeric, p.comprovante_em
      from public.pedidos p, dia
     where p.comprovante_em >= dia.ini
  )
  select distinct on (pg.pedido) pg.pedido, p.lancha::text, pg.metodo, coalesce(pg.valor, p.sinal_valor::numeric), pg.pago_em
    from pg join public.pedidos p on p.id = pg.pedido
   where p.status <> 'cancelado'
     and (public.e_admin() or coalesce(public.papel_painel() in ('operador', 'auditor'), false))
   order by pg.pedido, (pg.metodo = 'comprovante'), pg.pago_em;
$$;

-- 4) saude_checagens: resultado da checagem automática (asaas-saude, a cada 3 h) e da revisão diária. Só administrador lê.
create table if not exists public.saude_checagens (
  id bigserial primary key,
  em timestamptz not null default now(),
  origem text not null,
  ok boolean not null,
  itens jsonb not null default '[]'::jsonb
);
alter table public.saude_checagens enable row level security;
drop policy if exists saude_admin_le on public.saude_checagens;
create policy saude_admin_le on public.saude_checagens for select to authenticated using (public.e_admin());
revoke all on public.saude_checagens from anon;
grant select on public.saude_checagens to authenticated;
alter table public.asaas_config add column if not exists cliente_saude text;

-- 5) revisao_dados(): inconsistências que dá para ver só no banco (barato; a revisão diária roda isso).
--    g = alta | media | baixa; t = tipo; ref = pedido/lancha/usuário; d = detalhe sem dado pessoal de cliente.
create or replace function public.revisao_dados()
returns table(g text, t text, ref text, d text)
language sql stable security definer set search_path = public
as $$
with agora as (select (now() at time zone 'America/Sao_Paulo')::date hoje),
pago as (
  select pedido, max(pago_em) pago_em, bool_or(wallet_id is not null and repasse > 0) com_split
    from pagamentos_asaas where pago_em is not null group by pedido
  union all
  select pedido, pago_em, false from pagamentos_pp where pago_em is not null and captura is not null
),
r as (
select 'alta' g, 'pago_sem_confirmar' t, p.id::text ref, 'sinal pago mas pedido '||p.status d
  from pedidos p join pago x on x.pedido = p.id where p.status = 'pendente' and x.pago_em < now() - interval '15 minutes'
union all
select 'alta', 'pago_em_cancelado', p.id::text, 'sinal pago e pedido '||p.status
  from pedidos p join pago x on x.pedido = p.id
 where p.status in ('cancelado','recusado') and coalesce(p.motivo,'') <> 'credito' and coalesce(p.sinal_valor,0) > 10
   and not exists (select 1 from creditos c where c.origem_bloqueio = p.bloqueio_id)
union all
select 'alta', 'reserva_dupla', min(p.id)::text||','||max(p.id)::text, p.lancha||' '||p.data||' '||coalesce(p.horario,'')
  from pedidos p, agora where p.status = 'aprovado' and p.data >= agora.hoje
 group by p.lancha, p.data, p.horario having count(*) > 1
union all
select 'alta', 'repasse_dono_parado', p.id::text, p.lancha||' R$ '||p.repasse_dono
  from pedidos p join pago x on x.pedido = p.id
 where p.status = 'aprovado' and p.repasse_dono > 0 and p.lancha <> 'miss-bardot' and not x.com_split
   and x.pago_em < now() - interval '3 days'
   and not exists (select 1 from repasses_pp rp where rp.pedido = p.id)
   and exists (select 1 from donos dd join asaas_contas ac on ac.user_id = dd.user_id where dd.lancha = p.lancha and ac.aprovada_em is not null)
union all
select 'alta', 'transferencia_travada', rp.pedido::text, 'repasse ao dono em "enviando" desde '||to_char(rp.criado_em at time zone 'America/Sao_Paulo','DD/MM HH24:MI')
  from repasses_pp rp where rp.comprovante = 'asaas:enviando' and rp.criado_em < now() - interval '1 hour'
union all
select 'alta', 'comissao_travada', p.id::text, 'comissão do vendedor em "enviando"'
  from pedidos p where p.comissao_comprovante = 'asaas:enviando' and p.atualizado_em < now() - interval '1 hour'
union all
select 'media', 'comissao_atrasada', p.id::text, 'passeio '||p.data||', vendedor '||coalesce((select case when ac.aprovada_em is null then 'sem conta aprovada' else 'com conta aprovada' end from asaas_contas ac where ac.user_id = p.vendedor),'sem conta Asaas')
  from pedidos p, agora
 where p.status = 'aprovado' and p.vendedor is not null and p.comissao_paga is null and p.data < agora.hoje - 2
   and greatest(coalesce(p.preco_cliente,0) - coalesce(p.preco_base,0), 0) > 0
   and not exists (select 1 from realizados re where re.bloqueio_id = p.bloqueio_id and re.aconteceu = false)
union all
select 'media', 'sem_parte_do_dono', p.id::text, p.lancha||' '||p.data
  from pedidos p, agora
 where p.status in ('aprovado','pendente') and p.data >= agora.hoje and p.lancha <> 'miss-bardot' and p.repasse_dono is null
   and coalesce(p.sinal_valor,0) > 0 and exists (select 1 from donos dd where dd.lancha = p.lancha)
union all
select 'media', 'parte_do_dono_sem_pagar', p.id::text, p.lancha||' '||p.data||' R$ '||p.repasse_dono||' (sinal manual, nada registrado)'
  from pedidos p, agora
 where p.status = 'aprovado' and p.lancha <> 'miss-bardot' and coalesce(p.repasse_dono,0) > 0 and p.data < agora.hoje
   and p.data >= agora.hoje - 60
   and not exists (select 1 from pago x where x.pedido = p.id)
   and not exists (select 1 from repasses_pp rp where rp.pedido = p.id)
union all
select 'media', 'lancha_sem_dono', l.slug, l.nome from lanchas l
 where l.ativa and not coalesce(l.oculta,false) and l.slug <> 'miss-bardot' and not exists (select 1 from donos dd where dd.lancha = l.slug)
union all
select 'media', 'lancha_sem_preco', l.slug, l.nome from lanchas l
 where l.ativa and not coalesce(l.oculta,false) and not exists (select 1 from precos pr where pr.lancha = l.slug and coalesce(pr.baixa,0) > 0)
union all
select 'baixa', 'conta_asaas_parada', ac.user_id::text, 'conta Asaas sem aprovação desde '||to_char(ac.criado_em,'DD/MM')
  from asaas_contas ac where ac.aprovada_em is null and ac.criado_em < now() - interval '3 days'
union all
select 'media', 'prazo_vencido_aberto', p.id::text, 'prazo '||to_char(p.pagar_ate at time zone 'America/Sao_Paulo','DD/MM HH24:MI')
  from pedidos p where p.status = 'pendente' and p.pagar_ate < now() - interval '26 hours'
union all
select 'media', 'pendente_passado', p.id::text, p.lancha||' '||p.data from pedidos p, agora where p.status = 'pendente' and p.data < agora.hoje
union all
select 'media', 'consulta_sem_resposta', c.id::text, c.lancha||' '||c.data
  from consultas c, agora
 where c.recusada_em is null and c.virou_pedido_em is null and c.respondeu_em is null and c.data >= agora.hoje
   and c.aprov_aviso_em is not null and c.aprov_aviso_em < now() - interval '1 hour'
union all
select 'media', 'cobranca_aberta_orfa', pa.pedido::text, pa.metodo||' R$ '||pa.valor||' pedido '||coalesce(p.status,'apagado')
  from pagamentos_asaas pa left join pedidos p on p.id = pa.pedido
 where pa.pago_em is null and coalesce(p.status,'') <> 'pendente' and pa.criado_em < now() - interval '30 minutes'
union all
select 'media', 'sinal_maior_que_preco', p.id::text, 'sinal '||p.sinal_valor||' preço '||p.preco_cliente
  from pedidos p where p.status in ('aprovado','pendente') and p.preco_cliente > 0 and p.sinal_valor > p.preco_cliente
)
select x.g, x.t, x.ref, x.d from (select distinct r.g, r.t, r.ref, r.d from r) x
 where coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin') or public.e_admin()
 order by case x.g when 'alta' then 1 when 'media' then 2 else 3 end, x.t, x.ref;
$$;
revoke all on function public.revisao_dados() from public, anon;
grant execute on function public.revisao_dados() to authenticated, service_role;

-- 6) checagem automática a cada 3 horas (asaas-saude): conta Asaas, split ligado, saldo x partes de dono, pagamento não marcado, revisao_dados().
--    Problema grave avisa o administrador no celular (uma vez por dia por tipo). Mesmo padrão de chave do cron asaas-expirar.
select cron.schedule('asaas-saude', '41 */3 * * *', $c$
  select net.http_post(url := 'https://sqoperylsqcbcjpcrlnp.supabase.co/functions/v1/asaas-saude',
         headers := jsonb_build_object('Content-Type','application/json','x-chave',chave),
         body := '{"origem":"cron"}'::jsonb, timeout_milliseconds := 60000)
    from public.resgate_config where id = 1 and chave is not null
$c$);

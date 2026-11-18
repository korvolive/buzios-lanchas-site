-- publicar: auto
-- Lista de conversas do painel mais leve (2026-11-18, banco ficou sem processador às 20h05).
-- Mesmo resultado de antes. Muda só o custo: o login e o "é administrador?" são lidos uma vez
-- por chamada, e não uma vez por conversa; administrador não passa por participa() em cada linha.
-- Idempotente.
create or replace function public.minhas_conversas_v4()
 returns table(id bigint, tipo text, cliente uuid, cliente_nome text, vendedor uuid, vendedor_nome text, pedido bigint, lancha text, data date, horario text, status text, dono uuid, dono_nome text, ultima_em timestamp with time zone, ultima_msg text, ultimo_autor uuid, nao_lidas bigint, total bigint, encerrada_em timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- mensagens da Búzios Lanchas sem autor (pedido recebido, pagamento liberado) também contam como não lidas (Rodrigo, 2026-10-22)
  with eu as materialized (select auth.uid() as uid, public.e_admin() as adm),
  cs as materialized (
    select c.* from conversas c, eu
    where c.tipo is not null and (eu.adm or public.participa(c.id))
    order by c.ultima_em desc limit 300),
  dn as materialized (
    select distinct on (d.lancha) d.lancha, d.user_id, coalesce(pd.nome, split_part(u.email, '@', 1)) as nome
    from donos d left join perfis pd on pd.user_id = d.user_id left join auth.users u on u.id = d.user_id
    order by d.lancha, d.user_id),
  ms as materialized (
    select m.conversa,
      count(*) as total,
      count(*) filter (where m.autor is distinct from eu.uid
        and (m.autor is not null or m.sistema like 'pedido:%' or m.sistema like 'sinal:%' or m.sistema like 'ok:%' or m.sistema like 'pago:%')
        and m.id > coalesce(l.ate, 0)) as nao_lidas
    from mensagens m cross join eu
    left join conversa_lidas l on l.conversa = m.conversa and l.user_id = eu.uid
    where m.apagada_em is null and m.conversa in (select cs.id from cs)
    group by m.conversa)
  select c.id, c.tipo, c.cliente,
    case when c.vendedor = eu.uid then split_part(cl.nome, ' ', 1) else cl.nome end,
    c.vendedor, coalesce(pf.nome, cv.nome, f.nome),
    c.ref, p.lancha, p.data, p.horario, p.status,
    dn.user_id, dn.nome,
    c.ultima_em, c.ultima_msg, c.ultimo_autor,
    coalesce(ms.nao_lidas, 0), coalesce(ms.total, 0),
    c.encerrada_em
  from cs c cross join eu
  left join pedidos p on p.id = c.ref
  left join dn on dn.lancha = p.lancha
  left join ms on ms.conversa = c.id
  left join clientes cl on cl.user_id = c.cliente
  left join perfis pf on pf.user_id = c.vendedor left join clientes cv on cv.user_id = c.vendedor left join freelancers f on f.user_id = c.vendedor
  order by c.ultima_em desc;
$function$;

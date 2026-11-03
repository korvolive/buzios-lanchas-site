-- 2026-11-03 (Rodrigo): no "💼 Vender", o vendedor escolhe um cliente recorrente (lista + busca) em vez de digitar tudo.
-- Só aparecem os clientes DELE: ligados a ele hoje, de pedidos com ele ou de vendas que ele mesmo lançou.
create or replace function public.meus_clientes_venda()
returns table(nome text, telefone text, email text, ultimo timestamptz)
language sql stable security definer set search_path to 'public', 'auth' as $$
  with me as (select user_id from vendedores where user_id = auth.uid() and ativo and not coalesce(parceiro, false)),
  x as (
    -- clientes com conta ligados a ele, ou com pedido com ele
    select c.nome, c.whatsapp tel, u.email::text em, coalesce(cv.ate - interval '24 months', c.criado_em) quando
      from cliente_vendedor cv join me on me.user_id = cv.vendedor join clientes c on c.user_id = cv.cliente join auth.users u on u.id = c.user_id
      where cv.ate > now()
    union all
    select c.nome, c.whatsapp, u.email::text, p.criado_em
      from pedidos p join me on me.user_id = p.vendedor join clientes c on c.user_id = p.cliente join auth.users u on u.id = c.user_id
    union all
    -- vendas que ele lançou no "Vender"
    select q.nome, q.telefone, q.email, q.criado_em from consultas q join me on me.user_id = q.vendedor
  ),
  y as (select *, right(regexp_replace(coalesce(tel, ''), '\D', '', 'g'), 11) k from x where coalesce(btrim(nome), '') <> '' and length(regexp_replace(coalesce(tel, ''), '\D', '', 'g')) >= 10)
  select nome, tel, em, quando from (select distinct on (k) nome, tel, em, quando from y
  where not public.e_equipe(coalesce((select c.user_id from clientes c where right(regexp_replace(coalesce(c.whatsapp,''), '\D', '', 'g'), 11) = y.k limit 1), '00000000-0000-0000-0000-000000000000'::uuid))
  order by k, quando desc) z
  order by quando desc  -- os mais recentes primeiro
  limit 500;
$$;
revoke all on function public.meus_clientes_venda() from public, anon;
grant execute on function public.meus_clientes_venda() to authenticated;

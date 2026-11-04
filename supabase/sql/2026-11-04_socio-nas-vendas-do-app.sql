-- 2026-11-04 (Rodrigo): venda lançada pelo app (vendas_manuais) também divide a comissão com o sócio que convidou o vendedor (50/50),
-- igual às vendas pelo link do site. Antes só os pedidos do site dividiam.
alter table public.vendas_manuais add column if not exists indicacao_paga timestamptz;

drop function if exists public.vendas_manuais_lista();
create function public.vendas_manuais_lista()
 returns table(bloqueio_id bigint, lancha text, data date, horario text, vendedor uuid, codigo text, comissao numeric, paga timestamptz, cliente text,
               indicado_por uuid, parte numeric, indicacao_paga timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select m.bloqueio_id, b.lancha, b.data, b.horario, m.vendedor, v.codigo, m.comissao, m.paga, a.cliente,
         case when v.indicado_por is not null and coalesce(v.indicacao_pct, 0) > 0 then v.indicado_por end,
         case when v.indicado_por is not null and coalesce(v.indicacao_pct, 0) > 0 then round(m.comissao * v.indicacao_pct / 100, 2) else 0 end,
         m.indicacao_paga
    from public.vendas_manuais m join public.bloqueios b on b.id = m.bloqueio_id
    left join public.vendedores v on v.user_id = m.vendedor
    left join public.anotacoes a on a.bloqueio_id = m.bloqueio_id
   where public.painel_le()
     and not exists (select 1 from public.pedidos p where p.bloqueio_id = m.bloqueio_id and p.vendedor is not null)
   order by b.data;
$$;
grant execute on function public.vendas_manuais_lista() to authenticated;

create or replace function public.minhas_vendas_v2()
 returns table(id bigint, lancha text, data date, horario text, pessoas integer, status text, preco_base numeric, preco_cliente numeric, comissao numeric, comissao_paga timestamptz, cliente text, criado_em timestamptz, cliente_id uuid, cliente_nome text, cliente_whatsapp text, embarque text, hora_ini text, hora_fim text)
 language sql stable security definer set search_path to 'public' as $$
  select * from (
    select p.id, p.lancha, p.data, p.horario, p.pessoas, p.status, p.preco_base + x.parte, p.preco_cliente,
      greatest(coalesce(p.preco_cliente, 0) - coalesce(p.preco_base, 0), 0) - x.parte, p.comissao_paga, split_part(c.nome, ' ', 1), p.criado_em,
      p.cliente, c.nome, c.whatsapp, coalesce(nullif(a.embarque, ''), p.embarque), a.hora_ini, a.hora_fim
    from pedidos p left join clientes c on c.user_id = p.cliente left join anotacoes a on a.bloqueio_id = p.bloqueio_id
      left join vendedores v on v.user_id = p.vendedor
      cross join lateral (select case when v.indicado_por is not null
        then round(greatest(coalesce(p.preco_cliente, 0) - coalesce(p.preco_base, 0), 0) * v.indicacao_pct / 100, 2) else 0 end as parte) x
    where p.vendedor = auth.uid()
    union all
    -- venda lançada pelo app: o vendedor convidado vê só a parte dele (sem a do sócio)
    select -b.id, b.lancha, b.data, b.horario, a.pessoas, 'aprovado', a.valor - m.comissao + y.parte, a.valor,
      m.comissao - y.parte, m.paga, split_part(a.cliente, ' ', 1), m.criado_em,
      a.cliente_conta, a.cliente, a.telefone, nullif(a.embarque, ''), a.hora_ini, a.hora_fim
    from vendas_manuais m join bloqueios b on b.id = m.bloqueio_id left join anotacoes a on a.bloqueio_id = m.bloqueio_id
      left join vendedores v on v.user_id = m.vendedor
      cross join lateral (select case when v.indicado_por is not null then round(m.comissao * coalesce(v.indicacao_pct, 0) / 100, 2) else 0 end as parte) y
    where m.vendedor = auth.uid()
      and not exists (select 1 from pedidos p where p.bloqueio_id = m.bloqueio_id and p.vendedor is not null)
  ) t order by t.data desc limit 300;
$$;

create or replace function public.minhas_indicacoes()
 returns table(id bigint, lancha text, data date, horario text, status text, socio text, valor numeric, paga timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select * from (
    select p.id, p.lancha, p.data, p.horario, p.status, split_part(coalesce(pf.nome, c.nome, f.nome, ''), ' ', 1),
      round(greatest(coalesce(p.preco_cliente, 0) - coalesce(p.preco_base, 0), 0) * v.indicacao_pct / 100, 2), p.indicacao_paga
    from pedidos p join vendedores v on v.user_id = p.vendedor
      left join perfis pf on pf.user_id = p.vendedor left join clientes c on c.user_id = p.vendedor left join freelancers f on f.user_id = p.vendedor
    where v.indicado_por = auth.uid()
    union all
    select -b.id, b.lancha, b.data, b.horario, 'aprovado', split_part(coalesce(pf.nome, c.nome, f.nome, ''), ' ', 1),
      round(m.comissao * v.indicacao_pct / 100, 2), m.indicacao_paga
    from vendas_manuais m join bloqueios b on b.id = m.bloqueio_id join vendedores v on v.user_id = m.vendedor
      left join perfis pf on pf.user_id = m.vendedor left join clientes c on c.user_id = m.vendedor left join freelancers f on f.user_id = m.vendedor
    where v.indicado_por = auth.uid() and coalesce(v.indicacao_pct, 0) > 0
      and not exists (select 1 from pedidos p where p.bloqueio_id = m.bloqueio_id and p.vendedor is not null)
  ) t order by t.data desc limit 300;
$$;

-- pid negativo = venda do app (vendas_manuais, -bloqueio_id)
create or replace function public.pagar_indicacao(pid bigint, sim boolean)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare quem uuid; d date;
begin
  if not e_admin() then raise exception 'Só o administrador'; end if;
  if pid < 0 then
    select v.indicado_por, b.data into quem, d from vendas_manuais m join vendedores v on v.user_id = m.vendedor join bloqueios b on b.id = m.bloqueio_id where m.bloqueio_id = -pid;
  else
    select v.indicado_por, p.data into quem, d from pedidos p join vendedores v on v.user_id = p.vendedor where p.id = pid;
  end if;
  if quem is null then raise exception 'sem_socio' using errcode = 'P0001'; end if;
  if sim and d > current_date then raise exception 'depois_do_passeio' using errcode = 'P0001'; end if;
  if sim and not public.vendedor_ok(quem) then raise exception 'falta_confirmar' using errcode = 'P0001'; end if;
  if pid < 0 then update vendas_manuais set indicacao_paga = case when sim then now() end where bloqueio_id = -pid;
  else update pedidos set indicacao_paga = case when sim then now() end where id = pid; end if;
end $$;

select 'ok' as socio_nas_vendas_do_app;

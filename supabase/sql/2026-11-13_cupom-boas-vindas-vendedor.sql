-- Cupom de boas-vindas por vendedor (2026-11-13, pedido do dono para a landing /petrussia).
-- Quem cria a conta pelo link do vendedor, confirma o WhatsApp e ainda não tem passeio aprovado
-- ganha um cupom do dono numa lancha (padrão Miss Bardot), 1 por pessoa e por WhatsApp, válido 6 meses.
-- Liga por vendedor: vendedores.cupom_boas_vindas (valor; vazio = desligado). Só vale para contas criadas depois de cupom_bv_desde.
alter table public.vendedores add column if not exists cupom_boas_vindas integer;
alter table public.vendedores add column if not exists cupom_bv_lancha text default 'miss-bardot';
alter table public.vendedores add column if not exists cupom_bv_desde timestamptz;
alter table public.cupons add column if not exists origem text;
alter table public.cupons alter column origem_pedido drop not null; -- cupom de boas-vindas não vem de um passeio
create unique index if not exists cupons_boas_vindas_um_por_cliente on public.cupons(cliente) where origem = 'boas-vindas';

create or replace function public.gerar_cupom_boas_vindas(uid uuid)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare v public.vendedores; c public.clientes; tel text;
begin
  if uid is null then return; end if;
  select vd.* into v from public.cliente_vendedor cv join public.vendedores vd on vd.user_id = cv.vendedor
   where cv.cliente = uid and cv.ate > now() and vd.ativo and coalesce(vd.cupom_boas_vindas,0) > 0;
  if v.user_id is null then return; end if;
  select * into c from public.clientes where user_id = uid;
  if c.user_id is null or c.whatsapp_ok_em is null then return; end if;
  if v.cupom_bv_desde is not null and c.criado_em < v.cupom_bv_desde then return; end if; -- só conta nova
  if exists (select 1 from public.pedidos p where p.cliente = uid and p.status = 'aprovado') then return; end if;
  tel := right(regexp_replace(coalesce(c.whatsapp,''), '\D', '', 'g'), 8);
  if exists (select 1 from public.cupons k left join public.clientes o on o.user_id = k.cliente
              where k.origem = 'boas-vindas'
                and (k.cliente = uid or (length(tel) = 8 and right(regexp_replace(coalesce(o.whatsapp,''), '\D', '', 'g'), 8) = tel))) then return; end if;
  insert into public.cupons(cliente, valor, expira_em, tipo, lancha, origem)
  values (uid, v.cupom_boas_vindas, (current_date + interval '6 months')::date, 'dono', coalesce(v.cupom_bv_lancha, 'miss-bardot'), 'boas-vindas')
  on conflict do nothing;
end $f$;
revoke all on function public.gerar_cupom_boas_vindas(uuid) from public, anon, authenticated;

create or replace function public.meus_cupons_v2()
 returns table(id bigint, valor numeric, expira_em date, origem_pedido bigint, pedido bigint, usado_em timestamp with time zone, tipo text, lancha text)
 language plpgsql security definer set search_path to 'public' as $f$
begin
  if auth.uid() is null then return; end if;
  perform public.gerar_cupons(auth.uid());
  perform public.gerar_cupom_boas_vindas(auth.uid());
  return query select c.id, c.valor, c.expira_em, c.origem_pedido, c.pedido, c.usado_em, c.tipo, c.lancha from public.cupons c
    where c.cliente = auth.uid() and (c.pedido is not null or c.expira_em >= current_date) order by c.expira_em;
end $f$;

create or replace function public.meus_cupons()
 returns table(id bigint, valor numeric, expira_em date, origem_pedido bigint, pedido bigint, usado_em timestamp with time zone)
 language plpgsql security definer set search_path to 'public' as $f$
begin
  if auth.uid() is null then return; end if;
  perform public.gerar_cupons(auth.uid());
  perform public.gerar_cupom_boas_vindas(auth.uid());
  return query select c.id, c.valor, c.expira_em, c.origem_pedido, c.pedido, c.usado_em from public.cupons c
    where c.cliente = auth.uid() and (c.pedido is not null or c.expira_em >= current_date) order by c.expira_em;
end $f$;

update public.vendedores set cupom_boas_vindas = 100, cupom_bv_lancha = 'miss-bardot', cupom_bv_desde = now() where codigo = 'PETRUSSIA76';

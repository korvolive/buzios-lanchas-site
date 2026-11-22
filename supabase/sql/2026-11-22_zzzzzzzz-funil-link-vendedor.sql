-- publicar: auto
-- Funil de quem chega pelo link ou QR Code de vendedor/parceiro (Rodrigo 2026-11-22: "descobrir onde os clientes param").
-- Antes não dava para medir: quem não confirmava o WhatsApp era apagado em 24 h (cron leads-24h) e ninguém contava quem abria o link.
-- Agora o site grava cada etapa, uma vez por aparelho, sem dado pessoal (só o código do vendedor, a etapa e um número aleatório do aparelho):
--   abriu (entrou com o link, sem conta), janela (viu a janelinha do WhatsApp), fechou (fechou a janelinha sem confirmar),
--   form (mandou nome e WhatsApp), codigo (confirmou o código e liberou os valores), wa_vendedor (tocou no WhatsApp do vendedor),
--   reserva (tocou em Solicitar reserva), conta (criou a conta na própria página), pedido (pedido enviado).
-- Idempotente.
create table if not exists public.vendedor_funil (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  vendedor text not null,
  etapa text not null,
  sid text not null,
  unique (sid, vendedor, etapa)
);
create index if not exists vendedor_funil_criado on public.vendedor_funil (criado_em);
alter table public.vendedor_funil enable row level security; -- sem políticas: só as funções abaixo leem e gravam
revoke all on public.vendedor_funil from public, anon, authenticated;
revoke all on sequence public.vendedor_funil_id_seq from public, anon, authenticated;

create or replace function public.funil_vendedor(p_cod text, p_etapa text, p_sid text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare c text := upper(btrim(coalesce(p_cod, '')));
begin
  if p_etapa is null or p_etapa not in ('abriu','janela','fechou','form','codigo','wa_vendedor','reserva','conta','pedido') then return; end if;
  if c !~ '^[A-Z0-9]{2,14}$' or coalesce(p_sid, '') !~ '^[a-z0-9]{8,40}$' then return; end if;
  if not exists (select 1 from vendedores where codigo = c and ativo) then return; end if;
  if (select count(*) from vendedor_funil where criado_em > now() - interval '1 day') >= 5000 then return; end if; -- trava contra abuso
  insert into vendedor_funil (vendedor, etapa, sid) values (c, p_etapa, p_sid) on conflict do nothing;
end $$;
revoke all on function public.funil_vendedor(text, text, text) from public;
grant execute on function public.funil_vendedor(text, text, text) to anon, authenticated;

-- resumo por vendedor (só o administrador)
create or replace function public.funil_vendedor_resumo(p_dias int default 30)
 returns table(vendedor text, abriu bigint, janela bigint, fechou bigint, form bigint, codigo bigint, wa_vendedor bigint, reserva bigint, conta bigint, pedido bigint)
 language sql stable security definer set search_path to 'public'
as $$
  select f.vendedor,
    count(*) filter (where etapa = 'abriu'), count(*) filter (where etapa = 'janela'), count(*) filter (where etapa = 'fechou'),
    count(*) filter (where etapa = 'form'), count(*) filter (where etapa = 'codigo'), count(*) filter (where etapa = 'wa_vendedor'),
    count(*) filter (where etapa = 'reserva'), count(*) filter (where etapa = 'conta'), count(*) filter (where etapa = 'pedido')
  from vendedor_funil f
  where public.e_admin() and f.criado_em > now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 400)))
  group by f.vendedor order by 2 desc;
$$;
revoke all on function public.funil_vendedor_resumo(int) from public, anon;
grant execute on function public.funil_vendedor_resumo(int) to authenticated;

do $$ begin
  perform cron.unschedule('funil-vendedor-limpar') where exists (select 1 from cron.job where jobname = 'funil-vendedor-limpar');
  perform cron.schedule('funil-vendedor-limpar', '47 4 * * *', $c$delete from public.vendedor_funil where criado_em < now() - interval '400 days'$c$);
end $$;

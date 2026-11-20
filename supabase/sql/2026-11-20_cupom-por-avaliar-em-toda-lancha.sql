-- publicar: auto
-- Cupom por avaliar o marinheiro em TODA lancha (Rodrigo 2026-11-20).
-- Lancha com cupom do dono (cupom_dono): continua igual (cupom do dono, só naquela lancha).
-- Lancha SEM cupom do dono: o site dá o cupom, igual ao de boas-vindas: R$ 100 na Miss Bardot ou R$ 50 em qualquer
-- outra lancha, saindo só da comissão da Búzios e nunca passando dela (pedido_cupom_antes / pedido_zz_cupom_teto já tratam).
-- O cupom nasce só depois de avaliar o marinheiro no app (nunca pela avaliação do Google). Vale para passeios a partir de 20/11/2026.
-- Desligar: update cupom_site_config set aval_ativo = false;
-- Idempotente.

alter table public.cupom_site_config add column if not exists aval_ativo boolean not null default true;
alter table public.cupom_site_config add column if not exists aval_desde date not null default date '2026-11-20';

create or replace function public.gerar_cupons(uid uuid)
 returns void language sql security definer set search_path to 'public' as $function$
  with feitos as (
    select p.id, p.cliente, p.lancha, p.vendedor, b.data
      from public.pedidos p join public.bloqueios b on b.id = p.bloqueio_id
      left join public.anotacoes a on a.bloqueio_id = b.id
      left join public.realizados r on r.bloqueio_id = b.id
     where p.cliente = uid and p.status = 'aprovado' and coalesce(r.aconteceu, true)
       and b.data >= date '2026-10-22' -- só passeios a partir do lançamento do cupom
       and (exists (select 1 from public.avaliacoes v where v.pedido_id = p.id) -- avaliou (o marinheiro, ou a lancha no fluxo antigo)
            or (a.marinheiro is null and b.data >= date '2026-11-01')) -- passeio sem marinheiro (a partir do novo fluxo): não há o que avaliar no app
       and (b.data + coalesce(nullif(a.hora_fim,'')::time, case b.horario when 'manha' then time '14:00' when 'tarde' then time '18:00' when 'dia' then time '17:00' else time '23:59' end)) at time zone 'America/Sao_Paulo' < now()
  ), dono as (
    insert into public.cupons(cliente, origem_pedido, valor, expira_em, tipo, lancha)
    select f.cliente, f.id, cd.valor, (f.data + interval '6 months')::date, 'dono', f.lancha
      from feitos f join public.cupom_dono cd on cd.lancha = f.lancha and cd.valor > 0
    on conflict (origem_pedido, tipo) do nothing
    returning origem_pedido
  )
  -- lancha sem cupom do dono: cupom do site (qualquer lancha)
  insert into public.cupons(cliente, origem_pedido, valor, valor_outras, expira_em, tipo, lancha, origem)
  select f.cliente, f.id, cfg.valor_mb, cfg.valor_outras, (f.data + make_interval(months => cfg.validade_meses))::date, 'buzios', null, 'avaliacao'
    from feitos f cross join public.cupom_site_config cfg
   where cfg.id = 1 and cfg.aval_ativo and f.data >= cfg.aval_desde
     and not exists (select 1 from public.cupom_dono cd where cd.lancha = f.lancha and cd.valor > 0)
     and not exists (select 1 from public.cupons k where k.origem_pedido = f.id)
  on conflict (origem_pedido, tipo) do nothing;
$function$;

-- Quais lanchas dão cupom por avaliar: dono (só naquela lancha) ou site (qualquer lancha). Sem valor (só aparece depois de ganhar).
create or replace function public.cupom_avaliacao_lanchas()
 returns table(lancha text, site boolean, desde date)
 language sql stable security definer set search_path to 'public' as $f$
  select l.slug,
         not exists (select 1 from public.cupom_dono cd where cd.lancha = l.slug and cd.valor > 0),
         case when exists (select 1 from public.cupom_dono cd where cd.lancha = l.slug and cd.valor > 0) then date '2026-10-22' else cfg.aval_desde end
    from public.lanchas l cross join public.cupom_site_config cfg
   where cfg.id = 1
     and (exists (select 1 from public.cupom_dono cd where cd.lancha = l.slug and cd.valor > 0) or cfg.aval_ativo)
$f$;
revoke all on function public.cupom_avaliacao_lanchas() from public;
grant execute on function public.cupom_avaliacao_lanchas() to anon, authenticated, service_role;

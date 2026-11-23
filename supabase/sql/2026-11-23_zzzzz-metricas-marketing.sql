-- publicar: auto
-- Métricas diárias de marketing (Rodrigo 2026-11-23 aprovou o plano do Diretor): cruzar Google Ads com contatos e reservas.
-- A VPS (login wa_ponte_box) chama esta função 1 vez por dia (nunca em polling) e junta com os contatos novos do WhatsApp,
-- que só existem na VPS. O Analista (OpenBot) lê o resultado e cruza com cliques/custo por campanha do Google Ads.
-- Só números agregados por dia: sem nome, telefone, e-mail, texto de mensagem nem identificador de clique.
-- Atribuição ao Google: o pedido pago tem, em rastreio_visitas, uma visita com gclid/gbraid/wbraid ou utm_source google
-- (mesmo aparelho, consentimento ok, até 90 dias). Campanha = utm_campaign dessa visita (só existe quando o anúncio manda
-- utm_campaign no sufixo do URL final). Página /es ou /en = idioma do site no clique do WhatsApp.
-- Idempotente.
create or replace function public.metricas_marketing(p_de date, p_ate date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare r jsonb;
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 92 then raise exception 'periodo'; end if;
  with dias as (
    select d::date dia from generate_series(p_de, p_ate, interval '1 day') d
  ), vis as (
    select (v.criado_em at time zone 'America/Sao_Paulo')::date dia, v.evento, v.pagina, v.pedido,
           coalesce(nullif(lower(v.utm_campaign), ''), '') camp,
           (v.gclid is not null or v.gbraid is not null or v.wbraid is not null or lower(coalesce(v.utm_source, '')) = 'google') google
    from rastreio_visitas v
    where v.criado_em >= (p_de::timestamp at time zone 'America/Sao_Paulo')
      and v.criado_em < ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
  ), cliques as (
    select dia,
      count(*) total,
      count(*) filter (where google) google,
      count(*) filter (where pagina like '/es%') site_es,
      count(*) filter (where pagina like '/en%') site_en,
      count(*) filter (where pagina not like '/es%' and pagina not like '/en%') site_pt,
      count(*) filter (where google and pagina like '/es%') google_es,
      count(*) filter (where google and pagina like '/en%') google_en
    from vis where evento = 'whatsapp_click' group by dia
  ), camp_cliques as (
    select dia, jsonb_object_agg(camp, n) j from (
      select dia, camp, count(*) n from vis where evento = 'whatsapp_click' and camp <> '' group by dia, camp) x group by dia
  ), leads as (
    select dia, count(*) total, count(*) filter (where google) google from vis where evento = 'lead' group by dia
  ), ped as (
    select (p.criado_em at time zone 'America/Sao_Paulo')::date dia,
      count(*) criados, count(*) filter (where p.status = 'cancelado') cancelados
    from pedidos p
    where p.criado_em >= (p_de::timestamp at time zone 'America/Sao_Paulo')
      and p.criado_em < ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
    group by 1
  ), pago as (
    select c.pedido, (c.pago_em at time zone 'America/Sao_Paulo')::date dia, c.valor,
      exists (select 1 from rastreio_visitas v where v.pedido = c.pedido
              and (v.gclid is not null or v.gbraid is not null or v.wbraid is not null or lower(coalesce(v.utm_source, '')) = 'google')) google,
      (select lower(v.utm_campaign) from rastreio_visitas v where v.pedido = c.pedido and coalesce(v.utm_campaign, '') <> ''
       order by v.criado_em desc limit 1) camp
    from conversoes c
    where c.evento = 'purchase'
      and c.pago_em >= (p_de::timestamp at time zone 'America/Sao_Paulo')
      and c.pago_em < ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
  ), pagos as (
    select dia, count(*) n, sum(valor) sinal, count(*) filter (where google) google, coalesce(sum(valor) filter (where google), 0) sinal_google
    from pago group by dia
  ), camp_pagos as (
    select dia, jsonb_object_agg(camp, n) j from (select dia, camp, count(*) n from pago where camp is not null group by dia, camp) x group by dia
  ), gasto as (
    select data dia, sum(valor) valor from lucro_gastos where nome = 'Google Ads' and data between p_de and p_ate group by data
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'dia', d.dia,
      'gasto_google_ads', g.valor,
      'cliques_whatsapp_site', coalesce(c.total, 0),
      'cliques_whatsapp_site_vindos_do_google', coalesce(c.google, 0),
      'cliques_whatsapp_por_idioma', jsonb_build_object('pt', coalesce(c.site_pt, 0), 'es', coalesce(c.site_es, 0), 'en', coalesce(c.site_en, 0)),
      'cliques_whatsapp_google_por_idioma', jsonb_build_object('es', coalesce(c.google_es, 0), 'en', coalesce(c.google_en, 0)),
      'cliques_whatsapp_por_campanha', coalesce(cc.j, '{}'::jsonb),
      'leads_site', coalesce(l.total, 0),
      'leads_site_vindos_do_google', coalesce(l.google, 0),
      'pedidos_criados', coalesce(pe.criados, 0),
      'pedidos_criados_ja_cancelados', coalesce(pe.cancelados, 0),
      'reservas_pagas', coalesce(pg.n, 0),
      'sinal_pago', coalesce(pg.sinal, 0),
      'reservas_pagas_vindas_do_google', coalesce(pg.google, 0),
      'sinal_pago_vindo_do_google', coalesce(pg.sinal_google, 0),
      'reservas_pagas_por_campanha', coalesce(cp.j, '{}'::jsonb),
      'custo_por_reserva_paga', case when coalesce(pg.n, 0) > 0 and g.valor is not null then round(g.valor / pg.n, 2) end,
      'custo_por_reserva_paga_do_google', case when coalesce(pg.google, 0) > 0 and g.valor is not null then round(g.valor / pg.google, 2) end
    ) order by d.dia), '[]'::jsonb)
  into r
  from dias d
  left join cliques c on c.dia = d.dia
  left join camp_cliques cc on cc.dia = d.dia
  left join leads l on l.dia = d.dia
  left join ped pe on pe.dia = d.dia
  left join pagos pg on pg.dia = d.dia
  left join camp_pagos cp on cp.dia = d.dia
  left join gasto g on g.dia = d.dia;
  return r;
end $$;
revoke all on function public.metricas_marketing(date, date) from public, anon, authenticated;
grant execute on function public.metricas_marketing(date, date) to wa_ponte_box;

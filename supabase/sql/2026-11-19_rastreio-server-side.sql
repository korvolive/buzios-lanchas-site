-- publicar: auto
-- Rastreio server-side Meta (API de Conversões) + Google (GA4 Measurement Protocol), pedido do Zaaitar/Rodrigo 2026-11-19.
-- 1) rastreio_visitas: identificadores da visita que o site manda (clique no WhatsApp, Lead, visita ao /pagar): client_id/session_id
--    do Analytics, _fbp/_fbc da Meta, gclid/gbraid/wbraid, utm. IP e navegador só para a Meta (apagados em 90 dias). Sem nome, telefone,
--    e-mail nem texto de mensagem.
-- 2) conversoes: uma linha por pagamento confirmado (Asaas Pix/cartão ou PayPal), criada pelo gatilho do banco quando pago_em é
--    preenchido. event_id = "pedido-<id>" (o mesmo transaction_id do Analytics): webhook repetido não duplica (unique).
--    A função conversoes manda à Meta e ao GA4 e guarda o resultado; nova tentativa reaproveita o mesmo event_id.
-- Só o servidor lê e grava (RLS ligado, sem política; anon/authenticated sem permissão). Idempotente.

create table if not exists public.rastreio_visitas (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  evento text not null,
  event_id text,
  consentimento text not null default 'ok',
  site text, pagina text, posicao text,
  ga_client_id text, ga_session_id text, fbp text, fbc text,
  gclid text, gbraid text, wbraid text,
  utm_source text, utm_medium text, utm_campaign text,
  ip text, ua text,
  usuario uuid, consulta uuid, pedido bigint,
  meta_status text, meta_resposta text
);
create unique index if not exists rastreio_visitas_event_id on public.rastreio_visitas (event_id) where event_id is not null;
create index if not exists rastreio_visitas_usuario on public.rastreio_visitas (usuario, criado_em desc) where usuario is not null;
create index if not exists rastreio_visitas_consulta on public.rastreio_visitas (consulta) where consulta is not null;
create index if not exists rastreio_visitas_pedido on public.rastreio_visitas (pedido, criado_em desc) where pedido is not null;
create index if not exists rastreio_visitas_ip on public.rastreio_visitas (ip, criado_em desc) where ip is not null;
alter table public.rastreio_visitas enable row level security;
revoke all on public.rastreio_visitas from anon, authenticated;

create table if not exists public.conversoes (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  evento text not null default 'purchase',
  event_id text not null unique,
  pedido bigint not null,
  valor numeric not null,
  moeda text not null default 'BRL',
  origem text not null,
  pago_em timestamptz not null,
  meta_status text not null default 'pendente',
  meta_tentativas int not null default 0,
  meta_resposta text,
  ga_status text not null default 'pendente',
  ga_tentativas int not null default 0,
  ga_resposta text,
  proxima_em timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists conversoes_pendentes on public.conversoes (proxima_em) where meta_status in ('pendente','erro') or ga_status in ('pendente','erro');
alter table public.conversoes enable row level security;
revoke all on public.conversoes from anon, authenticated;

-- chama a função conversoes na hora (pg_net manda depois do commit); se falhar, o cron de 5 em 5 minutos tenta de novo
create or replace function public.conversoes_chamar() returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(url := 'https://sqoperylsqcbcjpcrlnp.supabase.co/functions/v1/conversoes',
    headers := jsonb_build_object('content-type','application/json','x-chave',chave),
    body := '{"acao":"enviar"}'::jsonb, timeout_milliseconds := 30000)
  from public.resgate_config where id = 1 and chave is not null;
exception when others then null; -- rastreio nunca atrapalha o pagamento
end $$;
revoke all on function public.conversoes_chamar() from public, anon, authenticated;

-- pagamento confirmado pelo Asaas (Pix, Pix sem vencimento, cartão): valor = sinal em reais (sem a taxa do cartão, que fica com a operadora)
create or replace function public.conversao_asaas() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pago_em is not null and (tg_op = 'INSERT' or old.pago_em is null) and coalesce(new.sinal, new.valor, 0) > 0 then
    insert into public.conversoes (event_id, pedido, valor, origem, pago_em)
    values ('pedido-' || new.pedido, new.pedido, round(coalesce(new.sinal, new.valor)::numeric, 2), 'asaas_' || coalesce(new.metodo, 'pix'), new.pago_em)
    on conflict (event_id) do nothing;
    if found then perform public.conversoes_chamar(); end if;
  end if;
  return new;
exception when others then
  raise warning 'conversao_asaas %', sqlerrm; return new; -- rastreio nunca atrapalha o pagamento
end $$;
revoke all on function public.conversao_asaas() from public, anon, authenticated;
drop trigger if exists conversao_asaas on public.pagamentos_asaas;
create trigger conversao_asaas after insert or update of pago_em on public.pagamentos_asaas for each row execute function public.conversao_asaas();

-- pagamento confirmado pelo PayPal (moeda estrangeira): valor = sinal do pedido em reais (+ jetski), como no recibo
create or replace function public.conversao_paypal() returns trigger language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if new.pago_em is not null and (tg_op = 'INSERT' or old.pago_em is null) and new.captura is not null then
    select coalesce(p.sinal_valor, 0) + coalesce(p.jetski_valor, 0) into v from public.pedidos p where p.id = new.pedido;
    if coalesce(v, 0) <= 0 and new.moeda = 'BRL' then v := new.valor; end if;
    if coalesce(v, 0) > 0 then
      insert into public.conversoes (event_id, pedido, valor, origem, pago_em)
      values ('pedido-' || new.pedido, new.pedido, round(v, 2), 'paypal', new.pago_em)
      on conflict (event_id) do nothing;
      if found then perform public.conversoes_chamar(); end if;
    end if;
  end if;
  return new;
exception when others then
  raise warning 'conversao_paypal %', sqlerrm; return new;
end $$;
revoke all on function public.conversao_paypal() from public, anon, authenticated;
drop trigger if exists conversao_paypal on public.pagamentos_pp;
create trigger conversao_paypal after insert or update of pago_em on public.pagamentos_pp for each row execute function public.conversao_paypal();

-- novas tentativas: só chama a função quando há conversão pendente (consulta barata, nada de poll curto no banco)
do $$ begin
  perform cron.unschedule('conversoes-enviar') where exists (select 1 from cron.job where jobname = 'conversoes-enviar');
  perform cron.schedule('conversoes-enviar', '*/5 * * * *',
    $c$select public.conversoes_chamar() where exists (select 1 from public.conversoes where proxima_em <= now() and (meta_status in ('pendente','erro') or ga_status in ('pendente','erro')))$c$);
  perform cron.unschedule('rastreio-limpar') where exists (select 1 from cron.job where jobname = 'rastreio-limpar');
  perform cron.schedule('rastreio-limpar', '40 4 * * *',
    $c$update public.rastreio_visitas set ip = null, ua = null where criado_em < now() - interval '90 days' and (ip is not null or ua is not null);
       delete from public.rastreio_visitas where criado_em < now() - interval '400 days'$c$);
end $$;

-- Búzios Lanchas: pedido esperando aprovação avisa quem aprova na hora e lembra (2026-11-16).
-- A função aviso-aprovacao (pg_cron a cada minuto) marca aqui o que já avisou; a VPS (painel-worker) usa as mesmas colunas
-- para mandar o WhatsApp a quem aprova.
alter table public.consultas add column if not exists aprov_aviso_em timestamptz;
alter table public.consultas add column if not exists aprov_lembrete_em timestamptz;
alter table public.consultas add column if not exists aprov_lembretes smallint not null default 0;
-- o que já está parado hoje não dispara aviso velho: a função só avisa o que foi lançado há menos de 6 h

select cron.schedule('aviso-aprovacao', '* * * * *', $$ select net.http_post(url := 'https://sqoperylsqcbcjpcrlnp.supabase.co/functions/v1/aviso-aprovacao', headers := jsonb_build_object('Content-Type','application/json','x-chave',chave), body := '{}'::jsonb, timeout_milliseconds := 30000) from public.resgate_config where id = 1 and chave is not null $$);

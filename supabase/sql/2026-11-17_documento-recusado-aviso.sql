-- publicar: auto
-- Documento recusado pelo Asaas (Rodrigo 2026-11-17): a própria Búzios avisa a pessoa (push + WhatsApp Utility documento_reenviar)
-- com o motivo em linguagem simples e o link para enviar de novo; lembra todo dia até reenviar. Função asaas-docs {rejeitados:true}.
-- Idempotente.

alter table public.asaas_contas
  add column if not exists rejeicao_chave text,          -- quais documentos o Asaas recusou (ids); mudou = recusa nova, aviso na hora
  add column if not exists rejeicao_motivo text,         -- código do motivo (ilegivel, reflexo, cortado, selfie, vencido, titular, outro)
  add column if not exists rejeicao_em timestamptz,      -- quando a recusa foi vista
  add column if not exists rejeicao_proximo timestamptz, -- próximo aviso (lembrete)
  add column if not exists rejeicao_avisos int not null default 0,
  add column if not exists reenvio_token uuid;           -- link /documento/?t= do WhatsApp (só abre o envio do próprio documento)

create unique index if not exists asaas_contas_reenvio_token on public.asaas_contas (reenvio_token) where reenvio_token is not null;

alter table public.resgate_config add column if not exists docrej_modelo_em timestamptz;
alter table public.resgate_config add column if not exists docrej_ativo boolean not null default true;

-- robô de 10 em 10 minutos (o webhook do Asaas também chama na hora)
do $$ begin
  if exists (select 1 from cron.job where jobname = 'asaas-docs-rejeitados') then perform cron.unschedule('asaas-docs-rejeitados'); end if;
  perform cron.schedule('asaas-docs-rejeitados', '*/10 * * * *', $c$
    select net.http_post(url := 'https://sqoperylsqcbcjpcrlnp.supabase.co/functions/v1/asaas-docs',
      headers := jsonb_build_object('content-type','application/json','x-chave',(select chave from resgate_config where id=1)),
      body := '{"rejeitados":true}'::jsonb, timeout_milliseconds := 60000)
  $c$);
end $$;

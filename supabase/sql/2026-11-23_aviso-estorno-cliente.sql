-- publicar: auto
-- Rodrigo 23/11: todo estorno avisa o cliente pelo WhatsApp oficial, com o comprovante do Asaas.
-- O envio é do painel-worker (VPS); aqui só a marca de "já avisado", para nunca mandar duas vezes. Idempotente.
alter table public.pagamentos_asaas add column if not exists estorno_aviso_em timestamptz;
comment on column public.pagamentos_asaas.estorno_aviso_em is 'quando o cliente foi avisado do estorno (WhatsApp oficial, com comprovante)';

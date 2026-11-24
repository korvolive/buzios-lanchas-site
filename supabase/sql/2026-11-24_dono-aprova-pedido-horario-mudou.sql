-- publicar: auto
-- Búzios Lanchas (Rodrigo 2026-11-24): pedido do site com horário mudado antes de o dono responder volta ao dono com o horário
-- certo. aprovacoes_dono.slot guarda o horário avisado (turno|hora_ini|hora_fim); a função dono-aprovacao compara com o pedido.
-- Idempotente.
alter table public.aprovacoes_dono add column if not exists slot text;

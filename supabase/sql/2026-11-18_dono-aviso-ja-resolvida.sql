-- publicar: auto
-- Dono avisado quando a pré-reserva que ele recebeu para aprovar já foi resolvida pela Búzios Lanchas (Rodrigo 2026-11-18).
-- A função dono-aprovacao marca aqui quando avisou, para avisar uma vez só. Idempotente.
alter table public.aprovacoes_dono add column if not exists fim_avisado_em timestamptz;
alter table public.aprovacoes_dono add column if not exists fim_estado text;
alter table public.resgate_config add column if not exists fim_modelo_em timestamptz;
-- as de antes desta mudança não recebem aviso atrasado
update public.aprovacoes_dono set fim_avisado_em = now(), fim_estado = 'antes_do_aviso'
 where fim_avisado_em is null and resposta is null and criado_em < '2026-11-18 15:00:00+00';

-- publicar: auto
-- Miss Bardot (Rodrigo 2026-11-21): passeios futuros que ficaram sem local de embarque salvo
-- (criados antes do gatilho por período) recebem o local que valia quando foram fechados:
--   manhã fechada a partir de 21/11 15h (Brasília) -> Porto Veleiro (Rodrigo escolheu para o passeio de 22/11 10h)
--   manhã fechada antes disso e tarde -> Píer do Golfinho (regra antiga; "o que já foi, já foi")
-- Só preenche vazio; local já salvo não muda. Sem dado de cliente; idempotente.
update public.anotacoes a
   set embarque = case when b.horario = 'manha' and b.criado_em >= timestamptz '2026-11-21 18:00:00+00'
                       then 'Porto Veleiro (Praia dos Ossos)' else 'Píer do Golfinho (Praia dos Ossos)' end
  from public.bloqueios b
 where b.id = a.bloqueio_id
   and b.lancha = 'miss-bardot'
   and b.horario in ('manha', 'tarde')
   and b.data >= (now() at time zone 'America/Sao_Paulo')::date
   and nullif(btrim(coalesce(a.embarque, '')), '') is null;

-- Conferir: nenhuma Miss Bardot futura de manhã/tarde sem embarque
select count(*) as sem_embarque from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
 where b.lancha = 'miss-bardot' and b.horario in ('manha', 'tarde')
   and b.data >= (now() at time zone 'America/Sao_Paulo')::date and a.embarque is null;

-- publicar: auto
-- 2026-11-21 (caso Sarah, Midas 22/11 tarde, consulta 177): o Lucas lançou às 15:16:26 e o administrador aprovou às 15:16:42,
-- antes do cron de 1 minuto da edge dono-aprovacao. Como a consulta some na aprovação, o cron não achava nada e o dono
-- não recebia nem o pedido de aprovação nem o aviso de "já aprovada".
-- Correção: quando uma consulta LANÇADA PELA EQUIPE numa lancha sem reserva automática é aprovada (some de consultas e existe
-- o bloqueio com o mesmo telefone na mesma data e horário) e o dono ainda não tem linha em aprovacoes_dono, cria a linha já
-- como enviada. No minuto seguinte o avisarResolvidas da edge manda ao dono "a pré-reserva ... já foi aprovada pela Búzios Lanchas"
-- (modelo dono_reserva_resolvida + app), pelo mesmo caminho de sempre. Não mexe no cliente nem no fluxo em que o dono aprova.
-- Idempotente. Desfazer: drop trigger zz_consulta_aprovada_avisa_dono on public.consultas; drop function public.tg_consulta_aprovada_avisa_dono();

create or replace function public.tg_consulta_aprovada_avisa_dono()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare d8 text := right(regexp_replace(coalesce(old.telefone, ''), '\D', '', 'g'), 8);
begin
  if old.criado_por is null or old.recusada_em is not null or old.grupo is not null then return old; end if;
  if old.data < (now() at time zone 'America/Sao_Paulo')::date then return old; end if;
  if coalesce((select l.reserva_auto from public.lanchas l where l.slug = old.lancha), true) then return old; end if;
  if length(d8) < 8 then return old; end if;
  if exists (select 1 from public.aprovacoes_dono a where a.consulta_id = old.id) then return old; end if;
  -- só se foi APROVADA (mesma regra do dono_aprovacao_ver): bloqueio na mesma lancha/data/horário com o telefone do cliente
  if not exists (select 1 from public.bloqueios b join public.anotacoes n on n.bloqueio_id = b.id
                 where b.lancha = old.lancha and b.data = old.data and public.choca_horario(b.horario, old.horario)
                   and right(regexp_replace(coalesce(n.telefone, ''), '\D', '', 'g'), 8) = d8) then return old; end if;
  insert into public.aprovacoes_dono (consulta_id, dono, lancha, data, horario, tel_fim, enviado_em, envio)
  select old.id, d.user_id, old.lancha, old.data, old.horario, d8, now(), 'admin-antes-do-cron'
    from public.donos d join public.perfis p on p.user_id = d.user_id
   where d.lancha = old.lancha and coalesce(regexp_replace(p.telefone, '\D', '', 'g'), '') <> ''
  on conflict (consulta_id, dono) do nothing;
  return old;
exception when others then
  raise warning 'aviso dono (consulta %): %', old.id, sqlerrm;   -- nunca derruba a aprovação
  return old;
end $function$;

revoke all on function public.tg_consulta_aprovada_avisa_dono() from public, anon, authenticated;

drop trigger if exists zz_consulta_aprovada_avisa_dono on public.consultas;
create trigger zz_consulta_aprovada_avisa_dono
  after delete on public.consultas
  for each row execute function public.tg_consulta_aprovada_avisa_dono();

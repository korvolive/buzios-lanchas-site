-- Consultas recusadas (Rodrigo 2026-10-30)
-- Recusar não apaga mais: a consulta vai para "Recusadas" e pode ser resgatada até a data do passeio.
-- 48 h depois da última mensagem nossa no WhatsApp sem resposta do cliente, ela vai sozinha para Recusadas.
-- Passou a data, a recusada é apagada. Resgatar confere se a lancha ainda está livre (sem overbooking).

alter table public.consultas add column if not exists recusada_em timestamptz;
alter table public.consultas add column if not exists recusa_auto boolean not null default false;
alter table public.consultas add column if not exists respondeu_em timestamptz;

-- recusar (administrador)
create or replace function public.recusar_consulta(cid bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.e_admin() then raise exception 'Só o administrador recusa'; end if;
  update public.consultas set recusada_em = now(), recusa_auto = false where id = cid and recusada_em is null;
end $$;
revoke all on function public.recusar_consulta(bigint) from public, anon;
grant execute on function public.recusar_consulta(bigint) to authenticated;

-- o cliente respondeu: o prazo de 48 h recomeça (administrador ou operador)
create or replace function public.consulta_respondeu(cid bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem permissão'; end if;
  update public.consultas set respondeu_em = now() where id = cid and recusada_em is null;
end $$;
revoke all on function public.consulta_respondeu(bigint) from public, anon;
grant execute on function public.consulta_respondeu(bigint) to authenticated;

-- resgatar (administrador): só se a lancha ainda está livre naquele horário
create or replace function public.resgatar_consulta(cid bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.consultas%rowtype; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.e_admin() then raise exception 'Só o administrador resgata'; end if;
  select * into c from public.consultas where id = cid for update;
  if c.id is null then raise exception 'Consulta não encontrada'; end if;
  if c.data < hoje then raise exception 'A data já passou'; end if;
  if exists (select 1 from public.bloqueios x where x.lancha = c.lancha and x.data = c.data and public.choca_horario(x.horario, c.horario)) then
    raise exception 'A lancha não está mais livre nesse dia e horário'; end if;
  if exists (select 1 from public.manutencoes m where m.lancha = c.lancha and m.de <= c.data and c.data <= m.ate) then
    raise exception 'A lancha está em manutenção nesse dia'; end if;
  update public.consultas set recusada_em = null, recusa_auto = false, respondeu_em = now() where id = cid;
end $$;
revoke all on function public.resgatar_consulta(bigint) from public, anon;
grant execute on function public.resgatar_consulta(bigint) to authenticated;

-- automático: 48 h sem resposta depois da nossa mensagem -> Recusadas; recusada com a data passada -> apagada
create or replace function public.consultas_limpeza()
returns void language plpgsql security definer set search_path to 'public' as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update public.consultas set recusada_em = now(), recusa_auto = true
   where recusada_em is null and data >= hoje and wa_resposta_em is not null
     and greatest(wa_resposta_em, coalesce(respondeu_em, wa_resposta_em)) < now() - interval '48 hours';
  delete from public.consultas where recusada_em is not null and data < hoje;
end $$;
revoke all on function public.consultas_limpeza() from public, anon, authenticated;

select cron.schedule('consultas-recusadas', '*/15 * * * *', 'select public.consultas_limpeza()');

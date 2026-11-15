-- Trocar data/lancha/horário de um passeio conferindo o marinheiro escolhido NA TELA,
-- não o que estava salvo antes. Sem marinheiro na tela = não confere nada (2026-11-15).
-- O app chama esta versão; a mover_passeio antiga continua igual para quem ainda não atualizou.
create or replace function public.mover_passeio_v2(bid bigint, nova_lancha text, nova_data date, novo_horario text, marinheiro_tela uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare b record; a record; outro text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into b from public.bloqueios where id = bid;
  if b is null then raise exception 'Passeio não encontrado'; end if;
  if not (public.pode_editar(b.lancha) and public.pode_editar(nova_lancha)) then raise exception 'Sem permissão'; end if;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if a.origem = 'buzios' and not public.e_admin() then raise exception 'Só a Búzios Lanchas muda esse passeio'; end if;
  if nova_data < hoje then raise exception 'Data no passado'; end if;
  if novo_horario not in ('manha','tarde','dia','noite') then raise exception 'Horário inválido'; end if;
  if exists (select 1 from public.bloqueios x where x.id <> bid and x.lancha = nova_lancha and x.data = nova_data
             and public.choca_horario(x.horario, novo_horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha';
  end if;
  if marinheiro_tela is not null then
    select l.nome into outro from public.anotacoes y join public.bloqueios x on x.id = y.bloqueio_id join public.lanchas l on l.slug = x.lancha
     where y.marinheiro = marinheiro_tela and x.id <> bid and x.data = nova_data and public.choca_horario(x.horario, novo_horario) limit 1;
    if outro is not null then raise exception 'Esse marinheiro já está na % nesse horário', outro; end if;
  end if;
  update public.bloqueios set lancha = nova_lancha, data = nova_data, horario = novo_horario where id = bid;
  update public.pedidos set lancha = nova_lancha, data = nova_data, horario = novo_horario, atualizado_em = now() where bloqueio_id = bid;
end $function$;
grant execute on function public.mover_passeio_v2(bigint, text, date, text, uuid) to authenticated;
revoke execute on function public.mover_passeio_v2(bigint, text, date, text, uuid) from anon, public;

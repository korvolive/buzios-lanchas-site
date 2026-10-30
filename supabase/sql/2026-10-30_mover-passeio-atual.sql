-- Definição de mover_passeio como está no banco em 30/10/2026 (lida com pg_get_functiondef, só leitura).
-- Guardada para conferência; não precisa rodar.
CREATE OR REPLACE FUNCTION public.mover_passeio(bid bigint, nova_lancha text, nova_data date, novo_horario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b record; a record; outro text;
begin
  select * into b from public.bloqueios where id = bid;
  if b is null then raise exception 'Passeio não encontrado'; end if;
  if not (public.pode_editar(b.lancha) and public.pode_editar(nova_lancha)) then raise exception 'Sem permissão'; end if;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if a.origem = 'buzios' and not public.e_admin() then raise exception 'Só a Búzios Lanchas muda esse passeio'; end if;
  if nova_data < current_date then raise exception 'Data no passado'; end if;
  if novo_horario not in ('manha','tarde','dia','noite') then raise exception 'Horário inválido'; end if;
  if exists (select 1 from public.bloqueios x where x.id <> bid and x.lancha = nova_lancha and x.data = nova_data
             and public.choca_horario(x.horario, novo_horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha';
  end if;
  if a.marinheiro is not null then
    select l.nome into outro from public.anotacoes y join public.bloqueios x on x.id = y.bloqueio_id join public.lanchas l on l.slug = x.lancha
     where y.marinheiro = a.marinheiro and x.id <> bid and x.data = nova_data and public.choca_horario(x.horario, novo_horario) limit 1;
    if outro is not null then raise exception 'Esse marinheiro já está na % nesse horário', outro; end if;
  end if;
  update public.bloqueios set lancha = nova_lancha, data = nova_data, horario = novo_horario where id = bid;
  update public.pedidos set lancha = nova_lancha, data = nova_data, horario = novo_horario, atualizado_em = now() where bloqueio_id = bid;
end $function$;

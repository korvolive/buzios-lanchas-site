-- Ajustes de 30/10/2026 (revisão do Grok): pode rodar de novo sem problema.
-- 1) aprovar_alteracao: pedido do site sem vendedor também recebe o valor novo (preco_base).
-- 2) mover_passeio: data de hoje no fuso de São Paulo.

create or replace function public.aprovar_alteracao(aid bigint)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare r public.alteracoes_pedidas%rowtype; b record; a record; nl text; nd date; nh text; mudou boolean; np int; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select * into r from public.alteracoes_pedidas where id = aid for update;
  if r.id is null or r.status <> 'pendente' then raise exception 'Alteração não está mais pendente'; end if;
  select * into b from public.bloqueios where id = r.bloqueio_id;
  if b.id is null then raise exception 'Passeio não encontrado'; end if;
  select * into a from public.anotacoes where bloqueio_id = b.id;
  nl := coalesce(r.nova_lancha, b.lancha); nd := coalesce(r.nova_data, b.data); nh := coalesce(r.novo_horario, b.horario);
  mudou := nl <> b.lancha or nd <> b.data or nh <> b.horario;
  -- os valores podem ter mudado desde o pedido: confere de novo
  if r.novo_valor is not null then perform public._confere_valor(nl, nd, nh, r.novo_valor); end if;
  np := coalesce(r.novas_pessoas, a.pessoas);
  if np is not null and np > public._capacidade(nl) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(nl); end if;
  if nd < hoje then raise exception 'A nova data já passou'; end if;
  if coalesce(r.novo_valor, a.valor, 0) < coalesce(a.sinal, 0) then raise exception 'O valor novo fica abaixo do sinal já pago (R$ %)', a.sinal; end if;
  if r.condicional and r.cond_valor_dia < coalesce(a.sinal, 0) then raise exception 'O valor da diária fica abaixo do sinal já pago'; end if;
  if mudou and (nl <> b.lancha or nd <> b.data) and exists (select 1 from public.manutencoes m where m.lancha = nl and m.de <= nd and nd <= m.ate) then
    raise exception 'A lancha está em manutenção nesse dia'; end if;
  update public.alteracoes_pedidas set antes = jsonb_build_object('lancha', b.lancha, 'data', b.data, 'horario', b.horario, 'pessoas', a.pessoas,
         'valor', a.valor, 'hora_ini', a.hora_ini, 'hora_fim', a.hora_fim) where id = aid;
  -- lancha, data ou horário: mesma checagem de horário ocupado e de marinheiro do mover_passeio
  if mudou then perform public.mover_passeio(b.id, nl, nd, nh); end if;
  update public.anotacoes set
      pessoas = coalesce(r.novas_pessoas, pessoas),
      valor = coalesce(r.novo_valor, valor),
      hora_ini = case when r.hora_ini is not null then r.hora_ini when nh <> b.horario then null else hora_ini end,
      hora_fim = case when r.hora_fim is not null then r.hora_fim when nh <> b.horario then null else hora_fim end,
      atualizado_em = now()
   where bloqueio_id = b.id;
  update public.pedidos set
      pessoas = coalesce(r.novas_pessoas, pessoas),
      hora_ini = case when r.hora_ini is not null then r.hora_ini when nh <> b.horario then null else hora_ini end,
      hora_fim = case when r.hora_fim is not null then r.hora_fim when nh <> b.horario then null else hora_fim end,
      -- valor novo na reserva do cliente; com vendedor a comissão dele (preco_cliente - preco_base) fica igual,
      -- sem vendedor (preco_cliente vazio) o valor novo vai para preco_base
      preco_base = case when r.novo_valor is null then preco_base
                        when preco_cliente is null then r.novo_valor
                        when preco_base is not null then preco_base + (r.novo_valor - preco_cliente) else preco_base end,
      preco_cliente = case when r.novo_valor is not null and preco_cliente is not null then r.novo_valor else preco_cliente end,
      atualizado_em = now()
   where bloqueio_id = b.id;
  -- diária virou manhã/tarde com condicional: volta para a diária sozinha se a outra metade não vender
  if r.condicional then perform public.definir_condicional(b.id, r.cond_valor_dia); end if;
  update public.alteracoes_pedidas set status = 'aprovada', resolvido_em = now() where id = aid;
  return b.id;
end $$;
revoke all on function public.aprovar_alteracao(bigint) from public, anon;
grant execute on function public.aprovar_alteracao(bigint) to authenticated;

CREATE OR REPLACE FUNCTION public.mover_passeio(bid bigint, nova_lancha text, nova_data date, novo_horario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if a.marinheiro is not null then
    select l.nome into outro from public.anotacoes y join public.bloqueios x on x.id = y.bloqueio_id join public.lanchas l on l.slug = x.lancha
     where y.marinheiro = a.marinheiro and x.id <> bid and x.data = nova_data and public.choca_horario(x.horario, novo_horario) limit 1;
    if outro is not null then raise exception 'Esse marinheiro já está na % nesse horário', outro; end if;
  end if;
  update public.bloqueios set lancha = nova_lancha, data = nova_data, horario = novo_horario where id = bid;
  update public.pedidos set lancha = nova_lancha, data = nova_data, horario = novo_horario, atualizado_em = now() where bloqueio_id = bid;
end $function$;

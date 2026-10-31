-- Revisão de segurança de 31/10/2026 (itens 1, 3 e 5 do relatório 05-Site/seguranca/2026-10-31_revisao-de-seguranca.md)

-- 1. O dono não grava mais, direto pelo app, a meia diária condicional, o comprovante e o sinal combinado de um passeio vendido pela Búzios.
--    Sem security definer: as funções do administrador, do operador e o robô continuam funcionando.
create or replace function public.trava_campos_buzios() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user not in ('authenticated','anon') or public.e_admin() then return new; end if;
  if old.origem = 'buzios' then
    new.cond_ate := old.cond_ate; new.cond_horario := old.cond_horario; new.cond_valor := old.cond_valor;
    new.cond_resultado := old.cond_resultado; new.cond_em := old.cond_em;
    new.comprovante := old.comprovante; new.comprovante_em := old.comprovante_em; new.comprovante_por := old.comprovante_por;
    new.sinal_combinado := old.sinal_combinado;
  end if;
  return new;
end $$;
drop trigger if exists trava_campos_buzios on public.anotacoes;
create trigger trava_campos_buzios before update on public.anotacoes for each row execute function public.trava_campos_buzios();

-- 3. Cancelar pré-reserva: não mexe em passeio de data passada nem em passeio já aprovado.
create or replace function public.cancelar_pre_reserva(bid bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; em text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem permissão'; end if;
  select * into b from public.bloqueios where id = bid for update;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if b.id is null or a.bloqueio_id is null then raise exception 'Passeio não encontrado'; end if;
  if a.origem is distinct from 'buzios' or not (a.valor > 0) or coalesce(a.sinal, 0) <> 0 then raise exception 'Só dá para cancelar aqui uma pré-reserva sem sinal'; end if;
  if b.data < hoje then raise exception 'A data deste passeio já passou'; end if;
  if exists (select 1 from public.pedidos where bloqueio_id = bid and status = 'aprovado') then raise exception 'Este passeio já foi aprovado: fale com o Rodrigo'; end if;
  if a.comprovante is not null then raise exception 'Este passeio já tem comprovante: fale com o Rodrigo'; end if;
  -- cliente com conta (Rodrigo 2026-10-31): o Lucas também cancela, a não ser que o cliente já tenha pago ou mandado comprovante
  if exists (select 1 from public.pedidos p where p.bloqueio_id = bid and p.status = 'pendente' and (p.comprovante_em is not null
       or exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))
       or exists (select 1 from public.pagamentos_asaas x where x.pedido = p.id)
       or exists (select 1 from public.mensagens m join public.conversas c on c.id = m.conversa
                   where c.tipo = 'suporte' and c.cliente = p.cliente and m.autor = p.cliente and m.anexo is not null
                     and m.apagada_em is null and m.criado_em >= coalesce(p.sinal_liberado_em, p.criado_em)))) then
    raise exception 'O cliente já pagou ou mandou comprovante: fale com o Rodrigo'; end if;
  update public.pedidos set status = 'cancelado', motivo = 'cliente', bloqueio_id = null, atualizado_em = now()
   where bloqueio_id = bid and status = 'pendente';
  select nullif(btrim(email), '') into em from public.convites where bloqueio_id = bid;
  begin
    insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang,
                                  valor, sinal, hora_ini, hora_fim, obs, recusada_em)
      values (true, now(), b.criado_por, b.lancha, b.data, b.horario, a.pessoas, a.embarque,
              coalesce(nullif(btrim(a.cliente), ''), 'Cliente'), coalesce(a.telefone, ''), lower(coalesce(em, '')), 'pt',
              a.valor, nullif(a.sinal_combinado, 0), a.hora_ini, a.hora_fim,
              concat_ws(' · ', '🚫 Cliente desistiu em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24"h"MI'), nullif(btrim(a.obs), '')),
              case when b.data >= hoje then now() end);
  exception when others then null; -- a cópia nunca impede o cancelamento
  end;
  delete from public.bloqueios where id = bid;
end $$;
revoke all on function public.cancelar_pre_reserva(bigint) from public, anon;
grant execute on function public.cancelar_pre_reserva(bigint) to authenticated;

-- 5. O operador só atualiza a consulta que ele mesmo lançou (não a do administrador), e nunca uma recusada.
create or replace function public.lancar_pedido_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer,
  p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null,
  p_valor numeric default null, p_sinal numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare nid bigint; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'Escreva nome e sobrenome do cliente'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'WhatsApp do cliente inválido'; end if;
  if coalesce(p_email,'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'E-mail do cliente inválido'; end if;
  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario,''), p_data) then raise exception 'Horário inválido'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > public._capacidade(p_lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(p_lancha); end if;
  if length(coalesce(p_embarque,'')) > 120 or length(coalesce(p_obs,'')) > 300 then raise exception 'Texto longo demais'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim > p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  v := public._confere_valor_op(p_lancha, p_data, p_horario, p_valor);
  if p_sinal is not null and (p_sinal < 0 or (v is not null and p_sinal > v) or (p_sinal > 0 and v is not null and p_sinal < ceil(v * 0.1))) then
    raise exception 'Sinal inválido: zero (pré-reserva) ou de 10%% até o valor'; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 60 then raise exception 'Limite de pedidos do dia'; end if;
  -- mesmo cliente, lancha e dia: só atualiza a consulta que o próprio operador lançou; a do site fica como está
  update public.consultas set horario = p_horario, pessoas = p_pessoas, embarque = nullif(trim(coalesce(p_embarque,'')),''), nome = trim(p_nome),
         email = lower(trim(p_email)), chamou = true, wa_resposta_em = coalesce(wa_resposta_em, now()),
         valor = v, sinal = p_sinal, hora_ini = p_hora_ini, hora_fim = p_hora_fim, obs = nullif(trim(coalesce(p_obs,'')),'')
   where criado_por is not null and (criado_por = auth.uid() or public.e_admin()) and recusada_em is null and regexp_replace(telefone,'\D','','g') = dig and lancha = p_lancha and data = p_data returning id into nid;
  if nid is not null then return nid; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang, valor, sinal, hora_ini, hora_fim, obs)
    values (true, now(), auth.uid(), p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            lower(trim(p_email)), case when p_lang in ('pt','en','es') then p_lang else 'pt' end, v, p_sinal, p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''))
    returning id into nid;
  return nid;
end $$;

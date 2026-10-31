-- Comprovante só vale na reserva ou no WhatsApp (Rodrigo 2026-10-31)
-- O anexo mandado pelo 📎 do chat não segura mais a pré-reserva nem impede o Lucas de cancelar.
-- O cliente envia o comprovante no botão "Enviar comprovante do Pix" da reserva (Meus passeios),
-- ou pelo WhatsApp, e o Rodrigo lança o sinal.

create or replace function public.vencer_pre_pedidos() returns table(id bigint, cliente uuid, lancha text, data date, horario text)
 language plpgsql security definer set search_path to 'public' as $function$
declare r record; cid bigint;
begin
  for r in select p.id, p.cliente, p.lancha, p.data, p.horario from public.pedidos p
             join public.bloqueios b on b.id = p.bloqueio_id join public.anotacoes a on a.bloqueio_id = b.id
            where p.status = 'pendente' and a.valor > 0 and coalesce(a.sinal, 0) = 0
              and b.criado_em < now() - public._prazo_pre(b.data) and p.comprovante_em is null
              and not exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))
              and not exists (select 1 from public.pagamentos_asaas x where x.pedido = p.id)
            for update of p loop
    update public.pedidos set status = 'cancelado', motivo = 'sinal', bloqueio_id = null, atualizado_em = now() where pedidos.id = r.id;
    select c.id into cid from public.conversas c where c.tipo = 'suporte' and c.cliente = r.cliente;
    if cid is not null then
      insert into public.mensagens(conversa, autor, texto, sistema, pedido)
        values (cid, null, 'O prazo para pagar o sinal acabou e a data foi liberada. Se ainda quiser o passeio, fale com a gente aqui no chat.', 'venceu:0', r.id);
      update public.conversas set ultima_em = now(), ultima_msg = 'O prazo para pagar o sinal acabou e a data foi liberada.', encerrada_em = null where conversas.id = cid;
    end if;
    id := r.id; cliente := r.cliente; lancha := r.lancha; data := r.data; horario := r.horario; return next;
  end loop;
end $function$;
revoke all on function public.vencer_pre_pedidos() from public, anon, authenticated;
grant execute on function public.vencer_pre_pedidos() to service_role;

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
       or exists (select 1 from public.pagamentos_asaas x where x.pedido = p.id))) then
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


select (select position('anexo' in prosrc) = 0 from pg_proc where proname = 'vencer_pre_pedidos') as prazo_sem_chat,
       (select position('anexo' in prosrc) = 0 from pg_proc where proname = 'cancelar_pre_reserva') as cancelar_sem_chat;

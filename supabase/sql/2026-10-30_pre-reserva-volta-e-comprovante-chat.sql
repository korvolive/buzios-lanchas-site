-- Pré-reserva: comprovante pelo chat segura a data, e a pré-reserva vencida volta para Consultas (Rodrigo 2026-10-30)
-- 1. O cliente que anexa o comprovante pelo 📎 do chat não perde mais a data por prazo.
-- 2. Quando o prazo vence, a pré-reserva volta para a aba Consultas com os mesmos dados (cliente, valor, sinal combinado, horário).
--    Para recuperar é só tocar em Aprovar de novo: se a lancha ainda estiver livre, começa um prazo novo (ou já confirma, se o Pix chegou).
-- 3. O operador (Lucas) pode gerar o link de cadastro da pré-reserva da Búzios e mandar ele mesmo pelo WhatsApp;
--    o toque no botão marca o convite e o aviso automático do número oficial não sai.

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
              -- comprovante mandado pelo 📎 do chat também segura a data (Rodrigo 2026-10-30)
              and not exists (select 1 from public.mensagens m join public.conversas c on c.id = m.conversa
                               where c.tipo = 'suporte' and c.cliente = p.cliente and m.autor = p.cliente
                                 and m.anexo is not null and m.apagada_em is null
                                 and m.criado_em >= coalesce(p.sinal_liberado_em, p.criado_em))
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

create or replace function public._pre_reserva_volta() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare a record; p record; em text; ob text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- só a limpeza automática do prazo (servidor, sem usuário); apagar na agenda continua apagando de vez
  if auth.uid() is not null or old.data < hoje then return old; end if;
  select * into a from public.anotacoes where bloqueio_id = old.id;
  if a.bloqueio_id is null or not (a.valor > 0) or coalesce(a.sinal, 0) <> 0 then return old; end if;
  select * into p from public.pedidos where bloqueio_id = old.id or (a.cliente_conta is not null and cliente = a.cliente_conta and lancha = old.lancha
         and data = old.data and status = 'cancelado' and motivo = 'sinal') order by id desc limit 1;
  select nullif(btrim(email), '') into em from public.convites where bloqueio_id = old.id;
  if em is null and a.cliente_conta is not null then select email into em from auth.users where id = a.cliente_conta; end if;
  ob := nullif(btrim(regexp_replace(regexp_replace(coalesce(a.obs, ''), 'Sinal combinado R\$ [0-9.,]+, ainda não recebido', ''), '( · ){2,}', ' · ', 'g'), ' ·'), '');
  ob := concat_ws(' · ', '⏳ Pré-reserva vencida em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24"h"MI'), ob);
  begin
    insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang,
                                  valor, sinal, hora_ini, hora_fim, obs, comissao_pct)
      values (true, now(), old.criado_por, old.lancha, old.data, old.horario, a.pessoas, a.embarque,
              coalesce(nullif(btrim(a.cliente), ''), 'Cliente'), coalesce(nullif(btrim(a.telefone), ''), (select whatsapp from public.clientes where user_id = a.cliente_conta), ''),
              lower(coalesce(em, '')), 'pt', a.valor,
              coalesce(nullif(a.sinal_combinado, 0), nullif(p.sinal_valor, 0)), a.hora_ini, a.hora_fim, ob,
              case when p.comissao_pct between 0 and 10 then p.comissao_pct end);
  exception when others then null; -- nunca impede a limpeza do prazo
  end;
  return old;
end $$;
revoke all on function public._pre_reserva_volta() from public, anon, authenticated;
drop trigger if exists pre_reserva_volta on public.bloqueios;
create trigger pre_reserva_volta before delete on public.bloqueios for each row execute function public._pre_reserva_volta();

create or replace function public.codigo_convite(bid bigint)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare l text; n record; c uuid;
begin
  select lancha into l from public.bloqueios where id = bid;
  select * into n from public.anotacoes where bloqueio_id = bid;
  if l is null or not (public.e_admin() or public.pode_editar(l)
     or (public.papel_painel() = 'operador' and n.origem = 'buzios')) then return null; end if;
  if n.cliente_conta is not null then return null; end if;
  select codigo into c from public.convites where bloqueio_id = bid;
  if c is null then
    insert into public.convites (nome, telefone, tel_dig, bloqueio_id) values (nullif(btrim(n.cliente), ''), nullif(btrim(n.telefone), ''), public._dig(n.telefone), bid)
      on conflict (bloqueio_id) do nothing;
    select codigo into c from public.convites where bloqueio_id = bid;
  end if;
  update public.convites set resgatado_em = null where bloqueio_id = bid and resgatado_em is not null;
  return c;
end $function$;

select (select count(*) from pg_trigger where tgname = 'pre_reserva_volta') as volta,
       (select position('anexo' in prosrc) > 0 from pg_proc where proname = 'vencer_pre_pedidos') as chat,
       (select position('operador' in prosrc) > 0 from pg_proc where proname = 'codigo_convite') as operador;

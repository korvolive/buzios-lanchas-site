-- Prazo da pré-reserva sem sinal conforme a distância até o passeio (Rodrigo 2026-10-30), contado da aprovação:
-- 7 dias ou mais: 12 horas · de 2 a 6 dias: 6 horas · véspera: 2 horas · mesmo dia: 1 hora. Igual ao app (holdHrs) e ao notificar (vencerPre).
-- O cliente vê o prazo na mensagem do Pix e em Meus passeios; quando vence, recebe mensagem no chat (e o notificar manda celular e e-mail).
create or replace function public._prazo_pre(d date) returns interval language sql stable set search_path to 'public' as $$
  select case when d - (now() at time zone 'America/Sao_Paulo')::date >= 7 then interval '12 hours'
              when d - (now() at time zone 'America/Sao_Paulo')::date >= 2 then interval '6 hours'
              when d - (now() at time zone 'America/Sao_Paulo')::date = 1 then interval '2 hours'
              else interval '1 hour' end
$$;

alter table public.pedidos add column if not exists pagar_ate timestamptz;

create or replace function public._ligar_passeio(bid bigint, uid uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare b record; n record; nm text; adm boolean := public.e_admin(); pb numeric; sv numeric; pid bigint; cid bigint; tx text; ate timestamptz;
begin
  select * into b from public.bloqueios where id = bid;
  select * into n from public.anotacoes where bloqueio_id = bid;
  select preco_base into pb from public.passeio_preco_base where bloqueio_id = bid;
  if not adm and n.cliente_conta is not null and n.cliente_conta <> uid then return; end if;
  select nullif(btrim(nome), '') into nm from public.clientes where user_id = uid;
  insert into public.anotacoes (bloqueio_id, cliente_conta, cliente) values (bid, uid, nm)
    on conflict (bloqueio_id) do update set cliente_conta = uid, cliente = coalesce(nm, anotacoes.cliente);
  if not exists (select 1 from public.pedidos where bloqueio_id = bid) then
    if n.origem = 'buzios' and n.valor > 0 and n.sinal is not null and n.sinal = 0 then
      -- pré-reserva da Búzios Lanchas: pedido pendente com o sinal já liberado, pago pela central (Rodrigo 2026-10-30)
      sv := coalesce(nullif(n.sinal_combinado, 0), round(n.valor / 2));
      ate := b.criado_em + public._prazo_pre(b.data); -- prazo para pagar o sinal (Rodrigo 2026-10-30)
      begin
        insert into public.pedidos (cliente, lancha, data, horario, pessoas, embarque, status, bloqueio_id, preco_base, preco_cliente,
                                    hora_ini, hora_fim, sinal_valor, sinal_liberado_em, pagar_ate)
          values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), n.embarque, 'pendente', bid,
                  coalesce(pb, n.valor), case when pb > 0 then n.valor end, n.hora_ini, n.hora_fim, sv, now(), ate)
          returning id into pid;
      exception when others then pid := null; -- pedido repetido, muitos pendentes ou em cima da hora: fica só o passeio ligado
      end;
      if pid is not null then
        insert into conversas(tipo, cliente) values ('suporte', uid) on conflict (cliente) where tipo = 'suporte' do nothing;
        select id into cid from conversas where tipo = 'suporte' and cliente = uid;
        tx := format('Boa notícia: a lancha está disponível! Para confirmar a sua reserva, pague o sinal de R$ %s pelo Pix (CNPJ 32.154.099/0001-72, Búzios Lanchas) e anexe o comprovante aqui no chat, no botão 📎. A data fica guardada para você até %s; depois disso ela volta a ficar livre.', translate(to_char(sv, 'FM999,999,990.00'), ',.', '.,'), to_char(ate at time zone 'America/Sao_Paulo', 'HH24"h"MI "de" DD/MM'));
        insert into mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || sv::text || ':' || (extract(epoch from ate) * 1000)::bigint, pid);
        update conversas set ultima_em = now(), ultima_msg = left(tx, 80), anexo_liberado = true, encerrada_em = null where id = cid;
      end if;
    else
      insert into public.pedidos (cliente, lancha, data, horario, pessoas, status, bloqueio_id, preco_base, preco_cliente)
        values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), 'aprovado', bid,
                pb, case when pb > 0 and n.valor > 0 then n.valor end);
    end if;
  else
    update public.pedidos set cliente = uid where bloqueio_id = bid and (adm or cliente is null or cliente = uid);
  end if;
end $function$;

-- Pedido da pré-reserva que passou do prazo sem sinal: cancela, solta a pré-reserva (o notificar apaga e avisa o Rodrigo) e escreve no chat do cliente.
-- Chamado pelo notificar, que também avisa o cliente no celular e por e-mail.
drop function if exists public.vencer_pre_pedidos();
create function public.vencer_pre_pedidos() returns table(id bigint, cliente uuid, lancha text, data date, horario text)
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
-- agora quem roda é o notificar (de 15 em 15 minutos), junto com o aviso de pré-reserva vencida
select cron.unschedule('pre-pedido-vence') where exists (select 1 from cron.job where jobname = 'pre-pedido-vence');

select public._prazo_pre((now() at time zone 'America/Sao_Paulo')::date + 10) as prazo_10_dias,
       public._prazo_pre((now() at time zone 'America/Sao_Paulo')::date + 3) as prazo_3_dias,
       (select count(*) from cron.job where jobname = 'pre-pedido-vence') as agenda_antiga;

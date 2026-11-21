-- publicar: auto
-- Nome do cliente na reserva (Rodrigo 2026-11-21): "tem que colocar sempre o nome que o cliente informar no WhatsApp".
-- Ao ligar a reserva à conta do cliente, o nome já escrito na reserva (Lucas/equipe) NÃO é mais trocado pelo nome da conta.
-- Idempotente (create or replace). Resto do _ligar_passeio igual a 2026-11-21_nome-do-cliente-nao-usa-apelido-do-google.sql.

create or replace function public._ligar_passeio(bid bigint, uid uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare b record; n record; nm text; adm boolean := public.e_admin(); pb numeric; sv numeric; tg numeric; pid bigint; cid bigint; tx text; ate timestamptz;
        princ bigint; nl int; m record; bc timestamptz; cup bigint;
begin
  select * into b from public.bloqueios where id = bid;
  select * into n from public.anotacoes where bloqueio_id = bid;
  select preco_base into pb from public.passeio_preco_base where bloqueio_id = bid;
  if not adm and n.cliente_conta is not null and n.cliente_conta <> uid then return; end if;
  select nullif(btrim(nome), '') into nm from public.clientes where user_id = uid;
  -- a reserva fica sempre com o nome que o cliente passou no WhatsApp (escrito pelo Lucas ou pela equipe); o nome da conta só
  -- entra quando a reserva está sem nome. Conta com nome que não é de pessoa (ex.: "Acesso E-mail") passa a usar o da reserva
  if public._nome_suspeito(nm) and not public._nome_suspeito(n.cliente) then
    update public.clientes set nome = btrim(n.cliente) where user_id = uid;
    nm := btrim(n.cliente);
  end if;
  insert into public.anotacoes (bloqueio_id, cliente_conta, cliente) values (bid, uid, nm)
    on conflict (bloqueio_id) do update set cliente_conta = uid, cliente = coalesce(nullif(btrim(anotacoes.cliente), ''), nm);
  if n.grupo is not null then
    select min(a.bloqueio_id), count(*) into princ, nl from public.anotacoes a where a.grupo = n.grupo;
  end if;
  if not exists (select 1 from public.pedidos where bloqueio_id = bid) then
    if n.origem = 'buzios' and n.valor > 0 and coalesce(n.sinal, 0) = 0 then
      -- o grupo inteiro vence junto, no prazo da reserva principal
      bc := null;
      if n.grupo is not null then select x.criado_em into bc from public.bloqueios x where x.id = princ; end if;
      ate := public._prazo_pre_fim(coalesce(bc, b.criado_em), b.data);
      sv := coalesce(nullif(n.sinal_combinado, 0), round(n.valor / 2));
      begin
        cup := public._melhor_cupom(uid, b.lancha);
      exception when others then cup := null;
      end;
      begin
        insert into public.pedidos (cliente, lancha, data, horario, pessoas, embarque, status, bloqueio_id, preco_base, preco_cliente,
                                    hora_ini, hora_fim, sinal_valor, sinal_liberado_em, pagar_ate, cupom)
          values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), n.embarque, 'pendente', bid,
                  coalesce(pb, n.valor), case when pb > 0 then n.valor end, n.hora_ini, n.hora_fim, sv, now(), ate, cup)
          returning id into pid;
      exception when others then
        begin
          insert into public.pedidos (cliente, lancha, data, horario, pessoas, embarque, status, bloqueio_id, preco_base, preco_cliente,
                                      hora_ini, hora_fim, sinal_valor, sinal_liberado_em, pagar_ate)
            values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), n.embarque, 'pendente', bid,
                    coalesce(pb, n.valor), case when pb > 0 then n.valor end, n.hora_ini, n.hora_fim, sv, now(), ate)
            returning id into pid;
        exception when others then pid := null;
        end;
      end;
      -- a mensagem do chat sai uma vez só, na reserva principal, com o sinal de todas as lanchas
      if pid is not null and (n.grupo is null or bid = princ) then
        if n.grupo is not null then
          select sum(coalesce(nullif(a.sinal_combinado, 0), round(a.valor / 2))) into tg from public.anotacoes a
           where a.grupo = n.grupo and a.valor > 0 and coalesce(a.sinal, 0) = 0;
        end if;
        insert into conversas(tipo, cliente) values ('suporte', uid) on conflict (cliente) where tipo = 'suporte' do nothing;
        select id into cid from conversas where tipo = 'suporte' and cliente = uid;
        tx := format('Boa notícia: %s Para confirmar a sua reserva, pague o sinal de R$ %s pelo Pix (CNPJ 32.154.099/0001-72, Búzios Lanchas) e anexe o comprovante aqui no chat, no botão de anexo. A data fica guardada para você até %s; depois disso ela volta a ficar livre.',
                     case when n.grupo is not null then 'as ' || nl || ' lanchas do seu grupo estão disponíveis! O sinal abaixo vale para todas.' else 'a lancha está disponível!' end,
                     translate(to_char(coalesce(tg, sv), 'FM999,999,990.00'), ',.', '.,'), to_char(ate at time zone 'America/Sao_Paulo', 'HH24"h"MI "de" DD/MM'));
        insert into mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || coalesce(tg, sv)::text || ':' || (extract(epoch from ate) * 1000)::bigint, pid);
        update conversas set ultima_em = now(), ultima_msg = left(tx, 80), anexo_liberado = true, encerrada_em = null where id = cid;
      end if;
      -- com cupom: o valor do passeio na agenda passa a ser o que o cliente paga (como no confirmar_pago), para o dono
      -- cobrar no embarque o valor certo, e a parte do dono no sinal é recalculada com esse valor
      if pid is not null and cup is not null then
        begin
          select coalesce(cupom_valor, 0) into tg from public.pedidos where id = pid;
          if tg > 0 then
            perform set_config('app.auto_op', '1', true);
            update public.anotacoes set valor = valor - tg where bloqueio_id = bid and valor > tg;
            update public.pedidos set repasse_dono = null where id = pid;
            perform set_config('app.auto_op', '', true);
          end if;
        exception when others then null;
        end;
        tg := null;
      end if;
    else
      insert into public.pedidos (cliente, lancha, data, horario, pessoas, status, bloqueio_id, preco_base, preco_cliente)
        values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), 'aprovado', bid,
                pb, case when pb > 0 and n.valor > 0 then n.valor end);
    end if;
  else
    update public.pedidos set cliente = uid where bloqueio_id = bid and (adm or cliente is null or cliente = uid);
  end if;
  -- as outras lanchas do grupo entram na mesma conta
  if n.grupo is not null then
    for m in select a.bloqueio_id from public.anotacoes a where a.grupo = n.grupo and a.bloqueio_id <> bid and a.cliente_conta is null and a.origem = 'buzios' and n.origem = 'buzios' order by a.bloqueio_id loop
      perform public._ligar_passeio(m.bloqueio_id, uid);
      update public.convites set resgatado_em = now() where bloqueio_id = m.bloqueio_id and resgatado_em is null;
    end loop;
  end if;
end $function$;


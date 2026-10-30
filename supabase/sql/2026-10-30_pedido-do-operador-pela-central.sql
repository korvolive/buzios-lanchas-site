-- Pedido do operador (Lucas) pago pela central de pagamento (Rodrigo 2026-10-30)
-- 1. O Lucas lança o pedido; o Rodrigo aprova. Sem o Pix ainda: vira pré-reserva (a data fica presa 24 horas) e o sinal combinado fica guardado.
-- 2. O cliente recebe o aviso do WhatsApp oficial (passeio registrado) e cria a conta pelo link. Quem já tem conta entra direto.
-- 3. Ao ligar a pré-reserva à conta, nasce um pedido pendente com o sinal já liberado: o Pix aparece no chat e em Meus passeios,
--    e o Rodrigo recebe o aviso de pedido novo (e pode mandar a central pelo WhatsApp).
-- 4. Rodrigo toca Aprovar depois do comprovante: o sinal entra no passeio e o pedido fica aprovado (o dono é avisado como sempre).
-- 5. Sem sinal em 24 horas (contadas da aprovação), o pedido é cancelado e a pré-reserva vence como hoje (aviso "venceu").
-- 6. Pedido recusado ou cliente desistiu: a pré-reserva é apagada e a data volta livre.

alter table public.anotacoes add column if not exists sinal_combinado numeric;

create or replace function public.aprovar_consulta(cid bigint, p_recebido boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare c public.consultas%rowtype; bid bigint; v numeric; s numeric; sc numeric; res text; pid bigint; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select * into c from public.consultas where id = cid for update;
  if c.id is null then raise exception 'Consulta não encontrada'; end if;
  if c.data < hoje then raise exception 'A data já passou'; end if;
  if not public._horario_ok(c.horario, c.data) then raise exception 'Horário inválido'; end if;
  v := coalesce(c.valor, public.preco_tabela(c.lancha, c.data, c.horario));
  if not (v > 0) then raise exception 'Sem valor combinado nem preço de tabela: use o Aprovar normal e preencha o valor'; end if;
  s := coalesce(c.sinal, 0);
  if s < 0 or s > v then raise exception 'Sinal inválido'; end if;
  if c.pessoas is not null and c.pessoas > public._capacidade(c.lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(c.lancha); end if;
  if s > 0 and not coalesce(p_recebido, false) then
    c.obs := concat_ws(' · ', nullif(c.obs, ''), 'Sinal combinado R$ ' || s || ', ainda não recebido');
    sc := s; -- vai para a central de pagamento quando o cliente tiver conta
    s := 0;
  end if;
  if exists (select 1 from public.bloqueios x where x.lancha = c.lancha and x.data = c.data and public.choca_horario(x.horario, c.horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha'; end if;
  if exists (select 1 from public.manutencoes m where m.lancha = c.lancha and m.de <= c.data and c.data <= m.ate) then
    raise exception 'A lancha está em manutenção nesse dia'; end if;
  insert into public.bloqueios (lancha, data, horario, criado_por) values (c.lancha, c.data, c.horario, auth.uid()) returning id into bid;
  insert into public.anotacoes (bloqueio_id, origem, cliente, telefone, pessoas, valor, sinal, sinal_combinado, embarque, hora_ini, hora_fim, obs)
    values (bid, 'buzios', c.nome, c.telefone, c.pessoas, v, s, sc, c.embarque, c.hora_ini, c.hora_fim, c.obs);
  -- convite do cliente: quem já tem conta recebe o passeio na hora (pré-reserva: com o pagamento liberado na central)
  res := public.convidar_cliente(bid, c.email, c.nome, c.telefone);
  select id into pid from public.pedidos where bloqueio_id = bid;
  delete from public.consultas where id = cid;
  return jsonb_build_object('bid', bid, 'convite', res, 'pendente', s = 0, 'email', c.email, 'valor', v, 'sinal', s, 'pedido', pid);
end $function$;

create or replace function public._ligar_passeio(bid bigint, uid uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare b record; n record; nm text; adm boolean := public.e_admin(); pb numeric; sv numeric; pid bigint; cid bigint; tx text;
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
      begin
        insert into public.pedidos (cliente, lancha, data, horario, pessoas, embarque, status, bloqueio_id, preco_base, preco_cliente,
                                    hora_ini, hora_fim, sinal_valor, sinal_liberado_em)
          values (uid, b.lancha, b.data, b.horario, greatest(1, least(99, coalesce(n.pessoas, 1))), n.embarque, 'pendente', bid,
                  coalesce(pb, n.valor), case when pb > 0 then n.valor end, n.hora_ini, n.hora_fim, sv, now())
          returning id into pid;
      exception when others then pid := null; -- pedido repetido, muitos pendentes ou em cima da hora: fica só o passeio ligado
      end;
      if pid is not null then
        insert into conversas(tipo, cliente) values ('suporte', uid) on conflict (cliente) where tipo = 'suporte' do nothing;
        select id into cid from conversas where tipo = 'suporte' and cliente = uid;
        tx := format('Boa notícia: a lancha está disponível! Para confirmar a sua reserva, pague o sinal de R$ %s pelo Pix (CNPJ 32.154.099/0001-72, Búzios Lanchas) e anexe o comprovante aqui no chat, no botão 📎.', translate(to_char(sv, 'FM999,999,990.00'), ',.', '.,'));
        insert into mensagens(conversa, autor, texto, sistema, pedido) values (cid, null, tx, 'sinal:' || sv::text, pid);
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

-- Aprovar o pedido da pré-reserva (depois do comprovante): o sinal entra no passeio
create or replace function public.aprovar_pre_pedido(pid bigint)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare p public.pedidos%rowtype; v numeric;
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  select * into p from public.pedidos where id = pid for update;
  if p.id is null or p.status <> 'pendente' or p.bloqueio_id is null then raise exception 'Pedido não está pendente'; end if;
  v := round(coalesce(p.sinal_valor, 0), 2);
  if not (v > 0) then raise exception 'Informe o sinal recebido'; end if;
  update public.anotacoes set sinal = v, sinal_combinado = null,
         obs = nullif(btrim(regexp_replace(coalesce(obs, ''), '( · )?Sinal combinado R\$ [0-9.,]+, ainda não recebido', '')), '')
   where bloqueio_id = p.bloqueio_id;
  update public.pedidos set status = 'aprovado', atualizado_em = now() where id = pid and status = 'pendente';
  return p.bloqueio_id;
end $function$;
revoke all on function public.aprovar_pre_pedido(bigint) from public, anon;
grant execute on function public.aprovar_pre_pedido(bigint) to authenticated;

-- Sinal lançado direto no passeio (formulário da agenda): o pedido ligado também fica aprovado
create or replace function public._pre_pedido_sinal() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(old.sinal, 0) = 0 and coalesce(new.sinal, 0) > 0 then
    update public.pedidos set status = 'aprovado', atualizado_em = now() where bloqueio_id = new.bloqueio_id and status = 'pendente';
  end if;
  return new;
end $$;
revoke all on function public._pre_pedido_sinal() from public, anon, authenticated;
drop trigger if exists pre_pedido_sinal on public.anotacoes;
create trigger pre_pedido_sinal after update of sinal on public.anotacoes for each row execute function public._pre_pedido_sinal();

-- Pedido da pré-reserva recusado ou cliente desistiu: apaga a pré-reserva e a data volta livre
create or replace function public._pre_pedido_fim() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.status = 'pendente' and new.status in ('recusado', 'cancelado') and new.bloqueio_id is not null
     and exists (select 1 from public.anotacoes a where a.bloqueio_id = new.bloqueio_id and a.valor > 0 and coalesce(a.sinal, 0) = 0) then
    delete from public.bloqueios where id = new.bloqueio_id;
  end if;
  return new;
end $$;
revoke all on function public._pre_pedido_fim() from public, anon, authenticated;
drop trigger if exists pre_pedido_fim on public.pedidos;
create trigger pre_pedido_fim after update of status on public.pedidos for each row execute function public._pre_pedido_fim();

-- Pré-reserva apagada na agenda: o pedido pendente ligado também é cancelado (antes ficava pendente sem passeio)
create or replace function public.cancela_pedido_do_passeio() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.pedidos set status = 'cancelado', atualizado_em = now(),
         bloqueio_id = case when status = 'pendente' then null else bloqueio_id end
   where bloqueio_id = old.id and status in ('aprovado', 'pendente');
  return old;
end $$;

-- 24 horas sem sinal: cancela o pedido e solta a pré-reserva para o aviso "venceu" de sempre (que apaga e avisa o Rodrigo)
create or replace function public.vencer_pre_pedidos() returns integer language sql security definer set search_path to 'public' as $$
  with v as (
    update public.pedidos p set status = 'cancelado', motivo = 'sinal', bloqueio_id = null, atualizado_em = now()
      from public.bloqueios b join public.anotacoes a on a.bloqueio_id = b.id
     where p.bloqueio_id = b.id and p.status = 'pendente' and a.valor > 0 and coalesce(a.sinal, 0) = 0
       and b.criado_em < now() - interval '24 hours' and p.comprovante_em is null
       and not exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))
       and not exists (select 1 from public.pagamentos_asaas x where x.pedido = p.id)
    returning 1)
  select count(*)::int from v
$$;
revoke all on function public.vencer_pre_pedidos() from public, anon, authenticated;
select cron.schedule('pre-pedido-vence', '*/10 * * * *', 'select public.vencer_pre_pedidos()');

select (select count(*) from pg_trigger where tgname in ('pre_pedido_sinal', 'pre_pedido_fim')) as gatilhos,
       (select count(*) from cron.job where jobname = 'pre-pedido-vence') as agenda;

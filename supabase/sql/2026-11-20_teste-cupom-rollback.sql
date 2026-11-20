-- TESTE (nunca grava: termina com erro de propósito, tudo volta atrás). Apagar depois.
-- Cupom de boas-vindas do site (Rodrigo 2026-11-20).
-- Quem vê o pop-up "Garanta seu cupom de desconto", toca no botão e cria uma conta NOVA (WhatsApp confirmado)
-- ganha um cupom: R$ 100 se usar na Miss Bardot (lancha do Rodrigo) ou R$ 50 em qualquer outra lancha.
-- Nas outras lanchas o desconto sai só da comissão da Búzios e nunca passa dela (o líquido do dono não muda).
-- Vale em qualquer data (Réveillon e Carnaval também), 6 meses, 1 por pessoa e por WhatsApp. Conta antiga não ganha.
-- O cupom também entra sozinho na pré-reserva que o Lucas fecha pelo WhatsApp (quando o cliente liga o passeio à conta).
-- Idempotente.

-- 1) configuração (uma linha só; sem acesso pelo site/app)
create table if not exists public.cupom_site_config (
  id int primary key default 1 check (id = 1),
  ativo boolean not null default true,
  valor_mb numeric not null default 100 check (valor_mb >= 0 and valor_mb <= 500),
  valor_outras numeric not null default 50 check (valor_outras >= 0 and valor_outras <= 500),
  validade_meses int not null default 6 check (validade_meses between 1 and 24),
  desde timestamptz not null default now()
);
alter table public.cupom_site_config enable row level security;
revoke all on public.cupom_site_config from anon, authenticated;
insert into public.cupom_site_config (id) values (1) on conflict (id) do nothing;

-- 2) cupom com valor diferente fora da Miss Bardot
alter table public.cupons add column if not exists valor_outras numeric;

-- 3) resgatar: chamado pelo site logo depois do cadastro feito pelo pop-up
create or replace function public.resgatar_cupom_site()
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare uid uuid := auth.uid(); cfg public.cupom_site_config; c public.clientes; tel text; k public.cupons;
begin
  if uid is null then return jsonb_build_object('ok', false, 'motivo', 'login'); end if;
  select * into cfg from public.cupom_site_config where id = 1;
  if cfg.id is null or not cfg.ativo then return jsonb_build_object('ok', false, 'motivo', 'desligado'); end if;
  select * into k from public.cupons where cliente = uid and origem = 'boas-vindas' limit 1;
  if k.id is not null then return jsonb_build_object('ok', true, 'ja', true, 'valor', k.valor, 'valor_outras', k.valor_outras, 'lancha', k.lancha, 'expira_em', k.expira_em); end if;
  select * into c from public.clientes where user_id = uid;
  if c.user_id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_cliente'); end if;
  if c.whatsapp_ok_em is null then return jsonb_build_object('ok', false, 'motivo', 'whatsapp'); end if;
  if c.criado_em < cfg.desde or c.criado_em < now() - interval '2 days' then return jsonb_build_object('ok', false, 'motivo', 'conta_antiga'); end if;
  if public.e_equipe(uid) then return jsonb_build_object('ok', false, 'motivo', 'equipe'); end if;
  if exists (select 1 from public.pedidos p where p.cliente = uid and p.status = 'aprovado') then return jsonb_build_object('ok', false, 'motivo', 'ja_cliente'); end if;
  tel := right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 8);
  if exists (select 1 from public.cupons q left join public.clientes o on o.user_id = q.cliente
              where q.origem = 'boas-vindas'
                and (q.cliente = uid or (length(tel) = 8 and right(regexp_replace(coalesce(o.whatsapp, ''), '\D', '', 'g'), 8) = tel))) then
    return jsonb_build_object('ok', false, 'motivo', 'whatsapp_usado');
  end if;
  insert into public.cupons (cliente, valor, valor_outras, expira_em, tipo, lancha, origem)
  values (uid, cfg.valor_mb, cfg.valor_outras, (current_date + make_interval(months => cfg.validade_meses))::date, 'buzios', null, 'boas-vindas')
  on conflict do nothing
  returning * into k;
  if k.id is null then return jsonb_build_object('ok', false, 'motivo', 'whatsapp_usado'); end if;
  return jsonb_build_object('ok', true, 'valor', k.valor, 'valor_outras', k.valor_outras, 'expira_em', k.expira_em);
end $f$;
revoke all on function public.resgatar_cupom_site() from public, anon;
grant execute on function public.resgatar_cupom_site() to authenticated;

-- 4) lista do cliente com origem e valor nas outras lanchas
create or replace function public.meus_cupons_v3()
 returns table(id bigint, valor numeric, valor_outras numeric, expira_em date, origem_pedido bigint, pedido bigint, usado_em timestamptz, tipo text, lancha text, origem text)
 language plpgsql security definer set search_path to 'public' as $f$
begin
  if auth.uid() is null then return; end if;
  perform public.gerar_cupons(auth.uid());
  perform public.gerar_cupom_boas_vindas(auth.uid());
  return query select c.id, c.valor, c.valor_outras, c.expira_em, c.origem_pedido, c.pedido, c.usado_em, c.tipo, c.lancha, c.origem from public.cupons c
    where c.cliente = auth.uid() and (c.pedido is not null or c.expira_em >= current_date) order by c.expira_em;
end $f$;
revoke all on function public.meus_cupons_v3() from public, anon;
grant execute on function public.meus_cupons_v3() to authenticated;

-- 5) uso no pedido: Miss Bardot usa o valor cheio (sai da parte da lancha, que é do Rodrigo); nas outras, o valor_outras sai da comissão da Búzios
create or replace function public.pedido_cupom_antes()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare c public.cupons;
begin
  new.cupom_valor := null; new.cupom_dono := null;
  if new.cupom is null then return new; end if;
  select * into c from public.cupons where id = new.cupom and cliente = new.cliente and pedido is null and expira_em >= current_date
    and (lancha is null or lancha = new.lancha);
  if not found then raise exception 'CUPOM' using errcode = 'P0001'; end if;
  if c.valor_outras is not null then
    if new.lancha = 'miss-bardot' then new.cupom_valor := c.valor; new.cupom_dono := c.valor;
    else new.cupom_valor := c.valor_outras; new.cupom_dono := 0; end if;
  else
    new.cupom_valor := c.valor;
    new.cupom_dono := case when c.tipo = 'dono' then c.valor else 0 end;
  end if;
  return new;
end $function$;

-- 6) teto: o cupom da Búzios nunca passa da comissão dela neste pedido (roda depois do pedido_vendedor, que acerta a base)
create or replace function public.pedido_cupom_teto()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare pr record; base numeric; bz numeric;
begin
  if new.cupom is null or coalesce(new.cupom_valor, 0) <= 0 or new.lancha = 'miss-bardot' then return new; end if;
  if coalesce(new.cupom_dono, 0) >= new.cupom_valor then return new; end if; -- cupom do dono: sai do neto dele, não da comissão
  select * into pr from public._precos_lanc(new.lancha, new.data, new.horario, new.hora_ini, new.hora_fim);
  base := coalesce(nullif(new.preco_base, 0), pr.tab);
  if pr.neto is null or pr.neto <= 0 or base is null or base <= 0 then return new; end if;
  bz := greatest(base - pr.neto, 0);
  if new.cupom_valor - coalesce(new.cupom_dono, 0) > bz then
    new.cupom_valor := coalesce(new.cupom_dono, 0) + bz;
  end if;
  if new.cupom_valor <= 0 then new.cupom := null; new.cupom_valor := null; new.cupom_dono := null; end if; -- sem comissão: o cupom fica guardado
  return new;
end $function$;
drop trigger if exists pedido_zz_cupom_teto on public.pedidos;
create trigger pedido_zz_cupom_teto before insert on public.pedidos for each row execute function public.pedido_cupom_teto();

-- 7) melhor cupom do cliente para esta lancha (para a pré-reserva fechada pelo Lucas)
create or replace function public._melhor_cupom(uid uuid, l text)
returns bigint language plpgsql security definer set search_path to 'public' as $f$
declare cid bigint;
begin
  if uid is null or l is null then return null; end if;
  perform public.gerar_cupons(uid);
  select c.id into cid from public.cupons c
   where c.cliente = uid and c.pedido is null and c.expira_em >= current_date and (c.lancha is null or c.lancha = l)
   order by (case when c.valor_outras is not null and l <> 'miss-bardot' then c.valor_outras else c.valor end) desc, c.expira_em
   limit 1;
  return cid;
end $f$;
revoke all on function public._melhor_cupom(uuid, text) from public, anon, authenticated;

-- 8) _ligar_passeio: a pré-reserva sem sinal (fechada pelo Lucas/Búzios) já nasce com o melhor cupom do cliente.
--    Se der qualquer erro com o cupom, o pedido nasce sem ele (nunca deixa de criar o pedido).
CREATE OR REPLACE FUNCTION public._ligar_passeio(bid bigint, uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b record; n record; nm text; adm boolean := public.e_admin(); pb numeric; sv numeric; tg numeric; pid bigint; cid bigint; tx text; ate timestamptz;
        princ bigint; nl int; m record; bc timestamptz; cup bigint;
begin
  select * into b from public.bloqueios where id = bid;
  select * into n from public.anotacoes where bloqueio_id = bid;
  select preco_base into pb from public.passeio_preco_base where bloqueio_id = bid;
  if not adm and n.cliente_conta is not null and n.cliente_conta <> uid then return; end if;
  select nullif(btrim(nome), '') into nm from public.clientes where user_id = uid;
  insert into public.anotacoes (bloqueio_id, cliente_conta, cliente) values (bid, uid, nm)
    on conflict (bloqueio_id) do update set cliente_conta = uid, cliente = coalesce(nm, anotacoes.cliente);
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

-- 9) para o Lucas/vigia (operador): cupom válido do cliente pelo WhatsApp, por lancha
create or replace function public.cupom_do_cliente_operador(p_tel text)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare dig text := right(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), 8); uid uuid; r jsonb;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'sem permissao' using errcode = '42501'; end if;
  if length(dig) < 8 then return null; end if;
  select c.user_id into uid from public.clientes c where right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 8) = dig order by c.criado_em desc limit 1;
  if uid is null then return null; end if;
  perform public.gerar_cupons(uid);
  select jsonb_agg(jsonb_build_object('valor', k.valor, 'valor_outras', k.valor_outras, 'lancha', k.lancha, 'expira_em', k.expira_em, 'origem', coalesce(k.origem, 'passeio')) order by k.expira_em)
    into r from public.cupons k where k.cliente = uid and k.pedido is null and k.expira_em >= current_date;
  return r;
end $f$;
revoke all on function public.cupom_do_cliente_operador(text) from public, anon;
grant execute on function public.cupom_do_cliente_operador(text) to authenticated;
do $t$
declare u uuid := gen_random_uuid(); r jsonb; pid bigint; v numeric; d numeric; l text; dt date := current_date + 40; res text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-cupom-'||left(u::text,8)||'@exemplo.invalid', now(), now());
  insert into public.clientes (user_id, nome, whatsapp) values (u, 'Teste Cupom', '+55 21 90000-'||lpad((floor(random()*9999))::text,4,'0')) on conflict (user_id) do nothing;
  update public.clientes set whatsapp_ok_em = now(), criado_em = now() where user_id = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  r := public.resgatar_cupom_site(); res := res || 'resgate1=' || r::text || E'\n';
  r := public.resgatar_cupom_site(); res := res || 'resgate2=' || r::text || E'\n';
  -- outra lancha (não MB)
  select slug into l from public.lanchas where slug <> 'miss-bardot' and public.preco_tabela(slug, dt, 'manha') > 0 and public.preco_neto_tabela(slug, dt, 'manha') > 0 limit 1;
  insert into public.pedidos (cliente, lancha, data, horario, pessoas, status, preco_base, cupom)
    values (u, l, dt, 'manha', 2, 'pendente', public.preco_tabela(l, dt, 'manha'), (select id from cupons where cliente = u)) returning id, cupom_valor, cupom_dono into pid, v, d;
  res := res || format('outra %s tab=%s neto=%s cupom_valor=%s cupom_dono=%s', l, public.preco_tabela(l, dt, 'manha'), public.preco_neto_tabela(l, dt, 'manha'), v, d) || E'\n';
  update public.pedidos set status = 'cancelado' where id = pid;
  res := res || 'liberado=' || (select (pedido is null)::text from cupons where cliente = u) || E'\n';
  insert into public.pedidos (cliente, lancha, data, horario, pessoas, status, preco_base, cupom)
    values (u, 'miss-bardot', dt, 'manha', 2, 'pendente', public.preco_tabela('miss-bardot', dt, 'manha'), (select id from cupons where cliente = u)) returning id, cupom_valor, cupom_dono into pid, v, d;
  res := res || format('mb cupom_valor=%s cupom_dono=%s', v, d) || E'\n';
  res := res || 'melhor_mb=' || coalesce(public._melhor_cupom(u,'miss-bardot')::text,'null') || E'\n';
  res := res || 'operador_fn=' || (to_regprocedure('public.cupom_do_cliente_operador(text)') is not null)::text; raise exception 'RESULTADO %', res;
end $t$;

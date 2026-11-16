-- Revisão de segurança 2026-11-16 (item 1 CRÍTICO e item 3 do relatório).
-- O link da pré-reserva (#1009) achava a conta pelo E-MAIL do convite (que ninguém provou) e criava nela um cadastro
-- de cliente com o celular do convite já "confirmado": com isso, quem informasse o e-mail de outra pessoa (até da equipe)
-- e o próprio celular conseguia trocar a senha dela pelo WhatsApp. Aqui:
--  * _convite_pagar: conta só pelo celular JÁ CONFIRMADO de cliente que não é da equipe; sem busca por e-mail; sem criar cadastro.
--  * ativar_conta_cliente: recusa conta da equipe/painel e não marca o WhatsApp como confirmado em cadastro novo.
-- Só CREATE OR REPLACE / REVOKE / GRANT. Não apaga nada.

CREATE OR REPLACE FUNCTION public._convite_pagar(p_codigo uuid, p_uid uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare cv record; u uuid := p_uid; pd record; tk text; td text; bd date;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'service_role') then raise exception 'Sem acesso'; end if;
  select id, email, nome, telefone, tel_dig, bloqueio_id, criado_em into cv from public.convites where codigo = p_codigo;
  if cv.id is null or cv.bloqueio_id is null or cv.criado_em < now() - interval '30 days' then return jsonb_build_object('erro', 'link'); end if;
  select data into bd from public.bloqueios where id = cv.bloqueio_id;
  if bd is null or bd < (now() at time zone 'America/Sao_Paulo')::date then return jsonb_build_object('erro', 'link'); end if;
  td := regexp_replace(coalesce(nullif(cv.tel_dig, ''), cv.telefone, ''), '\D', '', 'g');
  select id, cliente into pd from public.pedidos where bloqueio_id = cv.bloqueio_id order by id desc limit 1;
  if pd.id is not null then u := pd.cliente;
  else
    if u is not null and (public.e_equipe(u) or exists (select 1 from public.papeis_painel pp where pp.user_id = u)) then u := null; end if;
    if u is null and length(td) >= 10 then
      select c.user_id into u from public.clientes c
       where public._dig(c.whatsapp) = td and c.whatsapp_ok_em is not null
         and not public.e_equipe(c.user_id)
         and not exists (select 1 from public.papeis_painel pp where pp.user_id = c.user_id)
       order by c.whatsapp_ok_em desc, c.criado_em desc limit 1;
    end if;
    if u is null then
      return jsonb_build_object('precisa_conta', true, 'nome', coalesce(cv.nome, ''), 'tel', td, 'wa', public._wa_fmt(cv.telefone, td), 'email', coalesce(cv.email, ''));
    end if;
    perform public._ligar_passeio(cv.bloqueio_id, u);
    select id, cliente into pd from public.pedidos where bloqueio_id = cv.bloqueio_id order by id desc limit 1;
  end if;
  update public.convites set resgatado_em = coalesce(resgatado_em, now()) where id = cv.id;
  if pd.id is null then return jsonb_build_object('erro', 'pedido'); end if;
  select id, status, sinal_valor, jetski_valor into pd from public.pedidos where id = pd.id;
  if pd.status = 'pendente' and coalesce(pd.sinal_valor, 0) > 0 then
    insert into public.pagamentos_pp (pedido, moeda, valor, atualizado_em)
    values (pd.id, 'BRL', pd.sinal_valor + coalesce(pd.jetski_valor, 0), now()) on conflict (pedido) do nothing;
  end if;
  select token::text into tk from public.pagamentos_pp where pedido = pd.id;
  if tk is null then return jsonb_build_object('erro', 'pedido', 'pedido', pd.id); end if;
  update public.pedidos set paypal_link = coalesce(paypal_link, 'https://lanchaembuzios.com.br/pagar/?p=' || pd.id || '&k=' || tk) where id = pd.id;
  return jsonb_build_object('link', '/pagar/?p=' || pd.id || '&k=' || tk, 'pedido', pd.id, 'uid', u);
end $function$;
revoke execute on function public._convite_pagar(uuid, uuid) from public, anon, authenticated;
grant execute on function public._convite_pagar(uuid, uuid) to service_role;

CREATE OR REPLACE FUNCTION public.ativar_conta_cliente(p_bloqueio bigint DEFAULT NULL::bigint, p_tel text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare cv record; u record; pd record; tk text; dig text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
        td text; estado text := 'ja_ativa';
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if p_bloqueio is null and length(dig) < 8 then raise exception 'Informe a reserva ou o telefone'; end if;
  select id, email, nome, telefone, tel_dig, bloqueio_id, resgatado_em into cv from public.convites
   where coalesce(email, '') <> '' and bloqueio_id is not null
     and (case when p_bloqueio is not null then bloqueio_id = p_bloqueio
               else right(regexp_replace(coalesce(telefone, tel_dig, ''), '\D', '', 'g'), 8) = right(dig, 8) end)
     and exists (select 1 from public.bloqueios b where b.id = bloqueio_id and b.data >= (now() at time zone 'America/Sao_Paulo')::date)
   order by (resgatado_em is null) desc, id desc limit 1;
  if cv.id is null then return jsonb_build_object('ok', false, 'estado', 'sem_convite'); end if;
  select id, email_confirmed_at into u from auth.users where lower(email) = lower(trim(cv.email)) order by created_at desc limit 1;
  if u.id is null then return jsonb_build_object('ok', false, 'estado', 'sem_conta', 'email', cv.email); end if;
  -- 2026-11-16: conta da equipe ou do painel nunca é "ativada" por convite de cliente
  if public.e_equipe(u.id) or exists (select 1 from public.papeis_painel pp where pp.user_id = u.id) then
    return jsonb_build_object('ok', false, 'estado', 'equipe'); end if;
  if u.email_confirmed_at is null then
    update auth.users set email_confirmed_at = now() where id = u.id and email_confirmed_at is null; estado := 'ativada'; end if;
  td := regexp_replace(coalesce(cv.telefone, cv.tel_dig, ''), '\D', '', 'g');
  if not exists (select 1 from public.clientes where user_id = u.id) and coalesce(trim(cv.nome), '') <> '' and length(td) >= 10 then
    insert into public.clientes (user_id, nome, whatsapp, whatsapp_ok_em, pais)
    values (u.id, trim(cv.nome), public._wa_fmt(cv.telefone, td), null, case when td like '55%' then 'BR' else null end)
    on conflict (user_id) do nothing;
  end if;
  if not exists (select 1 from public.pedidos where bloqueio_id = cv.bloqueio_id) then
    perform public._ligar_passeio(cv.bloqueio_id, u.id);
  end if;
  update public.convites set resgatado_em = coalesce(resgatado_em, now()) where id = cv.id;
  select id, status, sinal_valor, jetski_valor, cliente into pd from public.pedidos where bloqueio_id = cv.bloqueio_id order by id desc limit 1;
  if pd.id is null or pd.cliente is distinct from u.id then
    return jsonb_build_object('ok', true, 'estado', estado, 'email', cv.email, 'link', null); end if;
  if pd.status = 'pendente' and coalesce(pd.sinal_valor, 0) > 0 then
    insert into public.pagamentos_pp (pedido, moeda, valor, atualizado_em)
    values (pd.id, 'BRL', pd.sinal_valor + coalesce(pd.jetski_valor, 0), now())
    on conflict (pedido) do nothing;
  end if;
  select token into tk from public.pagamentos_pp where pedido = pd.id;
  if tk is null then return jsonb_build_object('ok', true, 'estado', estado, 'email', cv.email, 'link', null, 'pedido', pd.id); end if;
  update public.pedidos set paypal_link = coalesce(paypal_link, 'https://lanchaembuzios.com.br/pagar/?p=' || pd.id || '&k=' || tk) where id = pd.id;
  return jsonb_build_object('ok', true, 'estado', estado, 'email', cv.email, 'pedido', pd.id,
    'link', 'https://lanchaembuzios.com.br/pagar/?p=' || pd.id || '&k=' || tk, 'telefone', td, 'nome', split_part(trim(coalesce(cv.nome, '')), ' ', 1));
end $function$;

-- publicar: auto
-- 2026-11-17 revisão diária: "Ativar conta" (ativar_conta_cliente) só confirma o e-mail quando o cadastro tem o WhatsApp do
-- convite verificado por código. A conta criada depois do convite continua recebendo a reserva e o link de pagamento
-- (que vai ao WhatsApp da reserva), mas o e-mail fica sem confirmar. Só CREATE OR REPLACE / REVOKE / GRANT. Idempotente.
CREATE OR REPLACE FUNCTION public.ativar_conta_cliente(p_bloqueio bigint DEFAULT NULL::bigint, p_tel text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare cv record; u record; pd record; tk text; dig text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
        td text; estado text := 'ja_ativa'; prova_wa boolean;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if p_bloqueio is null and length(dig) < 10 then raise exception 'Informe a reserva ou o telefone'; end if;
  select id, email, nome, telefone, tel_dig, bloqueio_id, resgatado_em, criado_em into cv from public.convites
   where coalesce(email, '') <> '' and bloqueio_id is not null
     and (case when p_bloqueio is not null then bloqueio_id = p_bloqueio
               else public._tel_chave(coalesce(nullif(tel_dig, ''), telefone, '')) = public._tel_chave(dig) end)
     and exists (select 1 from public.bloqueios b where b.id = bloqueio_id and b.data >= (now() at time zone 'America/Sao_Paulo')::date)
   order by (resgatado_em is null) desc, id desc limit 1;
  if cv.id is null then return jsonb_build_object('ok', false, 'estado', 'sem_convite'); end if;
  select id, email_confirmed_at, created_at into u from auth.users where lower(email) = lower(trim(cv.email)) order by created_at desc limit 1;
  if u.id is null then return jsonb_build_object('ok', false, 'estado', 'sem_conta', 'email', cv.email); end if;
  -- 2026-11-16: conta da equipe ou do painel nunca é "ativada" por convite de cliente
  if public.e_equipe(u.id) or exists (select 1 from public.papeis_painel pp where pp.user_id = u.id) then
    return jsonb_build_object('ok', false, 'estado', 'equipe'); end if;
  td := regexp_replace(coalesce(nullif(cv.tel_dig, ''), cv.telefone, ''), '\D', '', 'g');
  -- a conta precisa ser do cliente do convite: WhatsApp do cadastro = telefone do convite, ou (sem cadastro com outro número)
  -- conta criada depois do convite. Fora disso, não confirma nada: o cliente usa o link da pré-reserva (WhatsApp já verificado).
  -- 2026-11-17: prova forte = cadastro com o WhatsApp do convite JÁ VERIFICADO por código (whatsapp_ok_em).
  prova_wa := exists (select 1 from public.clientes c where c.user_id = u.id and c.whatsapp_ok_em is not null
                        and length(td) >= 10 and public._tel_chave(c.whatsapp) = public._tel_chave(td));
  if not prova_wa and (u.created_at < cv.criado_em or exists (select 1 from public.clientes c where c.user_id = u.id)) then
    return jsonb_build_object('ok', false, 'estado', 'conferir', 'email', cv.email); end if;
  -- Sem a prova forte (conta criada depois do convite, ninguém provou o e-mail): liga a reserva e manda o link de pagamento
  -- ao WhatsApp da reserva, mas NÃO confirma o e-mail. Assim quem criou a conta com o e-mail de outra pessoa não ganha
  -- uma conta confirmada que depois receberia o login Google dessa pessoa.
  if prova_wa and u.email_confirmed_at is null then
    update auth.users set email_confirmed_at = now() where id = u.id and email_confirmed_at is null; estado := 'ativada'; end if;
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
revoke execute on function public.ativar_conta_cliente(bigint, text) from public, anon;
grant execute on function public.ativar_conta_cliente(bigint, text) to authenticated, service_role;

-- 2026-11-16 (Rodrigo, caso Elka): o link da pré-reserva que o Lucas manda pelo WhatsApp não pede mais e-mail nem código.
-- O link só chegou naquele WhatsApp, então o número já está confirmado:
--   * número (ou e-mail do convite) que já tem conta: o link vai direto para a página de pagamento;
--   * sem conta: o cliente só cria a senha ("Crie sua senha") e cai no pagamento. A conta nasce com o WhatsApp confirmado;
--     o e-mail que o Lucas anotou fica guardado (email_informado) e só é confirmado se a pessoa tentar entrar por ele.
-- Só a função cadastro-whatsapp (service_role) chama estas funções.
-- WhatsApp no formato do cadastro (clientes_whatsapp_check: "+DDI resto"): usa o da reserva se já estiver certo
create or replace function public._wa_fmt(tel text, td text)
returns text language sql immutable set search_path = public as $$
  select case when coalesce(tel, '') ~ '^\+[0-9]{1,4} [0-9 ()-]{6,}$' then tel
              when td like '55%' then '+55 ' || substr(td, 3)
              when td like '1%' then '+1 ' || substr(td, 2)
              else '+' || left(td, 2) || ' ' || substr(td, 3) end;
$$;

create or replace function public._convite_pagar(p_codigo uuid, p_uid uuid default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
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
    if u is null and length(td) >= 10 then
      select c.user_id into u from public.clientes c where public._dig(c.whatsapp) = td order by c.whatsapp_ok_em desc nulls last, c.criado_em desc limit 1;
    end if;
    if u is null and coalesce(cv.email, '') <> '' then
      select id into u from auth.users where lower(email) = lower(trim(cv.email)) order by created_at desc limit 1;
    end if;
    if u is null then
      return jsonb_build_object('precisa_conta', true, 'nome', coalesce(cv.nome, ''), 'tel', td, 'wa', public._wa_fmt(cv.telefone, td), 'email', coalesce(cv.email, ''));
    end if;
    -- conta que não tem cadastro de cliente (ex.: criou com e-mail e parou no código): completa com os dados da reserva
    if not exists (select 1 from public.clientes where user_id = u) and length(td) >= 10
       and not exists (select 1 from public.clientes where public._dig(whatsapp) = td) then
      insert into public.clientes (user_id, nome, whatsapp, whatsapp_ok_em, pais)
      values (u, coalesce(nullif(trim(cv.nome), ''), 'Cliente'), public._wa_fmt(cv.telefone, td), now(), case when td like '55%' then 'BR' end)
      on conflict (user_id) do nothing;
    end if;
    update public.clientes set whatsapp_ok_em = now() where user_id = u and whatsapp_ok_em is null and public._dig(whatsapp) = td;
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
end $$;
revoke all on function public._convite_pagar(uuid, uuid) from public, anon, authenticated;
grant execute on function public._convite_pagar(uuid, uuid) to service_role;

-- conta criada pelo link com o e-mail que o Lucas anotou (ainda não confirmado): quem tenta entrar por esse e-mail é achado aqui
create or replace function public._uid_email_informado(e text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users
   where lower(raw_user_meta_data->>'email_informado') = lower(trim(e)) and email like '%@sem-email.lanchaembuzios.com.br'
   order by created_at desc limit 1;
$$;
revoke all on function public._uid_email_informado(text) from public, anon, authenticated;
grant execute on function public._uid_email_informado(text) to service_role;

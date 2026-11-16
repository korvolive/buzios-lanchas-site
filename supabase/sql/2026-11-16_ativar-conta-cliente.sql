-- 2026-11-16: "Ativar conta e gerar link" quando o código de confirmação do e-mail não chega ao cliente (caso Elka, 15/11).
-- Rodrigo: "não pode ficar pedindo pro cliente fazer um monte de coisa, já aprova a conta e manda o link pra pagar logo".
-- O administrador (botão nos Sinais pendentes) ou o Lucas (operador, pela ponte) fazem tudo de uma vez:
--   1. confirmam o e-mail da conta que o cliente já criou pelo link da pré-reserva (só o e-mail que a equipe pôs no convite);
--   2. completam o cadastro com o nome e o WhatsApp da reserva, se faltar;
--   3. ligam a pré-reserva à conta (o pedido nasce com o pagamento liberado, como no resgate normal do convite);
--   4. devolvem o link direto /pagar/, que abre sem login.
-- Se o cliente ainda não criou a conta, devolve estado 'sem_conta' (o convite continua valendo).
create or replace function public.ativar_conta_cliente(p_bloqueio bigint default null, p_tel text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
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
  if u.email_confirmed_at is null then
    update auth.users set email_confirmed_at = now() where id = u.id and email_confirmed_at is null; estado := 'ativada'; end if;
  td := regexp_replace(coalesce(cv.telefone, cv.tel_dig, ''), '\D', '', 'g');
  if not exists (select 1 from public.clientes where user_id = u.id) and coalesce(trim(cv.nome), '') <> '' and length(td) >= 10 then
    insert into public.clientes (user_id, nome, whatsapp, whatsapp_ok_em, pais)
    values (u.id, trim(cv.nome), public._wa_fmt(cv.telefone, td), now(), case when td like '55%' then 'BR' else null end)
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
end $$;
revoke all on function public.ativar_conta_cliente(bigint, text) from public, anon;
grant execute on function public.ativar_conta_cliente(bigint, text) to authenticated, service_role;

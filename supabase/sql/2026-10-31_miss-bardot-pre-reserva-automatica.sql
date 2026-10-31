-- Miss Bardot: pedido lançado pelo Lucas (operador) já vira pré-reserva, sem esperar o Rodrigo aprovar (Rodrigo 2026-10-31).
-- As outras lanchas continuam como estão (pedido nas Consultas, o Rodrigo aprova).
-- O servidor confere tudo como antes: data livre, manutenção, capacidade, valor entre o mínimo (com grupo pequeno) e a tabela.
-- Sem sinal pago = pré-reserva com prazo; se o cliente não pagar, ela vence sozinha e a data volta a ficar livre.

-- 1) aprovação sem a conferência de administrador, só para uso interno
create or replace function public._aprovar_consulta(cid bigint, p_recebido boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.consultas%rowtype; bid bigint; v numeric; s numeric; sc numeric; res text; pid bigint; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
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
    sc := s;
    s := 0;
  end if;
  if exists (select 1 from public.bloqueios x where x.lancha = c.lancha and x.data = c.data and public.choca_horario(x.horario, c.horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha'; end if;
  if exists (select 1 from public.manutencoes m where m.lancha = c.lancha and m.de <= c.data and c.data <= m.ate) then
    raise exception 'A lancha está em manutenção nesse dia'; end if;
  insert into public.bloqueios (lancha, data, horario, criado_por) values (c.lancha, c.data, c.horario, auth.uid()) returning id into bid;
  insert into public.anotacoes (bloqueio_id, origem, cliente, telefone, pessoas, valor, sinal, sinal_combinado, embarque, hora_ini, hora_fim, obs)
    values (bid, 'buzios', c.nome, c.telefone, c.pessoas, v, s, sc, c.embarque, c.hora_ini, c.hora_fim, c.obs);
  if c.vendedor is not null then
    insert into public.vendas_manuais (bloqueio_id, vendedor, comissao) values (bid, c.vendedor, round(coalesce(c.comissao_vend, 0), 2))
      on conflict (bloqueio_id) do nothing;
  end if;
  res := public.convidar_cliente(bid, c.email, c.nome, c.telefone);
  select id into pid from public.pedidos where bloqueio_id = bid;
  delete from public.consultas where id = cid;
  return jsonb_build_object('bid', bid, 'convite', res, 'pendente', s = 0, 'email', c.email, 'valor', v, 'sinal', s, 'pedido', pid);
end $$;
revoke all on function public._aprovar_consulta(bigint, boolean) from public, anon, authenticated;

-- 2) o Aprovar do administrador continua igual
create or replace function public.aprovar_consulta(cid bigint, p_recebido boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'Só o administrador aprova'; end if;
  return public._aprovar_consulta(cid, p_recebido);
end $$;

-- 3) dentro da pré-reserva automática (marca local da transação), o passeio da Búzios pode ser gravado e o cliente convidado
create or replace function public.trava_valor_buzios()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.e_admin() or auth.role() = 'service_role' or current_setting('app.auto_op', true) = '1' then return new; end if;
  if tg_op = 'UPDATE' and old.origem = 'buzios' then
    new.origem := old.origem; new.valor := old.valor; new.sinal := old.sinal;
  elsif new.origem = 'buzios' then
    raise exception 'Somente a Búzios Lanchas registra passeios fechados pela Búzios Lanchas';
  end if;
  return new;
end $$;

create or replace function public.convidar_cliente(bid bigint, email_cli text, nome_cli text, tel text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; e text := nullif(lower(btrim(coalesce(email_cli,''))), ''); d text := public._dig(tel); l text;
  adm boolean := public.e_admin() or current_setting('app.auto_op', true) = '1';
begin
  select lancha into l from public.bloqueios where id = bid;
  if l is null then raise exception 'Passeio não encontrado'; end if;
  if not (adm or public.pode_editar(l)) then raise exception 'Só o administrador ou o dono da lancha'; end if;
  if e is null and (d is null or length(d) < 8) then raise exception 'Informe o WhatsApp do cliente'; end if;
  if e is not null and e !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'E-mail do cliente inválido'; end if;
  if e is null then select c.email into e from public.convites c where c.bloqueio_id = bid; end if;
  if adm then
    if e is not null then
      select u.id into uid from auth.users u join public.clientes c on c.user_id = u.id where lower(u.email) = e;
    end if;
    if uid is null and d is not null then
      select c.user_id into uid from public.clientes c where public._dig(c.whatsapp) = d limit 1;
    end if;
    if uid is not null then
      perform public._ligar_passeio(bid, uid);
      update public.convites set resgatado_em = now() where bloqueio_id = bid and resgatado_em is null;
      return 'ligado';
    end if;
  end if;
  insert into public.convites (email, nome, telefone, tel_dig, bloqueio_id) values (e, nullif(btrim(nome_cli), ''), nullif(btrim(tel), ''), d, bid)
    on conflict (bloqueio_id) do update set email = excluded.email, nome = excluded.nome, telefone = excluded.telefone, tel_dig = excluded.tel_dig, criado_em = now(), resgatado_em = null;
  return 'convite';
end $$;

-- 4) o Lucas lança: Miss Bardot vira pré-reserva na hora; as outras lanchas ficam nas Consultas
create or replace function public.lancar_reserva_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text,
  p_embarque text default null, p_valor numeric default null, p_sinal numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare nid bigint; r jsonb;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  nid := public.lancar_pedido_operador(p_lancha, p_data, p_horario, p_pessoas, p_nome, p_tel, p_email, p_lang, p_embarque, p_valor, p_sinal, p_hora_ini, p_hora_fim, p_obs);
  if p_lancha <> 'miss-bardot' then return jsonb_build_object('cid', nid, 'auto', false); end if;
  perform set_config('app.auto_op', '1', true);
  r := public._aprovar_consulta(nid, false);
  perform set_config('app.auto_op', '', true);
  return r || jsonb_build_object('auto', true, 'cid', nid);
end $$;
revoke all on function public.lancar_reserva_operador(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.lancar_reserva_operador(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text) to authenticated;

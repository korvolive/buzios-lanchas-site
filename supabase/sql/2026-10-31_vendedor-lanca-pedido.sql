-- Vendedor lança pedido para o Rodrigo aprovar (Rodrigo 2026-10-31, começando pelo John na Miss Bardot)
-- O vendedor que fechou com o cliente lança lancha, data, horário, valor e a comissão dele.
-- Vira uma consulta já respondida em Reservas › Consultas, marcada com o vendedor. Nada entra na agenda até o Rodrigo aprovar.
-- Ao aprovar, a comissão vai sozinha para "Vendedor que trouxe o cliente" (vendas_manuais) e aparece em Comissões a pagar.
-- Vendedor não lança sinal: o cliente sempre paga a Búzios Lanchas (regra do Rodrigo 2026-10-30).

alter table public.consultas add column if not exists vendedor uuid references auth.users(id) on delete set null;
alter table public.consultas add column if not exists comissao_vend numeric;

create or replace function public.lancar_pedido_vendedor(p_lancha text, p_data date, p_horario text, p_pessoas integer,
  p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null,
  p_valor numeric default null, p_comissao numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare nid bigint; vd public.vendedores%rowtype; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; com numeric;
        hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into vd from public.vendedores where user_id = auth.uid() and ativo;
  if vd.user_id is null or coalesce(vd.parceiro, false) then raise exception 'Só vendedor pode lançar pedido'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'Escreva nome e sobrenome do cliente'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'WhatsApp do cliente inválido'; end if;
  if coalesce(p_email,'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'E-mail do cliente inválido'; end if;
  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario,''), p_data) then raise exception 'Horário inválido'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > public._capacidade(p_lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(p_lancha); end if;
  if length(coalesce(p_embarque,'')) > 120 or length(coalesce(p_obs,'')) > 300 then raise exception 'Texto longo demais'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim > p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  v := public._confere_valor_op(p_lancha, p_data, p_horario, p_valor);  -- mesmo teto e mínimo do suporte
  com := coalesce(p_comissao, 0);
  if com < 0 or (v is not null and com > round(v * coalesce(vd.teto_pct, 10) / 100)) then
    raise exception 'A comissão vai de R$ 0 até % %% do valor (R$ %)', coalesce(vd.teto_pct, 10), round(coalesce(v, 0) * coalesce(vd.teto_pct, 10) / 100); end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 20 then raise exception 'Limite de pedidos do dia'; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, vendedor, comissao_vend, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang,
                                valor, hora_ini, hora_fim, obs)
    values (true, now(), auth.uid(), auth.uid(), com, p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            lower(trim(p_email)), case when p_lang in ('pt','en','es') then p_lang else 'pt' end, v, p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''))
    returning id into nid;
  return nid;
end $$;
revoke all on function public.lancar_pedido_vendedor(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.lancar_pedido_vendedor(text, date, text, integer, text, text, text, text, text, numeric, numeric, text, text, text) to authenticated;

-- o vendedor vê os pedidos que ele lançou (só os dele)
drop policy if exists consultas_vendedor_le on public.consultas;
create policy consultas_vendedor_le on public.consultas for select to authenticated using (vendedor = auth.uid());

-- aprovar num toque: a comissão do vendedor vai junto para o passeio
create or replace function public.aprovar_consulta(cid bigint, p_recebido boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
  -- pedido lançado por vendedor: a comissão dele entra no passeio (Comissões a pagar)
  if c.vendedor is not null then
    insert into public.vendas_manuais (bloqueio_id, vendedor, comissao) values (bid, c.vendedor, round(coalesce(c.comissao_vend, 0), 2))
      on conflict (bloqueio_id) do nothing;
  end if;
  -- convite do cliente: quem já tem conta recebe o passeio na hora (pré-reserva: com o pagamento liberado na central)
  res := public.convidar_cliente(bid, c.email, c.nome, c.telefone);
  select id into pid from public.pedidos where bloqueio_id = bid;
  delete from public.consultas where id = cid;
  return jsonb_build_object('bid', bid, 'convite', res, 'pendente', s = 0, 'email', c.email, 'valor', v, 'sinal', s, 'pedido', pid);
end $$;

select (select count(*) from information_schema.columns where table_name = 'consultas' and column_name in ('vendedor','comissao_vend')) as colunas,
       (select count(*) from pg_proc where proname = 'lancar_pedido_vendedor') as lancar,
       (select position('vendas_manuais' in prosrc) > 0 from pg_proc where proname = 'aprovar_consulta') as aprovar;

-- 2026-11-04 (Rodrigo): tudo pelo WhatsApp. No "Cliente fechou: enviar para aprovar" do vendedor, o e-mail do cliente fica opcional.
-- Depois da aprovação, o número oficial manda sozinho o aviso passeio_registrado (link do cadastro que já confirma o WhatsApp).

create or replace function public.lancar_pedido_vendedor(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null::text, p_valor numeric default null::numeric, p_comissao numeric default null::numeric, p_hora_ini text default null::text, p_hora_fim text default null::text, p_obs text default null::text)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare nid bigint; vd public.vendedores%rowtype; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; com numeric; tet numeric;
        hoje date := (now() at time zone 'America/Sao_Paulo')::date; em text := lower(trim(coalesce(p_email,'')));
begin
  select * into vd from public.vendedores where user_id = auth.uid() and ativo;
  if vd.user_id is null or coalesce(vd.parceiro, false) then raise exception 'Só vendedor pode lançar pedido'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'Escreva nome e sobrenome do cliente'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'WhatsApp do cliente inválido'; end if;
  -- e-mail opcional (2026-11-04): o vendedor manda o link pelo WhatsApp dele
  if em <> '' and (em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(em) > 200) then raise exception 'E-mail do cliente inválido'; end if;
  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario,''), p_data) then raise exception 'Horário inválido'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > public._capacidade(p_lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(p_lancha); end if;
  if length(coalesce(p_embarque,'')) > 120 or length(coalesce(p_obs,'')) > 300 then raise exception 'Texto longo demais'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim > p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  if exists (select 1 from public.bloqueios x where x.lancha = p_lancha and x.data = p_data and x.revenda is null and public.choca_horario(x.horario, p_horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha'; end if;
  -- vendedor só vende no horário padrão (Rodrigo 2026-11-04): 4h = 10h-14h ou 14h-18h, 7h = 10h-17h
  p_hora_ini := case p_horario when 'manha' then '10:00' when 'tarde' then '14:00' when 'dia' then '10:00' else null end;
  p_hora_fim := case p_horario when 'manha' then '14:00' when 'tarde' then '18:00' when 'dia' then '17:00' else null end;
  v := public.preco_tabela(p_lancha, p_data, p_horario);
  if v is null or v <= 0 then raise exception 'Essa lancha não tem preço de tabela nesse dia. Fale com o Rodrigo'; end if;
  com := round(coalesce(p_comissao, 0)); tet := public._teto_comissao_manual(v);
  if com < 0 or com > tet then raise exception 'A comissão vai de R$ 0 até R$ % (no máximo R$ 1.000 e 30%% do valor)', tet; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 20 then raise exception 'Limite de pedidos do dia'; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, vendedor, comissao_vend, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang,
                                valor, hora_ini, hora_fim, obs)
    values (true, now(), auth.uid(), auth.uid(), com, p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            em, case when p_lang in ('pt','en','es') then p_lang else 'pt' end,
            v + com, p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''))
    returning id into nid;
  return nid;
end $function$;

select 'ok' as vendedor_manda_link;

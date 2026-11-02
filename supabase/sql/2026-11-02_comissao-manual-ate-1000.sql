-- Comissão do vendedor quando ele mesmo lança o cliente (Rodrigo 2026-11-02):
-- no "💼 Vender" (pedido lançado ou link só para aquele cliente) a comissão é em reais, até R$ 1.000 e até 30% do valor de tabela.
-- O cliente que entra sozinho pelo link do vendedor paga 5% fixo, igual para todos os vendedores (o vendedor não escolhe mais a %).
-- Parceiros continuam com os 3% deles.

create or replace function public._teto_comissao_manual(v numeric)
returns numeric language sql immutable as $$ select least(1000, round(coalesce(v, 0) * 30 / 100)) $$;

create or replace function public.lancar_pedido_vendedor(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null, p_valor numeric default null, p_comissao numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare nid bigint; vd public.vendedores%rowtype; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; com numeric; tet numeric;
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
  if exists (select 1 from public.bloqueios x where x.lancha = p_lancha and x.data = p_data and not coalesce(x.revenda, false) and public.choca_horario(x.horario, p_horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha'; end if;
  v := public.preco_tabela(p_lancha, p_data, p_horario);  -- valor da lancha: sempre o da tabela, o vendedor não muda (revisão 2026-11-01)
  if v is null or v <= 0 then raise exception 'Essa lancha não tem preço de tabela nesse dia. Fale com o Rodrigo'; end if;
  com := round(coalesce(p_comissao, 0)); tet := public._teto_comissao_manual(v);
  if com < 0 or com > tet then raise exception 'A comissão vai de R$ 0 até R$ % (no máximo R$ 1.000 e 30%% do valor)', tet; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 20 then raise exception 'Limite de pedidos do dia'; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, vendedor, comissao_vend, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang,
                                valor, hora_ini, hora_fim, obs)
    values (true, now(), auth.uid(), auth.uid(), com, p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            lower(trim(p_email)), case when p_lang in ('pt','en','es') then p_lang else 'pt' end,
            v + com,  -- o cliente paga o valor da lancha + a comissão do vendedor (Rodrigo 2026-10-31)
            p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''))
    returning id into nid;
  return nid;
end $function$;

create or replace function public.oferta_vendedor(lancha text, data date, horario text, pessoas integer, comissao numeric)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v public.vendedores%rowtype; novo uuid; pr numeric;
begin
  select * into v from public.vendedores where user_id = auth.uid() and ativo;
  if v.user_id is null or coalesce(v.parceiro, false) then raise exception 'vendedor'; end if;
  if data < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'data'; end if;
  if horario not in ('manha','tarde','dia','noite') then raise exception 'horario'; end if;
  pr := public.preco_tabela(oferta_vendedor.lancha, oferta_vendedor.data, oferta_vendedor.horario);
  if comissao is null or comissao < 0 or comissao > case when pr > 0 then public._teto_comissao_manual(pr) else 1000 end then raise exception 'comissao'; end if;
  if (select count(*) from public.ofertas o where o.vendedor = v.user_id and o.criado_em > now() - interval '1 day') >= 200 then raise exception 'muitos'; end if;
  insert into public.ofertas (lancha, data, horario, pessoas, valor, criado_por, vendedor, comissao)
    values (oferta_vendedor.lancha, oferta_vendedor.data, oferta_vendedor.horario, nullif(oferta_vendedor.pessoas, 0), null, v.user_id, v.user_id, round(oferta_vendedor.comissao))
    returning id into novo;
  return novo;
end $function$;

-- 5% fixo para todos os vendedores (parceiros ficam como estão)
update public.vendedores set pcts = '{"baixa": 5, "media": 5, "alta": 5}'::jsonb where not coalesce(parceiro, false);

create or replace function public.salvar_pcts(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare pa boolean; out jsonb := '{"baixa": 5, "media": 5, "alta": 5}'::jsonb;
begin
  select parceiro into pa from vendedores where user_id = auth.uid() and ativo;
  if not found then raise exception 'Você não é vendedor'; end if;
  if pa then raise exception 'parceiro' using errcode = 'P0001'; end if;
  update vendedores set pcts = out where user_id = auth.uid(); -- a % do link é fixa em 5% (Rodrigo 2026-11-02)
  return out;
end $function$;

revoke all on function public._teto_comissao_manual(numeric) from public, anon;
notify pgrst, 'reload schema';

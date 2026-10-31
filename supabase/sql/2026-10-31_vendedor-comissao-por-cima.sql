-- Búzios Lanchas, 2026-10-31: o vendedor lança a venda pelo app e a comissão dele vai POR CIMA do valor da tabela
-- (igual ao link do vendedor: o cliente paga tabela + comissão; a Búzios Lanchas não perde a parte dela).
-- Rode no Supabase › SQL Editor. Só troca a função lancar_pedido_vendedor; nada é apagado.
CREATE OR REPLACE FUNCTION public.lancar_pedido_vendedor(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text DEFAULT NULL::text, p_valor numeric DEFAULT NULL::numeric, p_comissao numeric DEFAULT NULL::numeric, p_hora_ini text DEFAULT NULL::text, p_hora_fim text DEFAULT NULL::text, p_obs text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if exists (select 1 from public.bloqueios x where x.lancha = p_lancha and x.data = p_data and not coalesce(x.revenda, false) and public.choca_horario(x.horario, p_horario)) then
    raise exception 'Esse horário já está ocupado nessa lancha'; end if;
  v := public._confere_valor_op(p_lancha, p_data, p_horario, p_valor);  -- valor da lancha: mesmo teto e mínimo do suporte
  com := round(coalesce(p_comissao, 0));
  if com < 0 or (v is not null and com > round(v * coalesce(vd.teto_pct, 10) / 100)) then
    raise exception 'A comissão vai de R$ 0 até % %% do valor (R$ %)', coalesce(vd.teto_pct, 10), round(coalesce(v, 0) * coalesce(vd.teto_pct, 10) / 100); end if;
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

-- Conferir (deve mostrar "v + com"):
select position('v + com' in pg_get_functiondef('public.lancar_pedido_vendedor'::regproc)) > 0 as comissao_por_cima;

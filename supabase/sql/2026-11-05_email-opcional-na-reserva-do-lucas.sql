-- E-mail do cliente opcional quando o Lucas (operador) ou o admin lança uma reserva (Rodrigo 2026-11-05).
-- Sem e-mail, a cobrança e o convite vão pelo WhatsApp do cliente.
alter table public.consultas alter column email drop not null;

CREATE OR REPLACE FUNCTION public.lancar_pedido_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer, p_nome text, p_tel text, p_email text, p_lang text, p_embarque text DEFAULT NULL::text, p_valor numeric DEFAULT NULL::numeric, p_sinal numeric DEFAULT NULL::numeric, p_hora_ini text DEFAULT NULL::text, p_hora_fim text DEFAULT NULL::text, p_obs text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nid bigint; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        em text := nullif(lower(trim(coalesce(p_email,''))), '');
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'Escreva nome e sobrenome do cliente'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'WhatsApp do cliente inválido'; end if;
  if em is not null and (em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(em) > 200) then raise exception 'E-mail do cliente inválido'; end if;
  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario,''), p_data) then raise exception 'Horário inválido'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > public._capacidade(p_lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(p_lancha); end if;
  if length(coalesce(p_embarque,'')) > 120 or length(coalesce(p_obs,'')) > 300 then raise exception 'Texto longo demais'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim > p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  v := public._confere_valor_op(p_lancha, p_data, p_horario, p_valor, p_pessoas);  -- grupo pequeno da Miss Bardot pode descer mais
  if p_sinal is not null and (p_sinal < 0 or (v is not null and p_sinal > v) or (p_sinal > 0 and v is not null and p_sinal < ceil(v * 0.1))) then
    raise exception 'Sinal inválido: zero (pré-reserva) ou de 10%% até o valor'; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 60 then raise exception 'Limite de pedidos do dia'; end if;
  -- mesmo cliente, lancha e dia: só atualiza a consulta que o próprio operador lançou; a do site fica como está
  update public.consultas set horario = p_horario, pessoas = p_pessoas, embarque = nullif(trim(coalesce(p_embarque,'')),''), nome = trim(p_nome),
         email = coalesce(em, email), chamou = true, wa_resposta_em = coalesce(wa_resposta_em, now()),
         valor = v, sinal = p_sinal, hora_ini = p_hora_ini, hora_fim = p_hora_fim, obs = nullif(trim(coalesce(p_obs,'')),'')
   where criado_por is not null and (criado_por = auth.uid() or public.e_admin()) and recusada_em is null and regexp_replace(telefone,'\D','','g') = dig and lancha = p_lancha and data = p_data returning id into nid;
  if nid is not null then return nid; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang, valor, sinal, hora_ini, hora_fim, obs)
    values (true, now(), auth.uid(), p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            em, case when p_lang in ('pt','en','es') then p_lang else 'pt' end, v, p_sinal, p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''))
    returning id into nid;
  return nid;
end $function$;

-- Conferir (deve dar email_opcional = true):
select (select is_nullable = 'YES' from information_schema.columns where table_schema='public' and table_name='consultas' and column_name='email')
   and (select prosrc ilike '%em is not null and%' from pg_proc where proname='lancar_pedido_operador') as email_opcional;

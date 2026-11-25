-- publicar: auto
-- Consulta do site sem e-mail (2026-11-25): cliente que criou conta só com nome e WhatsApp
-- (popup do cupom de boas-vindas) não tem e-mail; criar_consulta recusava ('email') e a consulta
-- não chegava ao painel nem ao dono (caso Marcelo, Bordazul, 24/11). E-mail agora é opcional:
-- vazio vira null; preenchido continua validado.
CREATE OR REPLACE FUNCTION public.criar_consulta(p_chave uuid, p_chamou boolean, p_lancha text, p_data date, p_horario text, p_pessoas integer, p_embarque text, p_nome text, p_tel text, p_email text, p_lang text, p_pais text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nid bigint; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g');
  pa text := case when upper(coalesce(p_pais,'')) ~ '^[A-Z]{2}$' then upper(p_pais) end;
  em text := nullif(lower(trim(coalesce(p_email,''))), '');
begin
  if length(trim(coalesce(p_nome,''))) < 2 or length(p_nome) > 120 or p_nome ~* '(https?://|www[.]|[.](com|br|net|org|io|me|ly)\M|@|[0-9]{4,})' then raise exception 'nome'; end if;
  if length(dig) < 8 or length(dig) > 16 then raise exception 'telefone'; end if;
  if em is not null and (em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(em) > 200) then raise exception 'email'; end if;
  if p_data < current_date or p_data > current_date + 800 then raise exception 'data'; end if;
  if coalesce(p_lancha,'') !~ '^[a-z0-9-]{1,80}$' or coalesce(p_horario,'') not in ('manha','tarde','dia','noite')
     or p_pessoas is null or p_pessoas < 1 or p_pessoas > 100 or length(coalesce(p_embarque,'')) > 120 then raise exception 'dados'; end if;
  update consultas set lancha = p_lancha, data = p_data, horario = p_horario, pessoas = p_pessoas, embarque = nullif(p_embarque,''), nome = trim(p_nome), telefone = trim(p_tel), email = coalesce(em, email), chamou = chamou or coalesce(p_chamou,false), pais = coalesce(pa, pais)
    where chave = p_chave returning id into nid;
  if nid is not null then return nid; end if;
  if (select count(*) from consultas where regexp_replace(telefone,'\D','','g') = dig and criado_em > now() - interval '1 day') >= 5 then raise exception 'limite'; end if;
  if (select count(*) from consultas where criado_em > now() - interval '1 day') >= 300 then raise exception 'limite'; end if;
  -- mesma pessoa, mesma lancha e mesmo dia: só atualiza horário e pessoas (não troca nome, e-mail nem dispara outro aviso)
  update consultas set horario = p_horario, pessoas = p_pessoas, embarque = nullif(p_embarque,''), chamou = chamou or coalesce(p_chamou,false), pais = coalesce(pais, pa)
    where regexp_replace(telefone,'\D','','g') = dig and lancha = p_lancha and data = p_data returning id into nid;
  if nid is not null then return nid; end if;
  insert into consultas (chave, chamou, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang, pais)
    values (p_chave, coalesce(p_chamou,false), p_lancha, p_data, p_horario, p_pessoas, nullif(p_embarque,''), trim(p_nome), trim(p_tel), em, case when p_lang in ('pt','en','es') then p_lang else 'pt' end, pa)
    returning id into nid;
  return nid;
end $function$;

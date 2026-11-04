-- 2026-11-04 (Rodrigo): quando o passeio vira crédito, guardar todos os dados dele,
-- para que, se o cliente voltar, a reserva volte exatamente como estava (embarque, horário, marinheiro, valor, obs...).
alter table public.creditos add column if not exists passeio jsonb;

create or replace function public.virar_credito(bid bigint, ate date, v numeric DEFAULT NULL::numeric)
 returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; c public.creditos%rowtype; tel text; val numeric;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.e_admin() then raise exception 'Só o administrador transforma em crédito'; end if;
  select * into b from public.bloqueios where id = bid for update;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if b.id is null or a.bloqueio_id is null then raise exception 'Passeio não encontrado'; end if;
  if a.origem is distinct from 'buzios' then raise exception 'Só passeio fechado pela Búzios Lanchas vira crédito'; end if;
  if not (coalesce(a.sinal, 0) > 0) then raise exception 'Este passeio não tem sinal pago'; end if;
  if b.data < hoje then raise exception 'A data deste passeio já passou'; end if;
  val := coalesce(v, a.sinal);
  if not (val > 0 and val <= 99999) then raise exception 'Valor do crédito inválido'; end if;
  if ate is null or ate <= hoje or ate > hoje + interval '2 years' then raise exception 'Escolha uma validade entre amanhã e 2 anos'; end if;
  tel := coalesce(nullif(btrim(a.telefone), ''), (select whatsapp from public.clientes where user_id = a.cliente_conta));
  insert into public.creditos (cliente, nome, telefone, lancha, valor, valido_ate, origem_data, origem_horario, origem_bloqueio, obs, passeio)
    values (a.cliente_conta, nullif(btrim(a.cliente), ''), tel, b.lancha, val, ate, b.data, b.horario, b.id, nullif(btrim(a.obs), ''),
            jsonb_build_object('bloqueio', to_jsonb(b), 'anotacao', to_jsonb(a))) -- cópia do passeio, para voltar igual
    returning * into c;
  perform public._credito_chat(c, 'novo');
  update public.pedidos set motivo = 'credito' where bloqueio_id = bid and status in ('aprovado', 'pendente');
  delete from public.bloqueios where id = bid; -- o gatilho cancela o pedido ligado; a data fica livre
  return c.id;
end $function$;

-- conferir
select column_name from information_schema.columns where table_name = 'creditos' and column_name = 'passeio';

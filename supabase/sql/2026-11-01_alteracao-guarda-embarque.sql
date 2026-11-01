-- Búzios Lanchas, 2026-11-01: a alteração feita pelo formulário passa a guardar também o local de embarque de antes.
-- Sem isso, se a página recarregar antes de mandar o WhatsApp, a mensagem ao cliente perde o "novo local" (mapa e taxa).
-- Rode no Supabase › SQL Editor. Só troca a função registrar_alteracao; nada é apagado.
CREATE OR REPLACE FUNCTION public.registrar_alteracao(bid bigint, p_antes jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b record; a record; nid bigint;
begin
  if not public.e_admin() then raise exception 'Sem acesso'; end if;
  if jsonb_typeof(p_antes) <> 'object' then raise exception 'Dados inválidos'; end if;
  select * into b from public.bloqueios where id = bid;
  if b.id is null then raise exception 'Passeio não encontrado'; end if;
  select * into a from public.anotacoes where bloqueio_id = bid;
  insert into public.alteracoes_pedidas (bloqueio_id, criado_por, nova_lancha, nova_data, novo_horario, novas_pessoas, novo_valor, hora_ini, hora_fim,
                                         status, resolvido_em, antes, motivo)
    values (bid, auth.uid(), b.lancha, b.data, b.horario, a.pessoas, a.valor, a.hora_ini, a.hora_fim, 'aprovada', now(),
            jsonb_build_object('lancha', p_antes->>'lancha', 'data', p_antes->>'data', 'horario', p_antes->>'horario', 'pessoas', p_antes->'pessoas',
                               'valor', p_antes->'valor', 'hora_ini', p_antes->>'hora_ini', 'hora_fim', p_antes->>'hora_fim',
                               'embarque', left(p_antes->>'embarque', 120)), 'formulário')
    returning id into nid;
  return nid;
end $function$;

-- Conferir (deve mostrar true):
select position('''embarque''' in pg_get_functiondef('public.registrar_alteracao'::regproc)) > 0 as guarda_embarque;

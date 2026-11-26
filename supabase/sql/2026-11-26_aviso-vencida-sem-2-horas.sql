-- publicar: auto
-- 26/11/2026 (revisão diária): o aviso de pré-reserva vencida prometia "um novo prazo curto, de 2 horas", mas desde o
-- PR #1359 o relançamento dá 40 min no mesmo dia e 1 h na véspera (2 h só com 2 dias ou mais). O texto do chat do app
-- passa a dizer só "um novo prazo curto", sem número, para não prometer ao cliente um prazo que ele não vai ter.
-- Idempotente: só troca se o texto antigo ainda estiver na função.
do $do$
declare def text;
begin
  def := pg_get_functiondef('public.vencer_pre_pedidos'::regproc);
  if position('liberamos um novo prazo curto, de 2 horas, para o pagamento' in def) > 0 then
    def := replace(def, 'liberamos um novo prazo curto, de 2 horas, para o pagamento', 'liberamos um novo prazo curto para o pagamento');
    execute def;
  end if;
end $do$;

-- Miss Bardot fica fora do prazo curto de pré-reserva vencida (regra do Rodrigo de 25/11: o fluxo de vencida nunca vale
-- para a Miss Bardot). O gatilho conferia só telefone + data, sem olhar a lancha.
do $do$
declare def text;
begin
  def := pg_get_functiondef('public.tg_pre_vencida_prazo_curto'::regproc);
  if position('miss-bardot' in def) = 0 then
    def := replace(def,
      'if not found or b.criado_em < now() - interval ''15 minutes'' then return null; end if;',
      'if not found or b.criado_em < now() - interval ''15 minutes'' then return null; end if;
  if b.lancha = ''miss-bardot'' then return null; end if; -- Miss Bardot nunca entra no fluxo de vencida (Rodrigo 25/11)');
    if position('miss-bardot' in def) = 0 then raise exception 'trecho do gatilho não encontrado'; end if;
    execute def;
  end if;
end $do$;

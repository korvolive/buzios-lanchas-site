-- publicar: auto
-- 25/11/2026 (teste E2E do relançamento): o lançamento do Lucas/operador aceitava pré-reserva para um horário de HOJE
-- que já tinha começado (ex.: tarde às 15h48). Regra do site: venda no mesmo dia fecha 1 h antes do início.
-- Agora a pré-reserva (sinal zero ou vazio) de hoje com início em menos de 1 h é recusada com mensagem clara.
-- Lançamento com sinal já pago (sinal > 0) continua liberado (registro de venda feita por fora). Idempotente.
do $do$
declare def text;
begin
  def := pg_get_functiondef('public.lancar_pedido_operador'::regproc);
  if position('Horário de hoje já fechado' in def) = 0 then
    def := replace(def, $a$  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;$a$,
      $a$  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if p_data = hoje and coalesce(p_sinal, 0) = 0 and public._horario_ok(coalesce(p_horario,''), p_data)
     and public.inicio_combinado(p_data, p_horario, p_hora_ini, null) - interval '1 hour' <= (now() at time zone 'America/Sao_Paulo') then
    raise exception 'Horário de hoje já fechado para venda (fecha 1 h antes do passeio)'; end if;$a$);
    if position('Horário de hoje já fechado' in def) = 0 then raise exception 'lancar_pedido_operador mudou: ajuste o SQL'; end if;
    execute def;
  end if;
end $do$;

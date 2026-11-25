-- publicar: auto
-- 25/11/2026 (Rodrigo): relançamento direto de pré-reserva vencida (mesma lancha, data e horário, dono ainda não
-- avisado) não pode mandar ao dono de novo "já foi aprovada". O _aprovar_consulta apaga a consulta do Lucas e o
-- gatilho tg_consulta_aprovada_avisa_dono criava uma linha em aprovacoes_dono (avisarResolvidas mandava o modelo).
-- Agora lancar_reserva_operador liga app.relancamento=1 só nesse caso e o gatilho não faz nada. Idempotente.
do $do$
declare def text;
begin
  def := pg_get_functiondef('public.tg_consulta_aprovada_avisa_dono'::regproc);
  if position('app.relancamento' in def) = 0 then
    def := replace(def, 'begin
  if old.criado_por is null', 'begin
  if current_setting(''app.relancamento'', true) = ''1'' then return old; end if; -- relançamento de vencida: o dono não é avisado de novo
  if old.criado_por is null');
    if position('app.relancamento' in def) = 0 then raise exception 'tg_consulta_aprovada_avisa_dono mudou: ajuste o SQL'; end if;
    execute def;
  end if;

  def := pg_get_functiondef('public.lancar_reserva_operador'::regproc);
  if position('app.relancamento' in def) = 0 then
    def := replace(def, '  perform set_config(''app.auto_op'', ''1'', true);
  r := public._aprovar_consulta(nid, false);
  perform set_config(''app.auto_op'', '''', true);',
      '  perform set_config(''app.auto_op'', ''1'', true);
  if relanca then perform set_config(''app.relancamento'', ''1'', true); end if;
  r := public._aprovar_consulta(nid, false);
  perform set_config(''app.relancamento'', '''', true);
  perform set_config(''app.auto_op'', '''', true);');
    if position('app.relancamento' in def) = 0 then raise exception 'lancar_reserva_operador mudou: ajuste o SQL'; end if;
    execute def;
  end if;
end $do$;

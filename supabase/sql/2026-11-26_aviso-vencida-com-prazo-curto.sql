-- publicar: auto
-- 26/11/2026 (Rodrigo): prazo curto se fala, para o cliente pagar rápido. O aviso de pré-reserva vencida no chat do app
-- passa a dizer o prazo do relançamento pelo dia do passeio: mesmo dia 40 minutos, véspera 1 hora, 2 dias ou mais 2 horas
-- (as mesmas faixas do _vencida_relancavel / PR #1359). Idempotente: só troca se o texto sem número ainda estiver na função.
do $do$
declare def text;
begin
  def := pg_get_functiondef('public.vencer_pre_pedidos'::regproc);
  if position('liberamos um novo prazo curto para o pagamento' in def) > 0 then
    def := replace(def,
      '''O prazo para pagar o sinal terminou, e a lancha voltou a ficar disponível para outras pessoas. Você ainda tem interesse? Se quiser, liberamos um novo prazo curto para o pagamento. É só responder aqui.''',
      '''O prazo para pagar o sinal terminou, e a lancha voltou a ficar disponível para outras pessoas. Você ainda tem interesse? Se quiser, liberamos um novo prazo curto, de ''
          || case when r.data <= (now() at time zone ''America/Sao_Paulo'')::date then ''40 minutos''
                  when r.data = (now() at time zone ''America/Sao_Paulo'')::date + 1 then ''1 hora'' else ''2 horas'' end
          || '', para o pagamento. É só responder aqui.''');
    if position('40 minutos' in def) = 0 then raise exception 'texto do aviso não encontrado'; end if;
    execute def;
  end if;
end $do$;

-- publicar: auto
-- Revisão diária 20/11: cliente que cria pedido direto pela API não pode marcar campos de controle novos
-- (PayPal liberado por exceção, repasses do jet ski, avisos). Só o admin ou o servidor preenche.
-- Idempotente: só recria a função do gatilho (BEFORE INSERT em pedidos).
CREATE OR REPLACE FUNCTION public.limpa_pedido_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user not in ('authenticated','anon') or public.e_admin() then return new; end if;
  new.sinal_valor := null; new.sinal_liberado_em := null; new.comprovante := null; new.comprovante_em := null;
  new.paypal_link := null; new.paypal_valor := null; new.avisado_em := null; new.vendedor_avisado_em := null; new.motivo := null;
  new.repasse_dono := null; new.comissao_comprovante := null; new.comissao_pct := null;
  new.comissao_antecipada := null; new.comissao_antecipada_aviso := null; new.prazo_vencido_em := null;
  new.pp_excecao := false; new.aviso_cartao_em := null; new.wa_central_em := null;
  new.jetski_repasse := null; new.jetski_repasse_em := null; new.jetski_metade1 := null;
  new.jetski_repasse2 := null; new.jetski_repasse2_em := null;
  return new;
end $function$;

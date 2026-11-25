-- publicar: auto
-- Búzios Lanchas (Rodrigo 2026-11-25): lancha com aprovação automática libera o link sozinha também quando o cliente usa cupom.
-- Antes mb_libera_sinal_sozinho pulava pedido com cupom (ficava esperando "Liberar" no painel). Agora libera com o sinal certo:
-- cupom sai do total e o resto divide 50/50 (ver 2026-11-25_sinal-com-cupom-descontado.sql). Vendedor, oferta e parceiro seguem como antes.
-- Idempotente: só troca se o texto antigo ainda estiver na função; se nem o antigo nem o novo existirem, para com erro.
do $mig$
declare d text; t jsonb;
  trocas jsonb := jsonb_build_array(
    jsonb_build_object('novo', 'or new.vendedor is not null or new.oferta is not null',
      'velho', 'or new.vendedor is not null or new.cupom is not null or new.oferta is not null',
      'nova',  'or new.vendedor is not null or new.oferta is not null'),
    jsonb_build_object('novo', '- coalesce(new.cupom_valor, 0), 0) / 2, 2)',
      'velho', 'v := round(coalesce(public._valor_na_data(new.lancha, new.data, new.horario, false), 0) / 2, 2);',
      'nova',  'v := round(greatest(coalesce(public._valor_na_data(new.lancha, new.data, new.horario, false), 0) - coalesce(new.cupom_valor, 0), 0) / 2, 2); -- cupom sai do total (2026-11-25)'));
begin
  for t in select * from jsonb_array_elements(trocas) loop
    d := pg_get_functiondef('public.mb_libera_sinal_sozinho()'::regprocedure);
    if position(t->>'novo' in d) > 0 then continue; end if;
    if position(t->>'velho' in d) = 0 then raise exception 'texto antigo não encontrado em mb_libera_sinal_sozinho'; end if;
    execute replace(d, t->>'velho', t->>'nova');
  end loop;
end $mig$;

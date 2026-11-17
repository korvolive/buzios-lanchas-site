-- publicar: auto
-- Nenhum valor abaixo de zero, nunca (Rodrigo 2026-11-17: digitou "270-" em "Búzios a mais no Réveillon" e o painel aceitou).
-- Trava no banco: CHECK (coluna >= 0) em todas as colunas de valor (preços, %, comissões, descontos, pessoas, minutos, horas).
-- Vale para qualquer caminho de gravação: tela, RPC, função do servidor, n8n.
-- Levantamento antes de publicar: nenhuma linha com valor negativo nas colunas numéricas nem nos JSON de preços.
-- Por segurança, se aparecer algum negativo até a publicação, ele vira 0 antes da trava. Idempotente.
do $$
declare
  alvo text[] := array[
    'alteracoes_pedidas:novas_pessoas,novo_valor,cond_valor_dia',
    'anotacoes:pessoas,valor,sinal,cond_valor,sinal_combinado,neto_dono',
    'asaas_config:pix_fixo,cartao_pct,cartao_fixo,antecipacao_pct,cartao_pct_2a6,antecipacao_parc_pct',
    'asaas_validacoes:valor',
    'avaliacoes:nota,nota_marinheiro',
    'consultas:pessoas,comissao_pct,valor,sinal,comissao_vend,jetski_min,neto_garantido',
    'consultas_ref:comissao',
    'convites_socio:pct',
    'cotacoes_garantidas:valor,tabela,neto',
    'creditos:valor',
    'cupom_dono:valor',
    'cupons:valor',
    'descontos_grupo:max_pessoas,pct',
    'freelancers:diaria',
    'jetski_usos:minutos,cortesia_min,valor,neto',
    'jetskis:pessoas,min_minutos,neto_hora,cortesia_min',
    'ofertas:valor,pessoas,comissao',
    'pagamentos_asaas:valor,sinal,repasse',
    'pagamentos_pp:valor',
    'passeio_preco_base:preco_base',
    'pedidos:pessoas,sinal_valor,acrescimo_pct,preco_base,preco_cliente,cupom_valor,repasse_dono,cupom_dono,comissao_pct,desc_parceiro,bz_pct,jetski_min,jetski_valor,jetski_neto,jetski_cortesia',
    'precos:baixa,media,alta,pico,reveillon,h7,baixa7,media7,alta7,pico7,reveillon7,pct_feriado,pct_reveillon,pct_reveillon7,bz_reveillon,bz_reveillon7,pct_carnaval,pct_carnaval7,bz_carnaval,bz_carnaval7,baixa3,media3,alta3,pico3,reveillon3',
    'precos_neto:neto,comissao,ref,taxa_pct',
    'repasses_pp:valor',
    'saques:valor',
    'transferencias_saldo:valor',
    'vendas_manuais:comissao',
    'vendedores:teto_pct,indicacao_pct,bz_pct,cupom_boas_vindas,desc_pct'
  ];
  -- JSON com valores digitados (desconto seg-qui, especiais, % do vendedor, preços do jet ski)
  alvo_json text[] := array['precos:desc_semana,especiais', 'vendedores:pcts', 'jetskis:precos'];
  item text; tb text; col text; cn text;
begin
  foreach item in array alvo loop
    tb := split_part(item, ':', 1);
    foreach col in array string_to_array(split_part(item, ':', 2), ',') loop
      continue when not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name=tb and column_name=col);
      cn := left(tb || '_' || col || '_nao_negativo', 63);
      continue when exists (select 1 from pg_constraint where conname = cn and conrelid = ('public.'||tb)::regclass);
      execute format('update public.%I set %I = 0 where %I < 0', tb, col, col);
      execute format('alter table public.%I add constraint %I check (%I >= 0)', tb, cn, col);
    end loop;
  end loop;
  foreach item in array alvo_json loop
    tb := split_part(item, ':', 1);
    foreach col in array string_to_array(split_part(item, ':', 2), ',') loop
      continue when not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name=tb and column_name=col);
      cn := left(tb || '_' || col || '_nao_negativo', 63);
      continue when exists (select 1 from pg_constraint where conname = cn and conrelid = ('public.'||tb)::regclass);
      -- número negativo em qualquer chave do JSON ("baixa": -10)
      execute format($q$alter table public.%I add constraint %I check (%I is null or %I::text !~ '":\s*-[0-9]')$q$, tb, cn, col, col);
    end loop;
  end loop;
end $$;

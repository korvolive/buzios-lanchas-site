# Graph Report - buzios-lanchas-site  (2026-11-25)

## Corpus Check
- 312 files · ~545,200 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .xml 3, .tflite 2, .webmanifest 2)

## Summary
- 2186 nodes · 3663 edges · 199 communities (105 shown, 94 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b8bbcf8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- paginas.mjs
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- dono-aprovacao/index.ts
- public.pedidos
- paypal-checkout/index.ts
- public._ligar_passeio
- prerender.mjs
- env
- steps
- steps
- steps
- public.jetskis
- clima-site/index.ts
- clima-alertas/index.ts
- public.pedidos
- consulta-resgate/index.ts
- public.relatorio_lucro
- public
- pedido-indisponivel/index.ts
- contato
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- pedidos
- aviso-seguranca/index.ts
- aviso-chat/index.ts
- consulta-aviso/index.ts
- avaliacao/index.ts
- central-auto/index.ts
- public.revisao_dados
- public.cupons
- public._pre_reserva_volta
- public.relatorio_lucro
- steps
- donos
- traduzir/index.ts
- asaas-saques/index.ts
- login/sw.js
- aviso-sinal/index.ts
- fotos-db.py
- 2026-11-15_preco-cotado-garantido.sql
- cambio/index.ts
- public.creditos
- 2026-11-16_bordazul-cadastro-dono.sql
- README.md
- steps
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- 2026-11-15_jetski-pedido.sql
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- asaas-transferir/index.ts
- aviso-lucas/index.ts
- public.marcar_wa
- public.bloqueios
- 2026-11-08_app-versao-minima.sql
- asaas-docs/index.ts
- steps
- public.donos
- claude-noturno.mjs
- 2026-11-13_transferir-saldo.sql
- ref_npm_web_push_3_6_7
- public.pedido_oferta
- public.tg_anotacao_jetski_segura
- asaas-saude/index.ts
- public.anotacoes
- marca.js
- 2026-11-16_convite-consulta-vencida.sql
- public.pagamentos_pp
- asaas-chaves-girar/index.ts
- env
- aviso-aprovacao/index.ts
- bordazul-anunciar/index.ts
- 2026-11-22_zzzz-termo-aceite.sql
- 2026-11-19_rastreio-server-side.sql
- 2026-11-17_aviso-dinheiro-na-conta.sql
- sem-negativo.js
- ref_node_fs
- public._valor_na_data
- aviso-vendedor/index.ts
- trava_cond_aviso
- registros-exportar.mjs
- asaas_contas_reenvio_token
- public.bloqueios
- public.tg_tel_padrao
- 2026-11-16_consultas-site-fecham-sozinhas.sql
- 2026-11-17_paypal-cai-no-asaas-repasse-auto.sql
- 2026-11-17_retencao-registros-5-anos.sql
- 2026-11-20_lucas-revisao-noturna.sql
- v
- API
- public.adicionar_lancha_pre_reserva
- conversoes/index.ts
- 2026-11-18_textos-claude.sql
- public.liberar_sinal
- public._soltar_anterior_mesmo_cliente
- public.salvar_netos_v2
- enviarSaldos
- asaas
- entrar-celular/index.ts
- caixaPedido
- public.mover_passeio_v2
- public._convite_pagar
- 2026-10-30_operador-um-toque.sql
- ref_npm_supabase
- whatsapp-webhook/index.ts
- 2026-11-23_comissao-20-e-referencia-mercado.sql
- 2026-11-20_saque-buzios.sql
- 2026-11-22_zzzzz-horario-real-sem-sobreposicao.sql
- public.vendedor_do_cliente
- 2026-11-21_bordazul-dono-confirma.sql
- whatsapp-codigo/index.ts
- public
- public._aprovar_consulta
- 2026-11-22_zzzzz-horario-real-sem-sobreposicao.sql
- public.cliques_google
- public.consultas
- db-mudou.mjs
- traduzir-chat/index.ts
- 2026-11-20_cupom-boas-vindas-site.sql
- paypal-fatura/index.ts
- convite_manual_marca_aviso
- conversoes-navegador.js
- 2026-11-22_zzzzzzzz-funil-link-vendedor.sql
- public.meus_clientes_venda
- auth.users
- public.consultas
- 2026-11-15_jetski-lucas.sql
- public.lancar_pedido_operador
- public.meus_clientes_venda
- public.papeis_painel

## God Nodes (most connected - your core abstractions)
1. `public.jetskis` - 35 edges
2. `public.jetski_usos` - 30 edges
3. `avisarDonos()` - 19 edges
4. `public.adicionar_lancha_pre_reserva()` - 19 edges
5. `asaas()` - 18 edges
6. `public._ligar_passeio()` - 17 edges
7. `prazosDono()` - 16 edges
8. `enviarSaldos()` - 14 edges
9. `public._ligar_passeio()` - 14 edges
10. `public.cancelar_pre_reserva()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `public._pre_vencida_recente()` --reads_from--> `public.auditoria`  [EXTRACTED]
  supabase/sql/2026-11-25_pre-reserva-vencida-prazo-curto.sql → supabase/sql/2026-11-13_auditoria-e-registro-de-acessos.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-lucas.sql → supabase/sql/2026-11-15_jetski.sql
- `jetski_cortesia_mesmo_dono` --triggers--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-19_jetski-cortesia-varias-lanchas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.jetskis_site()` --reads_from--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-19_jetski-cortesia-varias-lanchas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.jetskis_site_v2()` --reads_from--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-19_jetski-cortesia-varias-lanchas.sql → supabase/sql/2026-11-15_jetski.sql

## Import Cycles
- None detected.

## Communities (199 total, 94 thin omitted)

### Community 0 - "paginas.mjs"
Cohesion: 0.22
Nodes (11): boatPath(), C, esc(), faqPreco, gerarPaginas(), guiaPath(), GUIAS, homePath() (+3 more)

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.07
Nodes (29): APROVADA, AV_DEV, carregar(), cliente(), cnpjOk(), comQuem(), CORS, cpfOk() (+21 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.07
Nodes (46): apnsToken(), ASSUNTO, autoConfirma(), avaliacaoPausada(), avisarCredito(), b64u(), brl(), brlCred() (+38 more)

### Community 4 - "dono-aprovacao/index.ts"
Cohesion: 0.11
Nodes (42): admins(), apnsToken(), aprovado(), avisarCliente(), avisarClienteDemora(), avisarDonos(), avisarResolvidas(), brl() (+34 more)

### Community 5 - "public.pedidos"
Cohesion: 0.15
Nodes (13): pre_pedido_fim, pre_pedido_sinal, public._pre_pedido_fim(), public._pre_pedido_sinal(), public.definir_condicional(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar() (+5 more)

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.06
Nodes (49): aceitarPreco(), ajustarGrupo(), avisarAdmins(), brlv(), carregar(), COB_EUR, comQuem(), confirmarSozinho() (+41 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.15
Nodes (8): public.aprovar_consulta(), public._ligar_passeio(), public._ligar_passeio(), anotacoes_grupo_idx, public.aprovar_grupo(), public.lancar_grupo_operador(), public._ligar_passeio(), public._pre_pedido_fim()

### Community 8 - "prerender.mjs"
Cohesion: 0.13
Nodes (16): alt(), boatUrl(), DB_READ, FC, guias, LANGS, pages, pathFor() (+8 more)

### Community 9 - "env"
Cohesion: 0.06
Nodes (35): concurrency, cancel-in-progress, group, ANTHROPIC_API_KEY, LIMITE_MES_USD, SIMULAR, SUPABASE_ACCESS_TOKEN, TAREFAS (+27 more)

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.05
Nodes (36): concurrency, cancel-in-progress, group, runs-on, steps, APPLE_TEAM_ID, FTP_PASSWORD, FTP_SERVER (+28 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "public.jetskis"
Cohesion: 0.07
Nodes (36): public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), jetski_uso_confere, jetski_usos_dia, public._jetski_confere(), public.tg_pedido_jetski(), public.tg_pedido_jetski_segurado(), public.jetski_choca() (+28 more)

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "public.pedidos"
Cohesion: 0.08
Nodes (23): public.mb_libera_sinal_sozinho(), public.jetski_avisa_conflito(), a_msg_expirou_pre_reserva, a_pre_reserva_prazo_vale, public.tg_msg_expirou_pre_reserva(), public.tg_pre_reserva_prazo_vale(), jetski_acertos_pedido_jetski, jetski_cortesia_mesmo_dono (+15 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.15
Nodes (19): avisarPasseios(), convidarVencidas(), d360Key(), dataLonga(), db, dig(), ES_DDI, hm() (+11 more)

### Community 18 - "public.relatorio_lucro"
Cohesion: 0.17
Nodes (4): public._teto_cheio(), public.espelhar_pagamento_grupo(), public.relatorio_lucro(), public.metricas_marketing()

### Community 19 - "public"
Cohesion: 0.13
Nodes (11): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), pre_reserva_volta, public._pre_reserva_volta(), public._confere_valor_op(), public.descontos_grupo, public._piso_grupo() (+3 more)

### Community 20 - "pedido-indisponivel/index.ts"
Cohesion: 0.17
Nodes (12): CORS, dataBR(), db, ddiLang(), email(), ES_DDI, lang(), livres() (+4 more)

### Community 21 - "contato"
Cohesion: 0.18
Nodes (18): avisarAcertosJetski(), avisarAdmins(), avisarAntecipadas(), avisarAprovada(), avisarExpirou(), avisarPassou(), brl(), cancelar() (+10 more)

### Community 22 - "steps"
Cohesion: 0.15
Nodes (12): jobs, prerender, name, on, pull_request, runs-on, steps, name (+4 more)

### Community 23 - "convite-email/index.ts"
Cohesion: 0.15
Nodes (8): CORS, db, ES_DDI, LIGA, MAPA, SLOT, TAXA, TAXA_TXT

### Community 24 - "cadastro-whatsapp/index.ts"
Cohesion: 0.22
Nodes (9): codigoDe(), confere(), CORS, db, dig(), json(), LANG, mandaCodigo() (+1 more)

### Community 25 - "pedidos"
Cohesion: 0.36
Nodes (4): public.minhas_vendas_v2(), public.minhas_indicacoes(), public.minhas_vendas_v2(), public.pagar_indicacao()

### Community 26 - "aviso-seguranca/index.ts"
Cohesion: 0.15
Nodes (20): apnsToken(), ASSUNTO, ASSUNTO_TEL, brl(), chaveTxt(), db, dig(), email() (+12 more)

### Community 27 - "aviso-chat/index.ts"
Cohesion: 0.27
Nodes (7): CORS, dataBR(), db, email(), lang(), pushAll(), T

### Community 28 - "consulta-aviso/index.ts"
Cohesion: 0.22
Nodes (7): avisar(), CORS, db, NOVA, push(), SLOT, TXT

### Community 29 - "avaliacao/index.ts"
Cohesion: 0.22
Nodes (4): CORS, CUP_MSG, db, ES_DDI

### Community 30 - "central-auto/index.ts"
Cohesion: 0.22
Nodes (5): COB_EUR, CORS, db, PAIS_DDI, SYM

### Community 31 - "public.revisao_dados"
Cohesion: 0.16
Nodes (7): public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes(), public.revisao_dados(), public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes(), public.repasses_sem_comprovante(), public.meu_saldo_v2()

### Community 32 - "public.cupons"
Cohesion: 0.26
Nodes (8): cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2(), a1_trava_criado_em, cupom_bv_tel, public.cupom_bv_tel(), public.trava_criado_em_cliente()

### Community 33 - "public._pre_reserva_volta"
Cohesion: 0.15
Nodes (10): public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google(), public.salvar_avaliacao_google(), public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo() (+2 more)

### Community 34 - "public.relatorio_lucro"
Cohesion: 0.27
Nodes (6): public.salvar_lancha(), public.salvar_lancha(), lucro_gastos_data, public.lucro_custos, public.lucro_gastos, public.relatorio_lucro()

### Community 35 - "steps"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, default, description, required, DIAS, PROJECT_REF (+21 more)

### Community 36 - "donos"
Cohesion: 0.14
Nodes (10): public.convites_socio_pendentes(), public.meus_socios(), public.definir_desc_parceiro(), public.definir_pct_vendedor(), public._desc_parceiro(), public.meu_vendedor(), public._preco_vendedor(), public.vendedor_publico() (+2 more)

### Community 37 - "traduzir/index.ts"
Cohesion: 0.47
Nodes (4): CORS, google(), mymemory(), one()

### Community 38 - "asaas-saques/index.ts"
Cohesion: 0.20
Nodes (14): Achado, API(), avisarRecusa(), brl(), db, decidir(), dig(), espera() (+6 more)

### Community 40 - "aviso-sinal/index.ts"
Cohesion: 0.22
Nodes (4): CORS, db, HOR, QUEM

### Community 41 - "fotos-db.py"
Cohesion: 0.07
Nodes (20): destino_options(), e(), main(), pagina(), wa(), abre(), cabe(), corte() (+12 more)

### Community 42 - "2026-11-15_preco-cotado-garantido.sql"
Cohesion: 0.09
Nodes (15): public.aprovar_foto(), public.lancar_pedido_operador(), a_consulta_neto_garantido, cotacoes_garantidas_busca, cotacoes_garantidas_lancha, public.cotacoes_abertas_dono(), public.cotacoes_garantidas, public._garantia_cotacao() (+7 more)

### Community 44 - "public.creditos"
Cohesion: 0.28
Nodes (9): public.codigo_convite(), public._credito_chat(), public.creditos, public.creditos_admin(), public.meus_creditos(), public.remover_credito(), public.usar_credito(), public.virar_credito() (+1 more)

### Community 45 - "2026-11-16_bordazul-cadastro-dono.sql"
Cohesion: 0.07
Nodes (19): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocar_horario_pedido(), public.trocas_pedido(), public.aplicar_netos() (+11 more)

### Community 60 - "steps"
Cohesion: 0.07
Nodes (34): concurrency, cancel-in-progress, group, jobs, mapa, salvar, permissions, runs-on (+26 more)

### Community 61 - "Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro"
Cohesion: 0.25
Nodes (7): Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro, Checklist antes de abrir um pull request, Falhas de segurança encontradas, Política de retenção e descarte de registros (2026-11-17), Registros e troca de segredos (2026-11-13), Regras, Segregação entre quem faz e quem publica (2026-11-17)

### Community 62 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.23
Nodes (6): pedido_jetski, pedido_jetski_uso, public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.tg_pedido_jetski()

### Community 63 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): Mapa do projeto (Graphify), Publicar no Supabase sem confirmação, Segurança

### Community 65 - "2026-11-13_auditoria-e-registro-de-acessos.sql"
Cohesion: 0.17
Nodes (10): auditoria_em, auditoria_tabela_registro, auditoria_trava, auditoria_trava_tudo, public.auditoria, public.copiar_acessos(), public.registro_acessos, registro_acessos_em (+2 more)

### Community 66 - "asaas-transferir/index.ts"
Cohesion: 0.25
Nodes (8): API(), asaas(), avisar(), AVISO, brl(), CORS, db, KEY()

### Community 67 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 69 - "public.bloqueios"
Cohesion: 0.06
Nodes (24): public.auto_confirmar_fora(), public.dono_aprovacao_ver(), public._cancelar_pre_reserva_base(), a_trava_segunda_pre_reserva, public._pre_reserva_pendente_outra_data(), public._trava_segunda_pre_reserva(), public.avaliacao_pausada, public._ligar_passeio() (+16 more)

### Community 77 - "asaas-docs/index.ts"
Cohesion: 0.10
Nodes (28): API(), avisarRejeitados(), chaveSub(), CORS, d360Key(), db, de64(), ES_DDI (+20 more)

### Community 78 - "steps"
Cohesion: 0.05
Nodes (42): concurrency, cancel-in-progress, group, ANTES, DEPOIS, FUNCOES, IN_FUNCOES, IN_SQL (+34 more)

### Community 79 - "public.donos"
Cohesion: 0.13
Nodes (16): public.aprovacoes_dono, public.dono_aprovacao_ver(), public.dono_aprovar(), public.dono_recusar(), donos_cortesia_jetski, public.tg_donos_cortesia_jetski(), public.tg_consulta_aprovada_avisa_dono(), zz_consulta_aprovada_avisa_dono (+8 more)

### Community 80 - "claude-noturno.mjs"
Cohesion: 0.10
Nodes (21): ACHADO, aviso(), carregarUso(), claude, controle(), gravarControle(), gravarIa(), LANGS3 (+13 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.43
Nodes (5): public.transferencias_saldo, transferencias_saldo_user, zz_auditar, a_teto_diario, public._transferencia_teto()

### Community 82 - "ref_npm_web_push_3_6_7"
Cohesion: 0.09
Nodes (12): CORS, db, SLOT, TXT, CORS, db, T, db (+4 more)

### Community 83 - "public.pedido_oferta"
Cohesion: 0.20
Nodes (3): public.oferta_vendedor(), public.salvar_pcts(), public.pedido_oferta()

### Community 86 - "asaas-saude/index.ts"
Cohesion: 0.33
Nodes (6): API(), asaas(), db, Item, KEY(), testarSplit()

### Community 89 - "public.anotacoes"
Cohesion: 0.18
Nodes (15): a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos() (+7 more)

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 93 - "public.pagamentos_pp"
Cohesion: 0.28
Nodes (5): public.ativar_conta_cliente(), public.ativar_conta_cliente(), public.ativar_conta_cliente(), public._convite_pagar(), public.ativar_conta_cliente()

### Community 94 - "asaas-chaves-girar/index.ts"
Cohesion: 0.32
Nodes (5): abrir(), b64(), db, de64(), fechar()

### Community 95 - "env"
Cohesion: 0.09
Nodes (22): AUTOR, GH_TOKEN, HEAD, PR, REPO, REVISOR, jobs, segunda-aprovacao (+14 more)

### Community 97 - "aviso-aprovacao/index.ts"
Cohesion: 0.27
Nodes (8): apnsToken(), dataBR(), db, L(), linha(), push(), SLOT, TXT

### Community 101 - "bordazul-anunciar/index.ts"
Cohesion: 0.09
Nodes (24): analisar(), ARQ_TIPOS, CATEG, CIDADES, codigoDe(), conferirCodigo(), CORS, cpfValido() (+16 more)

### Community 102 - "2026-11-22_zzzz-termo-aceite.sql"
Cohesion: 0.70
Nodes (4): aceites_termo_pedido, aceites_termo_so_inclusao, public.aceites_termo, public._aceites_termo_so_inclusao()

### Community 103 - "2026-11-19_rastreio-server-side.sql"
Cohesion: 0.07
Nodes (30): conversao_asaas, conversao_paypal, conversoes_pendentes, public.conversao_asaas(), public.conversao_paypal(), public.conversoes, public.conversoes_chamar(), public.rastreio_visitas (+22 more)

### Community 105 - "2026-11-17_aviso-dinheiro-na-conta.sql"
Cohesion: 0.83
Nodes (3): avisos_entrada_ref, avisos_entrada_user, public.avisos_entrada

### Community 109 - "ref_node_fs"
Cohesion: 0.20
Nodes (4): m, web, web, erros

### Community 110 - "public._valor_na_data"
Cohesion: 0.18
Nodes (7): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.lancar_grupo_operador(), public._valor_na_data()

### Community 112 - "aviso-vendedor/index.ts"
Cohesion: 0.14
Nodes (11): ASSUNTO(), CORS, dataBR(), db, hmTxt(), MAIL, MAIL_PAGO, PUSH (+3 more)

### Community 117 - "registros-exportar.mjs"
Cohesion: 0.21
Nodes (12): api(), chamar(), chaveServidor(), dormir(), exportarFonte(), feitos, FONTES, gravar() (+4 more)

### Community 123 - "public.bloqueios"
Cohesion: 0.15
Nodes (8): public.marcar_wa(), public.registrar_alteracao(), public.marcar_wa(), public.marcar_wa(), public.marcar_wa(), public.marcar_wa_aval(), public.periodos_extra(), public.passeios_marinheiro_v2()

### Community 125 - "2026-11-16_consultas-site-fecham-sozinhas.sql"
Cohesion: 0.43
Nodes (5): a_consulta_resgate_limpa_pedido, public.tg_consulta_resgate_limpa_pedido(), public.tg_fecha_consultas_site(), zz_anotacao_fecha_consultas, zz_consulta_lancada_fecha_site

### Community 130 - "2026-11-17_retencao-registros-5-anos.sql"
Cohesion: 0.28
Nodes (4): cofre_registros_trava, public.registros_exportados, registros_exportados_trava, registros_exportados_trava_tudo

### Community 134 - "v"
Cohesion: 0.25
Nodes (4): public.salvar_pcts(), public.definir_parceiro(), public.definir_pct_vendedor(), public.salvar_pcts()

### Community 135 - "API"
Cohesion: 0.21
Nodes (12): API(), avisarDocsLiberados(), avisarEntradas(), b64(), chaveSub(), cifrar(), conferirContas(), de64() (+4 more)

### Community 136 - "public.adicionar_lancha_pre_reserva"
Cohesion: 0.20
Nodes (6): public._ligar_passeio(), pagamentos_asaas_asaas_real_idx, public.adicionar_lancha_pre_reserva(), public.aprovar_pre_pedido(), public._ligar_passeio(), public.pedido_grupo()

### Community 137 - "conversoes/index.ts"
Cohesion: 0.13
Nodes (20): filtra(), ga, match(), meta, T, caminho(), cors(), db (+12 more)

### Community 140 - "public.liberar_sinal"
Cohesion: 0.29
Nodes (3): public.liberar_sinal(), public.alterar_pedido(), public.trocar_horario_pedido()

### Community 146 - "enviarSaldos"
Cohesion: 0.18
Nodes (15): acabou(), carteira(), contaBuzios(), donoLiberado(), donoLiberaEm(), enviarSaldos(), filaPaypal(), hojeBRT() (+7 more)

### Community 147 - "asaas"
Cohesion: 0.31
Nodes (9): asaas(), chavePix(), entradaPaypal(), lerEntradasPaypal(), nomeLancha(), pixEstatico(), refEntrada(), valorTransf() (+1 more)

### Community 149 - "entrar-celular/index.ts"
Cohesion: 0.33
Nodes (4): contas(), CORS, db, dig()

### Community 150 - "caixaPedido"
Cohesion: 0.32
Nodes (8): atualizarCredito(), avisarCartaoAtrasado(), CAIU(), caixaPedido(), creditoFinal(), quandoCobre(), refrescar(), situacaoCredito()

### Community 152 - "public.mover_passeio_v2"
Cohesion: 0.19
Nodes (8): public.mover_passeio_v2(), public._aplicar_prazo_curto(), public.prazo_curto, public._pre_vencida_recente(), public.tg_pedido_prazo_curto(), public.tg_pre_vencida_prazo_curto(), zz_pedido_prazo_curto, zz_pre_vencida_prazo_curto

### Community 155 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.12
Nodes (10): public.aprovar_alteracao(), public.mover_passeio(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao(), public.aprovar_consulta(), public.recusar_alteracao(), public.solicitar_alteracao() (+2 more)

### Community 158 - "ref_npm_supabase"
Cohesion: 0.13
Nodes (7): CORS, db, CAT, CORS, db, CORS, db

### Community 159 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 163 - "2026-11-22_zzzzz-horario-real-sem-sobreposicao.sql"
Cohesion: 0.19
Nodes (11): public.pp_vaga(), public.confirmar_pago(), public.pp_vaga(), public.pp_vaga_h(), public.cliente_alterar_pedido(), public._cliente_muda_bloqueio(), public.cliente_opcoes_pedido(), public._vaga_pedido_em() (+3 more)

### Community 166 - "2026-11-21_bordazul-dono-confirma.sql"
Cohesion: 0.33
Nodes (4): a_consulta_origem, public.atendimento_origem, public.lancha_confirma_dono(), public.marcar_origem()

### Community 167 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 169 - "public"
Cohesion: 0.08
Nodes (19): public.ordenar_lanchas(), public._desc_parceiro(), jetski_dividas_dono, pedido_jetski_troca, public.jetski_abater(), public.jetski_abater_desfaz(), public.jetski_abatimentos, public.jetski_dividas (+11 more)

### Community 170 - "public._aprovar_consulta"
Cohesion: 0.12
Nodes (8): passeio_sem_manutencao, public._passeio_sem_manutencao(), public._aprovar_consulta(), public._soltar_anterior_mesmo_cliente(), public.alternativas_livres(), public.usar_credito(), manut_sem_sobrepor, public.alternativas_livres()

### Community 171 - "2026-11-22_zzzzz-horario-real-sem-sobreposicao.sql"
Cohesion: 0.29
Nodes (3): a00_horario_real, public.janela_livre(), public.tg_anotacao_horario_real()

### Community 173 - "public.cliques_google"
Cohesion: 0.43
Nodes (5): cliques_google_bloqueio, public.clique_google(), public.cliques_google, cliques_google_criado, public.clique_google()

### Community 174 - "public.consultas"
Cohesion: 0.18
Nodes (7): bloqueio_trazido_por, public._bloqueio_trazido_por(), public.origem_reserva(), public.meus_repasses_pp(), public.repasses_feitos(), public.saude_checagens, public._trocar_telefone_conta()

### Community 175 - "db-mudou.mjs"
Cohesion: 0.48
Nodes (5): SOURCE, fotosDB(), iaDB(), lanchasDB(), precosDB()

### Community 178 - "2026-11-20_cupom-boas-vindas-site.sql"
Cohesion: 0.20
Nodes (6): pedido_zz_cupom_teto, public.cupom_do_cliente_operador(), public.cupom_site_config, public.meus_cupons_v3(), public.resgatar_cupom_site(), public.tg_repasse_auto()

### Community 180 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 184 - "2026-11-22_zzzzzzzz-funil-link-vendedor.sql"
Cohesion: 0.70
Nodes (4): public.funil_vendedor(), public.funil_vendedor_resumo(), public.vendedor_funil, vendedor_funil_criado

### Community 187 - "auth.users"
Cohesion: 0.28
Nodes (6): asaas_validacoes_id, public.asaas_chaves, public.asaas_validacoes, jetski_sempre_aprendiz, public.tg_jetski_aprendiz(), public.usuario_por_email()

### Community 188 - "public.consultas"
Cohesion: 0.15
Nodes (12): public.lancar_pedido_operador(), public._capacidade(), public._confere_valor_op(), public.lancar_pedido_operador(), public.lancar_pedido_operador(), public.lancar_pedido_vendedor(), public.aprovar_consulta(), public.lancar_pedido_vendedor() (+4 more)

### Community 191 - "2026-11-15_jetski-lucas.sql"
Cohesion: 0.22
Nodes (5): a_pedido_jetski_segurado, public._jetski_segura(), public.lancar_reserva_com_jetski(), public.tg_pedido_jetski_uso(), zz_anotacao_jetski_segura

## Knowledge Gaps
- **94 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.pedidos` to `public._aprovar_consulta`, `public.consultas`, `public`, `pedidos`, `public.bloqueios`, `public.consultas`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.adicionar_lancha_pre_reserva()` connect `public.adicionar_lancha_pre_reserva` to `public`, `public.jetskis`, `public.donos`, `2026-11-20_cupom-boas-vindas-site.sql`, `public.mover_passeio_v2`, `auth.users`, `public.pagamentos_pp`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06756756756756757 - nodes in this community are weakly interconnected._
- **Why does `public._aprovar_consulta()` connect `public._aprovar_consulta` to `public.pedidos`, `public.pedidos`, `public.bloqueios`, `public.donos`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07013574660633484 - nodes in this community are weakly interconnected._
- **Should `dono-aprovacao/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11414141414141414 - nodes in this community are weakly interconnected._
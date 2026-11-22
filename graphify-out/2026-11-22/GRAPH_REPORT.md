# Graph Report - buzios-lanchas-site  (2026-11-22)

## Corpus Check
- 273 files · ~511,467 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .xml 3, .tflite 2, .webmanifest 2)

## Summary
- 2061 nodes · 3421 edges · 185 communities (110 shown, 75 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1944bc0c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- public.adicionar_lancha_pre_reserva
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- dono-aprovacao/index.ts
- public.consultas
- paypal-checkout/index.ts
- public._ligar_passeio
- prerender.mjs
- env
- steps
- steps
- steps
- public.lanchas
- clima-site/index.ts
- clima-alertas/index.ts
- public.pix_estatico
- consulta-resgate/index.ts
- 2026-11-16_bordazul-cadastro-dono.sql
- b
- pedido-indisponivel/index.ts
- contato
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- vendedores
- aviso-seguranca/index.ts
- aviso-chat/index.ts
- consulta-aviso/index.ts
- avaliacao/index.ts
- central-auto/index.ts
- public.revisao_dados
- public.bloqueios
- public._pre_reserva_volta
- whatsapp-codigo/index.ts
- steps
- donos
- traduzir/index.ts
- asaas-saques/index.ts
- login/sw.js
- aviso-sinal/index.ts
- fotos-db.py
- 2026-11-15_preco-cotado-garantido.sql
- cambio/index.ts
- convite_manual_marca_aviso
- public.donos
- README.md
- steps
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- 2026-10-30_operador-um-toque.sql
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- asaas-transferir/index.ts
- public.codigo_convite
- public.marcar_wa
- 2026-11-05_revisao-diaria.sql
- 2026-11-08_app-versao-minima.sql
- asaas-docs/index.ts
- steps
- asaas-chaves-girar/index.ts
- claude-noturno.mjs
- 2026-11-13_transferir-saldo.sql
- ref_npm_web_push_3_6_7
- 2026-11-15_jetski-pedido.sql
- public.tg_anotacao_jetski_segura
- asaas-saude/index.ts
- public.pedidos
- marca.js
- 2026-11-16_convite-consulta-vencida.sql
- public.pagamentos_pp
- 2026-11-19_rastreio-server-side.sql
- env
- aviso-aprovacao/index.ts
- bordazul-anunciar/index.ts
- public._valor_na_data
- paginas.mjs
- 2026-11-17_aviso-dinheiro-na-conta.sql
- public.pp_vaga_h
- sem-negativo.js
- ref_node_fs
- public.anotacoes
- public.jetskis
- aviso-vendedor/index.ts
- trava_cond_aviso
- registros-exportar.mjs
- 2026-11-16_consultas-site-fecham-sozinhas.sql
- asaas_contas_reenvio_token
- public.salvar_netos_v3
- public.tg_tel_padrao
- public.marcar_wa
- 2026-11-17_paypal-cai-no-asaas-repasse-auto.sql
- 2026-11-17_retencao-registros-5-anos.sql
- 2026-11-20_lucas-revisao-noturna.sql
- brl
- API
- traduzir-chat/index.ts
- conversoes/index.ts
- 2026-11-18_textos-claude.sql
- db-mudou.mjs
- public._soltar_anterior_mesmo_cliente
- ref_npm_supabase
- enviarSaldos
- asaas
- entrar-celular/index.ts
- caixaPedido
- public.aprovar_foto
- aviso-lucas/index.ts
- 2026-11-17_jetski-repasse-cancelado.sql
- public
- whatsapp-webhook/index.ts
- public.anotacoes
- 2026-11-20_saque-buzios.sql
- public.revisao_dados
- 2026-10-30_asaas-validacao-saques.sql
- public.pagamentos_pp
- conversoes-navegador.js
- lanchas
- public.jetski_usos
- public.cupons
- public._valor_na_data
- public.bloqueios
- 2026-11-21_seguranca-saque.sql
- public.ativar_conta_cliente
- 2026-11-17_dono-aprova-pre-reserva.sql
- public.origem_reserva
- public._aprovar_consulta
- 2026-11-05_socios-nome-completo-e-convites-pendentes.sql
- public.mover_passeio_v2
- 2026-11-22_zz-saque-espera-24h-apos-troca.sql
- public.clientes
- 2026-11-22_telefone-trocado-avisa-antigo.sql
- paypal-fatura/index.ts
- aviso-preco/index.ts

## God Nodes (most connected - your core abstractions)
1. `public.jetskis` - 35 edges
2. `public.jetski_usos` - 30 edges
3. `public.adicionar_lancha_pre_reserva()` - 19 edges
4. `asaas()` - 18 edges
5. `public._ligar_passeio()` - 17 edges
6. `avisarDonos()` - 16 edges
7. `prazosDono()` - 14 edges
8. `public.cancelar_pre_reserva()` - 14 edges
9. `public.cancelar_pre_reserva()` - 14 edges
10. `public._ligar_passeio()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-cortesia-opcional.sql → supabase/sql/2026-11-15_jetski.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-lucas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.jetski_do_passeio()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql

## Import Cycles
- None detected.

## Communities (185 total, 75 thin omitted)

### Community 0 - "public.adicionar_lancha_pre_reserva"
Cohesion: 0.20
Nodes (6): public._ligar_passeio(), pagamentos_asaas_asaas_real_idx, public.adicionar_lancha_pre_reserva(), public.aprovar_pre_pedido(), public._ligar_passeio(), public.pedido_grupo()

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.07
Nodes (27): APROVADA, AV_DEV, carregar(), cliente(), cnpjOk(), CORS, cpfOk(), db (+19 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.07
Nodes (46): apnsToken(), ASSUNTO, autoConfirma(), avaliacaoPausada(), avisarCredito(), b64u(), brl(), brlCred() (+38 more)

### Community 4 - "dono-aprovacao/index.ts"
Cohesion: 0.12
Nodes (38): admins(), apnsToken(), aprovado(), avisarCliente(), avisarClienteDemora(), avisarDonos(), avisarResolvidas(), brl() (+30 more)

### Community 5 - "public.consultas"
Cohesion: 0.19
Nodes (13): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos() (+5 more)

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.06
Nodes (49): aceitarPreco(), ajustarGrupo(), avisarAdmins(), brlv(), carregar(), COB_EUR, comQuem(), confirmarSozinho() (+41 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.14
Nodes (9): pre_pedido_fim, pre_pedido_sinal, public.aprovar_consulta(), public._ligar_passeio(), public._pre_pedido_fim(), public._pre_pedido_sinal(), public._ligar_passeio(), public.lancar_grupo_operador() (+1 more)

### Community 8 - "prerender.mjs"
Cohesion: 0.14
Nodes (15): alt(), boatUrl(), DB_READ, FC, guias, LANGS, pages, pathFor() (+7 more)

### Community 9 - "env"
Cohesion: 0.06
Nodes (35): concurrency, cancel-in-progress, group, ANTHROPIC_API_KEY, LIMITE_MES_USD, SIMULAR, SUPABASE_ACCESS_TOKEN, TAREFAS (+27 more)

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.06
Nodes (31): concurrency, cancel-in-progress, group, runs-on, steps, APPLE_TEAM_ID, FTP_PASSWORD, FTP_SERVER (+23 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "public.lanchas"
Cohesion: 0.10
Nodes (14): a_pedido_jetski_segurado, public._jetski_confere(), public._jetski_segura(), public.lancar_reserva_com_jetski(), public.tg_pedido_jetski_segurado(), public.tg_pedido_jetski_uso(), zz_anotacao_jetski_segura, public._jetski_confere() (+6 more)

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.15
Nodes (19): avisarPasseios(), convidarVencidas(), d360Key(), dataLonga(), db, dig(), ES_DDI, hm() (+11 more)

### Community 18 - "2026-11-16_bordazul-cadastro-dono.sql"
Cohesion: 0.24
Nodes (7): bz_cadastros_status, bz_cadastros_tel, public.bz_cadastro_decidir(), public.bz_cadastros, public.bz_cadastros_admin(), public.bz_wa_codigos, public.bz_wa_reservar()

### Community 19 - "b"
Cohesion: 0.16
Nodes (15): public.aprovar_alteracao(), public.mover_passeio(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao(), public.solicitar_alteracao(), public.registrar_alteracao(), public._credito_chat() (+7 more)

### Community 20 - "pedido-indisponivel/index.ts"
Cohesion: 0.17
Nodes (12): CORS, dataBR(), db, ddiLang(), email(), ES_DDI, lang(), livres() (+4 more)

### Community 21 - "contato"
Cohesion: 0.22
Nodes (13): avisarAdmins(), avisarAntecipadas(), avisarAprovada(), avisarCartaoAtrasado(), avisarExpirou(), avisarPassou(), comQuem(), contato() (+5 more)

### Community 22 - "steps"
Cohesion: 0.15
Nodes (12): jobs, prerender, name, on, pull_request, runs-on, steps, name (+4 more)

### Community 23 - "convite-email/index.ts"
Cohesion: 0.15
Nodes (8): CORS, db, ES_DDI, LIGA, MAPA, SLOT, TAXA, TAXA_TXT

### Community 24 - "cadastro-whatsapp/index.ts"
Cohesion: 0.22
Nodes (9): codigoDe(), confere(), CORS, db, dig(), json(), LANG, mandaCodigo() (+1 more)

### Community 25 - "vendedores"
Cohesion: 0.05
Nodes (22): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.oferta_vendedor(), public.salvar_pcts(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts() (+14 more)

### Community 26 - "aviso-seguranca/index.ts"
Cohesion: 0.10
Nodes (30): apnsToken(), ASSUNTO, ASSUNTO_TEL, brl(), chaveTxt(), d360Key(), db, dig() (+22 more)

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
Cohesion: 0.26
Nodes (4): public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes()

### Community 32 - "public.bloqueios"
Cohesion: 0.10
Nodes (20): public.aprovar_consulta(), public.registrar_alteracao(), public.definir_condicional(), public.marcar_wa(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais (+12 more)

### Community 33 - "public._pre_reserva_volta"
Cohesion: 0.13
Nodes (9): public._pre_reserva_volta(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador(), public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google() (+1 more)

### Community 34 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 35 - "steps"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, default, description, required, DIAS, PROJECT_REF (+21 more)

### Community 36 - "donos"
Cohesion: 0.24
Nodes (7): public.meus_socios(), public.definir_desc_parceiro(), public.definir_pct_vendedor(), public._desc_parceiro(), public.meu_vendedor(), public.vendedor_publico(), public.minhas_conversas_v4()

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
Cohesion: 0.22
Nodes (10): cotacoes_garantidas_busca, cotacoes_garantidas_lancha, public.cotacoes_abertas_dono(), public.cotacoes_garantidas, public._garantia_cotacao(), public._precos_lanc(), public.registrar_cotacao(), public.tg_anotacao_neto_garantido() (+2 more)

### Community 45 - "public.donos"
Cohesion: 0.18
Nodes (13): public.tg_jetski_cortesia_mesmo_dono(), donos_cortesia_jetski, jetski_acertos_pedido_jetski, jetski_cortesia_mesmo_dono, pedido_jetski_metades_protege, pedido_jetski_troca, public.jetski_acertos, public.meus_jetski_alugueis() (+5 more)

### Community 60 - "steps"
Cohesion: 0.07
Nodes (34): concurrency, cancel-in-progress, group, jobs, mapa, salvar, permissions, runs-on (+26 more)

### Community 61 - "Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro"
Cohesion: 0.25
Nodes (7): Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro, Checklist antes de abrir um pull request, Falhas de segurança encontradas, Política de retenção e descarte de registros (2026-11-17), Registros e troca de segredos (2026-11-13), Regras, Segregação entre quem faz e quem publica (2026-11-17)

### Community 62 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.09
Nodes (7): public._capacidade(), public._confere_valor_op(), public.lancar_pedido_operador(), public.recusar_alteracao(), public.lancar_pedido_operador(), public.trava_campos_buzios(), trava_campos_buzios

### Community 63 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): Mapa do projeto (Graphify), Publicar no Supabase sem confirmação, Segurança

### Community 65 - "2026-11-13_auditoria-e-registro-de-acessos.sql"
Cohesion: 0.17
Nodes (10): auditoria_em, auditoria_tabela_registro, auditoria_trava, auditoria_trava_tudo, public.auditoria, public.copiar_acessos(), public.registro_acessos, registro_acessos_em (+2 more)

### Community 66 - "asaas-transferir/index.ts"
Cohesion: 0.25
Nodes (8): API(), asaas(), avisar(), AVISO, brl(), CORS, db, KEY()

### Community 67 - "public.codigo_convite"
Cohesion: 0.15
Nodes (7): public.lancar_pedido_operador(), pre_reserva_volta, public.codigo_convite(), public._confere_valor_op(), public.descontos_grupo, public.lancar_pedido_operador(), public._piso_grupo()

### Community 69 - "2026-11-05_revisao-diaria.sql"
Cohesion: 0.38
Nodes (5): public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo(), trava_cond_aviso, trava_grupo

### Community 77 - "asaas-docs/index.ts"
Cohesion: 0.10
Nodes (28): API(), avisarRejeitados(), chaveSub(), CORS, d360Key(), db, de64(), ES_DDI (+20 more)

### Community 78 - "steps"
Cohesion: 0.05
Nodes (42): concurrency, cancel-in-progress, group, ANTES, DEPOIS, FUNCOES, IN_FUNCOES, IN_SQL (+34 more)

### Community 79 - "asaas-chaves-girar/index.ts"
Cohesion: 0.32
Nodes (5): abrir(), b64(), db, de64(), fechar()

### Community 80 - "claude-noturno.mjs"
Cohesion: 0.10
Nodes (21): ACHADO, aviso(), carregarUso(), claude, controle(), gravarControle(), gravarIa(), LANGS3 (+13 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.43
Nodes (5): public.transferencias_saldo, transferencias_saldo_user, zz_auditar, a_teto_diario, public._transferencia_teto()

### Community 82 - "ref_npm_web_push_3_6_7"
Cohesion: 0.12
Nodes (9): CAT, CORS, db, CORS, db, SLOT, TXT, db (+1 more)

### Community 83 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.12
Nodes (9): pedido_jetski, pedido_jetski_uso, public.liberar_sinal(), public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.alterar_pedido(), public.tg_pedido_jetski() (+1 more)

### Community 86 - "asaas-saude/index.ts"
Cohesion: 0.33
Nodes (6): API(), asaas(), db, Item, KEY(), testarSplit()

### Community 89 - "public.pedidos"
Cohesion: 0.10
Nodes (14): public.mb_libera_sinal_sozinho(), public.jetski_avisa_conflito(), a_msg_expirou_pre_reserva, a_pre_reserva_prazo_vale, public.tg_msg_expirou_pre_reserva(), public.tg_pre_reserva_prazo_vale(), pedido_zz_cupom_teto, public.cupom_site_config (+6 more)

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 93 - "public.pagamentos_pp"
Cohesion: 0.21
Nodes (6): public.papeis_painel, public.papel_painel(), public.ativar_conta_cliente(), public.ativar_conta_cliente(), public._convite_pagar(), public.ativar_conta_cliente()

### Community 94 - "2026-11-19_rastreio-server-side.sql"
Cohesion: 0.23
Nodes (12): conversao_asaas, conversao_paypal, conversoes_pendentes, public.conversao_asaas(), public.conversao_paypal(), public.conversoes, public.rastreio_visitas, rastreio_visitas_consulta (+4 more)

### Community 95 - "env"
Cohesion: 0.09
Nodes (22): AUTOR, GH_TOKEN, HEAD, PR, REPO, REVISOR, jobs, segunda-aprovacao (+14 more)

### Community 97 - "aviso-aprovacao/index.ts"
Cohesion: 0.27
Nodes (8): apnsToken(), dataBR(), db, L(), linha(), push(), SLOT, TXT

### Community 101 - "bordazul-anunciar/index.ts"
Cohesion: 0.09
Nodes (24): analisar(), ARQ_TIPOS, CATEG, CIDADES, codigoDe(), conferirCodigo(), CORS, cpfValido() (+16 more)

### Community 102 - "public._valor_na_data"
Cohesion: 0.15
Nodes (8): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.lancar_grupo_operador(), public._valor_na_data(), public._teto_cheio()

### Community 103 - "paginas.mjs"
Cohesion: 0.22
Nodes (11): boatPath(), C, esc(), faqPreco, gerarPaginas(), guiaPath(), GUIAS, homePath() (+3 more)

### Community 105 - "2026-11-17_aviso-dinheiro-na-conta.sql"
Cohesion: 0.83
Nodes (3): avisos_entrada_ref, avisos_entrada_user, public.avisos_entrada

### Community 107 - "public.pp_vaga_h"
Cohesion: 0.22
Nodes (6): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocas_pedido()

### Community 109 - "ref_node_fs"
Cohesion: 0.20
Nodes (4): m, web, web, erros

### Community 110 - "public.anotacoes"
Cohesion: 0.15
Nodes (9): public.auto_confirmar_fora(), public.virar_credito(), public._cancelar_pre_reserva_base(), a_trava_segunda_pre_reserva, public._pre_reserva_pendente_outra_data(), a1_marinheiro_fixo_padrao, public.tg_marinheiro_fixo_padrao(), public.tg_embarque_periodo() (+1 more)

### Community 111 - "public.jetskis"
Cohesion: 0.15
Nodes (13): public.jetski_salvar(), public.jetskis, public.jetskis_site(), public.pode_jetski(), jetski_sempre_aprendiz, public.meus_jetski_alugueis(), public.tg_jetski_aprendiz(), public.jetskis_site_v2() (+5 more)

### Community 112 - "aviso-vendedor/index.ts"
Cohesion: 0.15
Nodes (9): ASSUNTO(), CORS, dataBR(), db, MAIL, MAIL_PAGO, PUSH, PUSH_PAGO (+1 more)

### Community 117 - "registros-exportar.mjs"
Cohesion: 0.21
Nodes (12): api(), chamar(), chaveServidor(), dormir(), exportarFonte(), feitos, FONTES, gravar() (+4 more)

### Community 118 - "2026-11-16_consultas-site-fecham-sozinhas.sql"
Cohesion: 0.16
Nodes (11): bloqueio_trazido_por, public._bloqueio_trazido_por(), a_consulta_neto_garantido, a_consulta_resgate_limpa_pedido, public.tg_consulta_resgate_limpa_pedido(), public.tg_fecha_consultas_site(), zz_anotacao_fecha_consultas, zz_consulta_lancada_fecha_site (+3 more)

### Community 123 - "public.salvar_netos_v3"
Cohesion: 0.20
Nodes (3): public.trocar_horario_pedido(), public.aplicar_netos(), public.salvar_netos_v3()

### Community 125 - "public.marcar_wa"
Cohesion: 0.29
Nodes (3): public.marcar_wa(), public.marcar_wa(), public.recibo_admin()

### Community 130 - "2026-11-17_retencao-registros-5-anos.sql"
Cohesion: 0.28
Nodes (4): cofre_registros_trava, public.registros_exportados, registros_exportados_trava, registros_exportados_trava_tudo

### Community 134 - "brl"
Cohesion: 0.29
Nodes (8): avisarAcertosJetski(), avisarEntradas(), brl(), diaCurto(), nomeLancha(), pushEntrada(), refEntrada(), valorTransf()

### Community 135 - "API"
Cohesion: 0.22
Nodes (11): API(), avisarDocsLiberados(), b64(), chaveSub(), cifrar(), conferirContas(), de64(), devolverAntecipada() (+3 more)

### Community 137 - "conversoes/index.ts"
Cohesion: 0.13
Nodes (20): filtra(), ga, match(), meta, T, caminho(), cors(), db (+12 more)

### Community 140 - "db-mudou.mjs"
Cohesion: 0.48
Nodes (5): SOURCE, fotosDB(), iaDB(), lanchasDB(), precosDB()

### Community 144 - "ref_npm_supabase"
Cohesion: 0.13
Nodes (7): CORS, db, CORS, db, CORS, db, T

### Community 146 - "enviarSaldos"
Cohesion: 0.25
Nodes (11): acabou(), carteira(), contaBuzios(), enviarSaldos(), filaPaypal(), jetskiAcabou(), jetskiLibera(), online() (+3 more)

### Community 147 - "asaas"
Cohesion: 0.25
Nodes (11): asaas(), cancelar(), cancelarAbertas(), chavePix(), conferir(), confirmarSozinho(), entradaPaypal(), lerEntradasPaypal() (+3 more)

### Community 149 - "entrar-celular/index.ts"
Cohesion: 0.33
Nodes (4): contas(), CORS, db, dig()

### Community 150 - "caixaPedido"
Cohesion: 0.40
Nodes (6): atualizarCredito(), CAIU(), caixaPedido(), creditoFinal(), refrescar(), situacaoCredito()

### Community 154 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 155 - "2026-11-17_jetski-repasse-cancelado.sql"
Cohesion: 0.33
Nodes (9): jetski_dividas_dono, pedido_jetski_troca, public.jetski_abater(), public.jetski_abater_desfaz(), public.jetski_abatimentos, public.jetski_dividas, public.meus_jetski_alugueis(), public.tg_pedido_jetski_troca() (+1 more)

### Community 158 - "public"
Cohesion: 0.22
Nodes (5): public.ordenar_lanchas(), public._desc_parceiro(), public.espelhar_pagamento_grupo(), public.conversoes_chamar(), public.aviso_seguranca_chamar()

### Community 159 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 161 - "public.anotacoes"
Cohesion: 0.17
Nodes (9): a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.periodos_extra(), public.passeios_marinheiro_v2(), anotacoes_grupo_idx, public.anexar_comprovante_passeio(), public.aprovar_pre_pedido() (+1 more)

### Community 163 - "public.revisao_dados"
Cohesion: 0.20
Nodes (3): public.pp_vaga(), public.revisao_dados(), public.repasses_sem_comprovante()

### Community 164 - "2026-10-30_asaas-validacao-saques.sql"
Cohesion: 0.40
Nodes (4): asaas_validacoes_id, public.asaas_chaves, public.asaas_validacoes, public.usuario_por_email()

### Community 165 - "public.pagamentos_pp"
Cohesion: 0.16
Nodes (9): public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tg_pedido_jetski(), public.jetski_do_passeio(), public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.painel_sinais_desde() (+1 more)

### Community 167 - "lanchas"
Cohesion: 0.25
Nodes (4): public.salvar_lancha(), public.salvar_lancha(), public.bz_faixa(), public.salvar_lancha()

### Community 169 - "public.jetski_usos"
Cohesion: 0.24
Nodes (8): jetski_uso_confere, jetski_usos_dia, public.jetski_choca(), public.jetski_desmarcar(), public.jetski_marcar(), public.jetski_ocupado(), public.jetski_usos, public.tg_jetski_uso_confere()

### Community 170 - "public.cupons"
Cohesion: 0.23
Nodes (6): cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2(), public.cupom_avaliacao_lanchas(), public.gerar_cupons()

### Community 172 - "public.bloqueios"
Cohesion: 0.15
Nodes (7): public.avaliacao_pausada, public.pausar_avaliacao(), public.dono_inicio_avisos, public._embarque_padrao(), public.tg_embarque_periodo(), public.periodos_ajustados(), public.periodos_extra()

### Community 173 - "2026-11-21_seguranca-saque.sql"
Cohesion: 0.27
Nodes (9): a0_limite_dia, avisos_seguranca_pend, avisos_seguranca_saque, public.avisos_seguranca, public.salvar_pix(), public.tg_saque_aviso(), public.tg_saque_limite_dia(), zz_aviso_seguranca (+1 more)

### Community 174 - "public.ativar_conta_cliente"
Cohesion: 0.24
Nodes (4): public.preco_novo_pedido(), public.ativar_conta_cliente(), public._convite_pagar(), public._uid_email_informado()

### Community 175 - "2026-11-17_dono-aprova-pre-reserva.sql"
Cohesion: 0.23
Nodes (8): passeio_sem_manutencao, public._passeio_sem_manutencao(), public.dono_aprovacao_ver(), public.alternativas_livres(), public.aprovacoes_dono, public.dono_aprovacao_ver(), public.dono_aprovar(), public.dono_recusar()

### Community 176 - "public.origem_reserva"
Cohesion: 0.21
Nodes (6): public.origem_reserva(), public._preco_vendedor(), public.meus_repasses_pp(), public.painel_sinais_hoje(), public.repasses_feitos(), public.saude_checagens

### Community 177 - "public._aprovar_consulta"
Cohesion: 0.20
Nodes (3): public._aprovar_consulta(), public._soltar_anterior_mesmo_cliente(), public.usar_credito()

### Community 179 - "public.mover_passeio_v2"
Cohesion: 0.22
Nodes (3): public.mover_passeio_v2(), public.cupom_do_cliente_operador(), public.tg_repasse_auto()

### Community 180 - "2026-11-22_zz-saque-espera-24h-apos-troca.sql"
Cohesion: 0.22
Nodes (4): public.tg_saque_limite_dia(), public._saque_espera_ate(), public.saque_liberacoes, public.tg_saque_limite_dia()

### Community 181 - "public.clientes"
Cohesion: 0.53
Nodes (4): a1_trava_criado_em, cupom_bv_tel, public.cupom_bv_tel(), public.trava_criado_em_cliente()

### Community 182 - "2026-11-22_telefone-trocado-avisa-antigo.sql"
Cohesion: 0.47
Nodes (4): public.telefones_trocados, public.tg_telefone_trocado(), telefones_trocados_user_em, zz_telefone_trocado

### Community 183 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 184 - "aviso-preco/index.ts"
Cohesion: 0.40
Nodes (3): CORS, db, T

## Knowledge Gaps
- **75 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `public.origem_reserva`, `vendedores`, `public._aprovar_consulta`, `public._pre_reserva_volta`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public._aprovar_consulta()` connect `public._aprovar_consulta` to `public.bloqueios`, `public.bloqueios`, `public.anotacoes`, `2026-11-17_dono-aprova-pre-reserva.sql`, `2026-11-16_consultas-site-fecham-sozinhas.sql`, `public.pedidos`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07058823529411765 - nodes in this community are weakly interconnected._
- **Why does `public.jetski_usos` connect `public.jetski_usos` to `public.pagamentos_pp`, `public.bloqueios`, `public.lanchas`, `public.anotacoes`, `public.jetskis`, `public.donos`, `2026-11-15_jetski-pedido.sql`, `public.tg_anotacao_jetski_segura`, `public.pedidos`, `2026-11-17_jetski-repasse-cancelado.sql`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07013574660633484 - nodes in this community are weakly interconnected._
- **Should `dono-aprovacao/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12317073170731707 - nodes in this community are weakly interconnected._
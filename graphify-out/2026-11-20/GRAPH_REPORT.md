# Graph Report - buzios-lanchas-site  (2026-11-20)

## Corpus Check
- 247 files · ~485,169 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .xml 3, .tflite 2, .webmanifest 2)

## Summary
- 1914 nodes · 3156 edges · 158 communities (91 shown, 67 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `26a0d439`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- public.pp_vaga
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
- public.meus_repasses_pp
- clima-site/index.ts
- clima-alertas/index.ts
- 2026-11-16_consultas-site-fecham-sozinhas.sql
- consulta-resgate/index.ts
- aviso-comprovante/index.ts
- b
- pedido-indisponivel/index.ts
- contato
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- vendedores
- 2026-11-15_preco-cotado-garantido.sql
- aviso-chat/index.ts
- consulta-aviso/index.ts
- avaliacao/index.ts
- central-auto/index.ts
- public.revisao_dados
- public.bloqueios
- public.clientes
- whatsapp-codigo/index.ts
- steps
- public.pedidos
- traduzir/index.ts
- asaas-saques/index.ts
- login/sw.js
- aviso-sinal/index.ts
- fotos-db.py
- public.marcar_wa
- cambio/index.ts
- convite_manual_marca_aviso
- aviso-lucas/index.ts
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
- 2026-11-16_bordazul-cadastro-dono.sql
- donos
- asaas-saude/index.ts
- marca.js
- 2026-11-16_convite-consulta-vencida.sql
- public.ativar_conta_cliente
- 2026-11-19_rastreio-server-side.sql
- env
- aviso-aprovacao/index.ts
- bordazul-anunciar/index.ts
- auth.users
- 2026-11-17_aviso-dinheiro-na-conta.sql
- public.cupons
- sem-negativo.js
- 2026-11-17_jetski-repasse-cancelado.sql
- public.bloqueios
- traduzir-chat/index.ts
- aviso-vendedor/index.ts
- trava_cond_aviso
- public.salvar_netos_v3
- registros-exportar.mjs
- asaas_contas_reenvio_token
- public.pp_vaga
- public.tg_tel_padrao
- ref_npm_supabase
- 2026-11-17_paypal-cai-no-asaas-repasse-auto.sql
- 2026-11-17_retencao-registros-5-anos.sql
- whatsapp-webhook/index.ts
- pushAdmins
- API
- public.lanchas
- conversoes/index.ts
- 2026-11-18_textos-claude.sql
- public.adicionar_lancha_pre_reserva
- public._soltar_anterior_mesmo_cliente
- public
- enviarSaldos
- asaas
- 2026-11-15_jetski-pedido.sql
- entrar-celular/index.ts
- caixaPedido
- paypal-fatura/index.ts
- public.tg_anotacao_jetski_segura
- public.anotacoes
- 2026-11-05_socios-nome-completo-e-convites-pendentes.sql

## God Nodes (most connected - your core abstractions)
1. `public.jetskis` - 35 edges
2. `public.jetski_usos` - 30 edges
3. `public.adicionar_lancha_pre_reserva()` - 19 edges
4. `asaas()` - 17 edges
5. `public._ligar_passeio()` - 17 edges
6. `avisarDonos()` - 14 edges
7. `public.cancelar_pre_reserva()` - 14 edges
8. `public.cancelar_pre_reserva()` - 14 edges
9. `public._ligar_passeio()` - 14 edges
10. `X()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql
- `jetski_cortesia_mesmo_dono` --triggers--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-19_jetski-cortesia-varias-lanchas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.jetskis_site()` --reads_from--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-19_jetski-cortesia-varias-lanchas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.jetskis_site_v2()` --reads_from--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-19_jetski-cortesia-varias-lanchas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql

## Import Cycles
- None detected.

## Communities (158 total, 67 thin omitted)

### Community 0 - "public.pp_vaga"
Cohesion: 0.22
Nodes (6): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocas_pedido()

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.07
Nodes (30): APROVADA, AV_DEV, b64(), carregar(), cifrar(), cliente(), cnpjOk(), CORS (+22 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.07
Nodes (43): apnsToken(), ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves() (+35 more)

### Community 4 - "dono-aprovacao/index.ts"
Cohesion: 0.12
Nodes (32): apnsToken(), aprovado(), avisarCliente(), avisarDonos(), avisarResolvidas(), brl(), CORS, criarModelos() (+24 more)

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
Cohesion: 0.06
Nodes (36): m, web, SOURCE, web, erros, fotosDB(), iaDB(), lanchasDB() (+28 more)

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

### Community 13 - "public.meus_repasses_pp"
Cohesion: 0.32
Nodes (4): public.meus_repasses_pp(), public.painel_sinais_hoje(), public.repasses_feitos(), public.saude_checagens

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "2026-11-16_consultas-site-fecham-sozinhas.sql"
Cohesion: 0.43
Nodes (5): a_consulta_resgate_limpa_pedido, public.tg_consulta_resgate_limpa_pedido(), public.tg_fecha_consultas_site(), zz_anotacao_fecha_consultas, zz_consulta_lancada_fecha_site

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.15
Nodes (19): avisarPasseios(), convidarVencidas(), d360Key(), dataLonga(), db, dig(), ES_DDI, hm() (+11 more)

### Community 18 - "aviso-comprovante/index.ts"
Cohesion: 0.29
Nodes (4): CORS, db, SLOT, TXT

### Community 19 - "b"
Cohesion: 0.16
Nodes (15): public.aprovar_alteracao(), public.mover_passeio(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao(), public.solicitar_alteracao(), public.registrar_alteracao(), public._credito_chat() (+7 more)

### Community 20 - "pedido-indisponivel/index.ts"
Cohesion: 0.17
Nodes (12): CORS, dataBR(), db, ddiLang(), email(), ES_DDI, lang(), livres() (+4 more)

### Community 21 - "contato"
Cohesion: 0.27
Nodes (10): avisarAdmins(), avisarAntecipadas(), avisarAprovada(), avisarExpirou(), avisarPassou(), comQuem(), contato(), dataBR() (+2 more)

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
Cohesion: 0.07
Nodes (17): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.oferta_vendedor(), public.salvar_pcts(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts() (+9 more)

### Community 26 - "2026-11-15_preco-cotado-garantido.sql"
Cohesion: 0.05
Nodes (23): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.aprovar_foto(), public.lancar_pedido_operador(), public.lancar_grupo_operador() (+15 more)

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
Cohesion: 0.15
Nodes (6): public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes(), public.revisao_dados(), public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes(), public.repasses_sem_comprovante()

### Community 32 - "public.bloqueios"
Cohesion: 0.10
Nodes (20): public.aprovar_consulta(), public.registrar_alteracao(), public.definir_condicional(), public.marcar_wa(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais (+12 more)

### Community 33 - "public.clientes"
Cohesion: 0.13
Nodes (9): public._pre_reserva_volta(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador(), public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google() (+1 more)

### Community 34 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 35 - "steps"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, default, description, required, DIAS, PROJECT_REF (+21 more)

### Community 36 - "public.pedidos"
Cohesion: 0.08
Nodes (22): public.mb_libera_sinal_sozinho(), public.jetski_avisa_conflito(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.painel_sinais_desde(), public.painel_sinais_hoje(), a_msg_expirou_pre_reserva, a_pre_reserva_prazo_vale (+14 more)

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

### Community 42 - "public.marcar_wa"
Cohesion: 0.29
Nodes (3): public.marcar_wa(), public.marcar_wa(), public.recibo_admin()

### Community 45 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

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
Cohesion: 0.12
Nodes (19): aviso(), carregarUso(), claude, controle(), gravarControle(), gravarIa(), LANGS3, lerIa() (+11 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.43
Nodes (5): public.transferencias_saldo, transferencias_saldo_user, zz_auditar, a_teto_diario, public._transferencia_teto()

### Community 82 - "ref_npm_web_push_3_6_7"
Cohesion: 0.13
Nodes (8): CAT, CORS, db, CORS, db, T, db, T

### Community 83 - "2026-11-16_bordazul-cadastro-dono.sql"
Cohesion: 0.24
Nodes (7): bz_cadastros_status, bz_cadastros_tel, public.bz_cadastro_decidir(), public.bz_cadastros, public.bz_cadastros_admin(), public.bz_wa_codigos, public.bz_wa_reservar()

### Community 84 - "donos"
Cohesion: 0.24
Nodes (7): public.meus_socios(), public.definir_desc_parceiro(), public.definir_pct_vendedor(), public._desc_parceiro(), public.meu_vendedor(), public.vendedor_publico(), public.minhas_conversas_v4()

### Community 86 - "asaas-saude/index.ts"
Cohesion: 0.33
Nodes (6): API(), asaas(), db, Item, KEY(), testarSplit()

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 93 - "public.ativar_conta_cliente"
Cohesion: 0.09
Nodes (16): public.papeis_painel, public.papel_painel(), bloqueio_trazido_por, public._bloqueio_trazido_por(), public.origem_reserva(), public.ativar_conta_cliente(), public.ativar_conta_cliente(), public._convite_pagar() (+8 more)

### Community 94 - "2026-11-19_rastreio-server-side.sql"
Cohesion: 0.19
Nodes (13): conversao_asaas, conversao_paypal, conversoes_pendentes, public.conversao_asaas(), public.conversao_paypal(), public.conversoes, public.conversoes_chamar(), public.rastreio_visitas (+5 more)

### Community 95 - "env"
Cohesion: 0.09
Nodes (22): AUTOR, GH_TOKEN, HEAD, PR, REPO, REVISOR, jobs, segunda-aprovacao (+14 more)

### Community 97 - "aviso-aprovacao/index.ts"
Cohesion: 0.27
Nodes (8): apnsToken(), dataBR(), db, L(), linha(), push(), SLOT, TXT

### Community 101 - "bordazul-anunciar/index.ts"
Cohesion: 0.09
Nodes (24): analisar(), ARQ_TIPOS, CATEG, CIDADES, codigoDe(), conferirCodigo(), CORS, cpfValido() (+16 more)

### Community 102 - "auth.users"
Cohesion: 0.67
Nodes (3): asaas_validacoes_id, public.asaas_chaves, public.asaas_validacoes

### Community 105 - "2026-11-17_aviso-dinheiro-na-conta.sql"
Cohesion: 0.83
Nodes (3): avisos_entrada_ref, avisos_entrada_user, public.avisos_entrada

### Community 107 - "public.cupons"
Cohesion: 0.43
Nodes (4): cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2()

### Community 109 - "2026-11-17_jetski-repasse-cancelado.sql"
Cohesion: 0.33
Nodes (9): jetski_dividas_dono, pedido_jetski_troca, public.jetski_abater(), public.jetski_abater_desfaz(), public.jetski_abatimentos, public.jetski_dividas, public.meus_jetski_alugueis(), public.tg_pedido_jetski_troca() (+1 more)

### Community 110 - "public.bloqueios"
Cohesion: 0.09
Nodes (18): public.auto_confirmar_fora(), public.jetski_do_passeio(), public.virar_credito(), passeio_sem_manutencao, public._passeio_sem_manutencao(), public._aprovar_consulta(), public._soltar_anterior_mesmo_cliente(), public.dono_aprovacao_ver() (+10 more)

### Community 112 - "aviso-vendedor/index.ts"
Cohesion: 0.15
Nodes (9): ASSUNTO(), CORS, dataBR(), db, MAIL, MAIL_PAGO, PUSH, PUSH_PAGO (+1 more)

### Community 115 - "public.salvar_netos_v3"
Cohesion: 0.11
Nodes (7): public.salvar_lancha(), public.trocar_horario_pedido(), public.aplicar_netos(), public.salvar_netos_v3(), public._valor_na_data(), public.salvar_lancha(), public.bz_faixa()

### Community 117 - "registros-exportar.mjs"
Cohesion: 0.23
Nodes (12): api(), chamar(), chaveServidor(), dormir(), exportarFonte(), feitos, FONTES, gravar() (+4 more)

### Community 123 - "public.pp_vaga"
Cohesion: 0.16
Nodes (4): public.liberar_sinal(), public.pp_vaga(), public.alterar_pedido(), public.trocar_horario_pedido()

### Community 125 - "ref_npm_supabase"
Cohesion: 0.13
Nodes (7): CORS, db, CORS, db, CORS, db, T

### Community 130 - "2026-11-17_retencao-registros-5-anos.sql"
Cohesion: 0.28
Nodes (4): cofre_registros_trava, public.registros_exportados, registros_exportados_trava, registros_exportados_trava_tudo

### Community 132 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 134 - "pushAdmins"
Cohesion: 0.31
Nodes (9): avisarAcertosJetski(), brl(), cancelar(), cancelarAbertas(), conferir(), confirmarSozinho(), diaCurto(), ligarEstatico() (+1 more)

### Community 135 - "API"
Cohesion: 0.27
Nodes (10): API(), avisarDocsLiberados(), avisarEntradas(), chaveSub(), conferirContas(), de64(), devolverAntecipada(), KEY() (+2 more)

### Community 136 - "public.lanchas"
Cohesion: 0.08
Nodes (30): public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), jetski_uso_confere, jetski_usos_dia, a_pedido_jetski_segurado, public._jetski_confere(), public._jetski_segura(), public.lancar_reserva_com_jetski() (+22 more)

### Community 137 - "conversoes/index.ts"
Cohesion: 0.13
Nodes (20): filtra(), ga, match(), meta, T, caminho(), cors(), db (+12 more)

### Community 140 - "public.adicionar_lancha_pre_reserva"
Cohesion: 0.13
Nodes (8): public.mover_passeio_v2(), public._ligar_passeio(), pagamentos_asaas_asaas_real_idx, public.adicionar_lancha_pre_reserva(), public.aprovar_pre_pedido(), public.espelhar_pagamento_grupo(), public._ligar_passeio(), public.pedido_grupo()

### Community 144 - "public"
Cohesion: 0.12
Nodes (11): public.ordenar_lanchas(), public._preco_vendedor(), public._desc_parceiro(), jetski_cortesia_mesmo_dono, public.jetski_cortesia(), public.jetskis_site(), public.jetskis_site_v2(), public.tg_donos_cortesia_jetski() (+3 more)

### Community 146 - "enviarSaldos"
Cohesion: 0.29
Nodes (10): acabou(), carteira(), enviarSaldos(), filaPaypal(), jetskiAcabou(), jetskiLibera(), online(), onlineTotal() (+2 more)

### Community 147 - "asaas"
Cohesion: 0.31
Nodes (9): asaas(), chavePix(), entradaPaypal(), lerEntradasPaypal(), nomeLancha(), pixEstatico(), refEntrada(), valorTransf() (+1 more)

### Community 148 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.23
Nodes (6): pedido_jetski, pedido_jetski_uso, public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.tg_pedido_jetski()

### Community 149 - "entrar-celular/index.ts"
Cohesion: 0.33
Nodes (4): contas(), CORS, db, dig()

### Community 150 - "caixaPedido"
Cohesion: 0.32
Nodes (8): atualizarCredito(), avisarCartaoAtrasado(), CAIU(), caixaPedido(), creditoFinal(), quandoCobre(), refrescar(), situacaoCredito()

### Community 151 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 154 - "public.anotacoes"
Cohesion: 0.17
Nodes (9): a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.periodos_extra(), public.passeios_marinheiro_v2(), anotacoes_grupo_idx, public.anexar_comprovante_passeio(), public.aprovar_pre_pedido() (+1 more)

## Knowledge Gaps
- **67 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `vendedores`, `public.ativar_conta_cliente`, `public.bloqueios`, `public.clientes`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.marcar_wa()` connect `public.marcar_wa` to `public.bloqueios`, `public.clientes`, `public.consultas`, `public._ligar_passeio`, `b`, `public.anotacoes`, `public.ativar_conta_cliente`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06906906906906907 - nodes in this community are weakly interconnected._
- **Why does `public.papeis_painel` connect `public.ativar_conta_cliente` to `public.clientes`, `public.marcar_wa`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07312925170068027 - nodes in this community are weakly interconnected._
- **Should `dono-aprovacao/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11587301587301588 - nodes in this community are weakly interconnected._
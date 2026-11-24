# Graph Report - buzios-lanchas-site  (2026-11-24)

## Corpus Check
- 306 files · ~538,536 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .xml 3, .tflite 2, .webmanifest 2)

## Summary
- 2161 nodes · 3612 edges · 190 communities (99 shown, 91 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `94d2b4c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- public.pagamentos_pp
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- dono-aprovacao/index.ts
- public.bloqueios
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
- lanchas
- public.relatorio_lucro
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
- 2026-10-30_operador-um-toque.sql
- public._pre_reserva_volta
- 2026-11-16_bordazul-cadastro-dono.sql
- steps
- donos
- traduzir/index.ts
- asaas-saques/index.ts
- login/sw.js
- aviso-sinal/index.ts
- fotos-db.py
- 2026-11-15_preco-cotado-garantido.sql
- cambio/index.ts
- public.bloqueios
- public.pp_vaga_h
- README.md
- steps
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- 2026-11-15_jetski-pedido.sql
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- asaas-transferir/index.ts
- public
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
- public.bloqueios
- marca.js
- 2026-11-16_convite-consulta-vencida.sql
- public.clientes
- asaas-chaves-girar/index.ts
- env
- aviso-aprovacao/index.ts
- bordazul-anunciar/index.ts
- 2026-11-22_zzzz-termo-aceite.sql
- 2026-11-19_rastreio-server-side.sql
- 2026-11-17_aviso-dinheiro-na-conta.sql
- sem-negativo.js
- public.consultas
- public._valor_na_data
- aviso-vendedor/index.ts
- trava_cond_aviso
- registros-exportar.mjs
- asaas_contas_reenvio_token
- public.creditos
- public.tg_tel_padrao
- 2026-11-16_consultas-site-fecham-sozinhas.sql
- 2026-11-17_paypal-cai-no-asaas-repasse-auto.sql
- 2026-11-17_retencao-registros-5-anos.sql
- 2026-11-20_lucas-revisao-noturna.sql
- public.meus_clientes_venda
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
- vendedores
- paypal-fatura/index.ts
- 2026-10-30_operador-um-toque.sql
- public.salvar_netos_v3
- whatsapp-webhook/index.ts
- 2026-11-23_comissao-20-e-referencia-mercado.sql
- 2026-11-20_saque-buzios.sql
- 2026-11-22_zzzzz-horario-real-sem-sobreposicao.sql
- public.vendedor_do_cliente
- 2026-11-21_bordazul-dono-confirma.sql
- whatsapp-codigo/index.ts
- 2026-11-05_revisao-diaria.sql
- public.cupons
- 2026-11-05_socios-nome-completo-e-convites-pendentes.sql
- public.cliques_google
- public.passeios_marinheiro_v2
- public.lancar_pedido_operador
- traduzir-chat/index.ts
- public._teto_cheio
- aviso-equipe/index.ts
- convite_manual_marca_aviso
- 2026-10-31_seguranca-travas.sql
- 2026-11-22_zzzzzzzz-funil-link-vendedor.sql
- aviso-comprovante/index.ts

## God Nodes (most connected - your core abstractions)
1. `public.jetskis` - 35 edges
2. `public.jetski_usos` - 30 edges
3. `public.adicionar_lancha_pre_reserva()` - 19 edges
4. `avisarDonos()` - 18 edges
5. `asaas()` - 18 edges
6. `public._ligar_passeio()` - 17 edges
7. `prazosDono()` - 16 edges
8. `enviarSaldos()` - 14 edges
9. `public.cancelar_pre_reserva()` - 14 edges
10. `public.cancelar_pre_reserva()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-cortesia-opcional.sql → supabase/sql/2026-11-15_jetski.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.salvar_pix()` --writes_to--> `public.avisos_seguranca`  [EXTRACTED]
  supabase/sql/2026-11-22_revisao-diaria.sql → supabase/sql/2026-11-21_seguranca-saque.sql
- `public._trocar_telefone_conta()` --writes_to--> `public.avisos_seguranca`  [EXTRACTED]
  supabase/sql/2026-11-22_zzz-trocar-telefone-conta.sql → supabase/sql/2026-11-21_seguranca-saque.sql
- `public.origem_reserva()` --reads_from--> `public.papeis_painel`  [EXTRACTED]
  supabase/sql/2026-11-13_origem-da-reserva.sql → supabase/sql/2026-10-30_papeis-operador-auditor.sql

## Import Cycles
- None detected.

## Communities (190 total, 91 thin omitted)

### Community 0 - "public.pagamentos_pp"
Cohesion: 0.11
Nodes (15): public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tg_pedido_jetski(), public.tg_pedido_jetski(), public.tirar_jetski(), public.painel_sinais_desde(), public.painel_sinais_hoje(), public.meus_repasses_pp() (+7 more)

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
Cohesion: 0.12
Nodes (41): admins(), apnsToken(), aprovado(), avisarCliente(), avisarClienteDemora(), avisarDonos(), avisarResolvidas(), brl() (+33 more)

### Community 5 - "public.bloqueios"
Cohesion: 0.27
Nodes (8): public.definir_condicional(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais, public.vendas_manuais_lista(), public.vendas_manuais_lista(), public._convite_manual_marca_aviso()

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.06
Nodes (49): aceitarPreco(), ajustarGrupo(), avisarAdmins(), brlv(), carregar(), COB_EUR, comQuem(), confirmarSozinho() (+41 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.13
Nodes (8): pre_pedido_fim, pre_pedido_sinal, public.aprovar_consulta(), public._ligar_passeio(), public._pre_pedido_fim(), public._pre_pedido_sinal(), public._ligar_passeio(), public._ligar_passeio()

### Community 8 - "prerender.mjs"
Cohesion: 0.05
Nodes (37): m, web, SOURCE, web, erros, fotosDB(), iaDB(), lanchasDB() (+29 more)

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
Cohesion: 0.06
Nodes (33): jetski_uso_confere, jetski_usos_dia, a_pedido_jetski_segurado, public._jetski_confere(), public._jetski_segura(), public.lancar_reserva_com_jetski(), public.tg_pedido_jetski_segurado(), public.tg_pedido_jetski_uso() (+25 more)

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "public.pedidos"
Cohesion: 0.12
Nodes (19): public.jetski_avisa_conflito(), a_msg_expirou_pre_reserva, a_pre_reserva_prazo_vale, public.tg_msg_expirou_pre_reserva(), public.tg_pre_reserva_prazo_vale(), jetski_acertos_pedido_jetski, jetski_cortesia_mesmo_dono, pedido_jetski_metades_protege (+11 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.15
Nodes (19): avisarPasseios(), convidarVencidas(), d360Key(), dataLonga(), db, dig(), ES_DDI, hm() (+11 more)

### Community 18 - "lanchas"
Cohesion: 0.20
Nodes (5): public.salvar_lancha(), public.salvar_lancha(), public.ordenar_lanchas(), public.salvar_lancha(), public.tg_marinheiro_fixo_padrao()

### Community 19 - "public.relatorio_lucro"
Cohesion: 0.31
Nodes (6): public.espelhar_pagamento_grupo(), public.cupom_do_cliente_operador(), lucro_gastos_data, public.lucro_custos, public.lucro_gastos, public.relatorio_lucro()

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

### Community 32 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.11
Nodes (6): public.marcar_wa(), public.recusar_alteracao(), public.registrar_alteracao(), public.marcar_wa(), public.marcar_wa(), public.marcar_wa_aval()

### Community 33 - "public._pre_reserva_volta"
Cohesion: 0.18
Nodes (6): public.recibo_admin(), public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google(), public.salvar_avaliacao_google()

### Community 34 - "2026-11-16_bordazul-cadastro-dono.sql"
Cohesion: 0.24
Nodes (7): bz_cadastros_status, bz_cadastros_tel, public.bz_cadastro_decidir(), public.bz_cadastros, public.bz_cadastros_admin(), public.bz_wa_codigos, public.bz_wa_reservar()

### Community 35 - "steps"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, default, description, required, DIAS, PROJECT_REF (+21 more)

### Community 36 - "donos"
Cohesion: 0.17
Nodes (9): public.meus_socios(), public.definir_desc_parceiro(), public.definir_pct_vendedor(), public._desc_parceiro(), public.meu_vendedor(), public._preco_vendedor(), public.vendedor_publico(), public.minhas_conversas_v4() (+1 more)

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
Nodes (13): public.aprovar_foto(), public.lancar_pedido_operador(), a_consulta_neto_garantido, cotacoes_garantidas_busca, cotacoes_garantidas_lancha, public.cotacoes_garantidas, public._garantia_cotacao(), public.preco_novo_pedido() (+5 more)

### Community 44 - "public.bloqueios"
Cohesion: 0.25
Nodes (11): public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.marcar_wa(), public.periodos_extra() (+3 more)

### Community 45 - "public.pp_vaga_h"
Cohesion: 0.27
Nodes (6): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocas_pedido()

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

### Community 67 - "public"
Cohesion: 0.09
Nodes (18): public._desc_parceiro(), jetski_dividas_dono, pedido_jetski_troca, public.jetski_abater(), public.jetski_abater_desfaz(), public.jetski_abatimentos, public.jetski_dividas, public.meus_jetski_alugueis() (+10 more)

### Community 69 - "public.bloqueios"
Cohesion: 0.04
Nodes (32): public.auto_confirmar_fora(), public.mb_libera_sinal_sozinho(), public.jetski_do_passeio(), public.virar_credito(), passeio_sem_manutencao, public._passeio_sem_manutencao(), public.cotacoes_abertas_dono(), public.tg_anotacao_neto_garantido() (+24 more)

### Community 77 - "asaas-docs/index.ts"
Cohesion: 0.10
Nodes (28): API(), avisarRejeitados(), chaveSub(), CORS, d360Key(), db, de64(), ES_DDI (+20 more)

### Community 78 - "steps"
Cohesion: 0.05
Nodes (42): concurrency, cancel-in-progress, group, ANTES, DEPOIS, FUNCOES, IN_FUNCOES, IN_SQL (+34 more)

### Community 79 - "public.donos"
Cohesion: 0.17
Nodes (13): public.aprovacoes_dono, public.dono_aprovacao_ver(), public.dono_aprovar(), public.dono_recusar(), public.tg_jetski_cortesia_mesmo_dono(), donos_cortesia_jetski, public.tg_donos_cortesia_jetski(), public.tg_consulta_aprovada_avisa_dono() (+5 more)

### Community 80 - "claude-noturno.mjs"
Cohesion: 0.10
Nodes (21): ACHADO, aviso(), carregarUso(), claude, controle(), gravarControle(), gravarIa(), LANGS3 (+13 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.43
Nodes (5): public.transferencias_saldo, transferencias_saldo_user, zz_auditar, a_teto_diario, public._transferencia_teto()

### Community 82 - "ref_npm_web_push_3_6_7"
Cohesion: 0.07
Nodes (16): CORS, db, CAT, CORS, db, CORS, db, TXT (+8 more)

### Community 83 - "public.pedido_oferta"
Cohesion: 0.20
Nodes (3): public.oferta_vendedor(), public.salvar_pcts(), public.pedido_oferta()

### Community 86 - "asaas-saude/index.ts"
Cohesion: 0.33
Nodes (6): API(), asaas(), db, Item, KEY(), testarSplit()

### Community 89 - "public.bloqueios"
Cohesion: 0.10
Nodes (20): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.lancar_pedido_operador(), public.aprovar_consulta(), public._capacidade(), public._confere_valor_op(), public._confere_valor_op() (+12 more)

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 93 - "public.clientes"
Cohesion: 0.09
Nodes (17): asaas_validacoes_id, public.asaas_chaves, public.asaas_validacoes, public.papeis_painel, public.papel_painel(), public.ativar_conta_cliente(), public.ativar_conta_cliente(), public._convite_pagar() (+9 more)

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
Cohesion: 0.08
Nodes (28): conversao_asaas, conversao_paypal, conversoes_pendentes, public.conversao_asaas(), public.conversao_paypal(), public.conversoes, public.rastreio_visitas, rastreio_visitas_consulta (+20 more)

### Community 105 - "2026-11-17_aviso-dinheiro-na-conta.sql"
Cohesion: 0.83
Nodes (3): avisos_entrada_ref, avisos_entrada_user, public.avisos_entrada

### Community 109 - "public.consultas"
Cohesion: 0.18
Nodes (8): bloqueio_trazido_por, public._bloqueio_trazido_por(), public.origem_reserva(), zz_consulta_aprovada_avisa_dono, a0_embarque_periodo, public._embarque_periodo(), public.tg_embarque_periodo(), public.combinar_neto_dono()

### Community 110 - "public._valor_na_data"
Cohesion: 0.18
Nodes (7): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.lancar_grupo_operador(), public._valor_na_data()

### Community 112 - "aviso-vendedor/index.ts"
Cohesion: 0.14
Nodes (11): ASSUNTO(), CORS, dataBR(), db, hmTxt(), MAIL, MAIL_PAGO, PUSH (+3 more)

### Community 117 - "registros-exportar.mjs"
Cohesion: 0.23
Nodes (12): api(), chamar(), chaveServidor(), dormir(), exportarFonte(), feitos, FONTES, gravar() (+4 more)

### Community 123 - "public.creditos"
Cohesion: 0.14
Nodes (13): pre_reserva_volta, public.codigo_convite(), public._pre_reserva_volta(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador(), public._credito_chat(), public.creditos (+5 more)

### Community 125 - "2026-11-16_consultas-site-fecham-sozinhas.sql"
Cohesion: 0.43
Nodes (5): a_consulta_resgate_limpa_pedido, public.tg_consulta_resgate_limpa_pedido(), public.tg_fecha_consultas_site(), zz_anotacao_fecha_consultas, zz_consulta_lancada_fecha_site

### Community 130 - "2026-11-17_retencao-registros-5-anos.sql"
Cohesion: 0.28
Nodes (4): cofre_registros_trava, public.registros_exportados, registros_exportados_trava, registros_exportados_trava_tudo

### Community 134 - "public.meus_clientes_venda"
Cohesion: 0.22
Nodes (3): public.pedido_vendedor(), public.meus_clientes_venda(), public.pedido_vendedor()

### Community 135 - "API"
Cohesion: 0.21
Nodes (12): API(), avisarDocsLiberados(), avisarEntradas(), b64(), chaveSub(), cifrar(), conferirContas(), de64() (+4 more)

### Community 136 - "public.adicionar_lancha_pre_reserva"
Cohesion: 0.12
Nodes (7): public.mover_passeio_v2(), public._ligar_passeio(), pagamentos_asaas_asaas_real_idx, public.adicionar_lancha_pre_reserva(), public._ligar_passeio(), public.pedido_grupo(), public.tg_repasse_auto()

### Community 137 - "conversoes/index.ts"
Cohesion: 0.13
Nodes (20): filtra(), ga, match(), meta, T, caminho(), cors(), db (+12 more)

### Community 140 - "public.liberar_sinal"
Cohesion: 0.25
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

### Community 152 - "vendedores"
Cohesion: 0.25
Nodes (4): public.salvar_pcts(), public.definir_parceiro(), public.definir_pct_vendedor(), public.salvar_pcts()

### Community 154 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 155 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.15
Nodes (16): public.aprovar_alteracao(), public.mover_passeio(), a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao() (+8 more)

### Community 158 - "public.salvar_netos_v3"
Cohesion: 0.16
Nodes (5): public.trocar_horario_pedido(), public.aplicar_netos(), public.salvar_netos_v3(), public._valor_na_data(), public.bz_faixa()

### Community 159 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 163 - "2026-11-22_zzzzz-horario-real-sem-sobreposicao.sql"
Cohesion: 0.18
Nodes (6): public.pp_vaga(), public.confirmar_pago(), public.pp_vaga(), public.pp_vaga_h(), public.relatorio_lucro(), public.metricas_marketing()

### Community 166 - "2026-11-21_bordazul-dono-confirma.sql"
Cohesion: 0.33
Nodes (4): a_consulta_origem, public.atendimento_origem, public.lancha_confirma_dono(), public.marcar_origem()

### Community 167 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 169 - "2026-11-05_revisao-diaria.sql"
Cohesion: 0.38
Nodes (5): public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo(), trava_cond_aviso, trava_grupo

### Community 170 - "public.cupons"
Cohesion: 0.10
Nodes (15): cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2(), pedido_zz_cupom_teto, public.cupom_site_config, public._melhor_cupom(), public.meus_cupons_v3() (+7 more)

### Community 173 - "public.cliques_google"
Cohesion: 0.43
Nodes (5): cliques_google_bloqueio, public.clique_google(), public.cliques_google, cliques_google_criado, public.clique_google()

### Community 184 - "2026-11-22_zzzzzzzz-funil-link-vendedor.sql"
Cohesion: 0.70
Nodes (4): public.funil_vendedor(), public.funil_vendedor_resumo(), public.vendedor_funil, vendedor_funil_criado

### Community 185 - "aviso-comprovante/index.ts"
Cohesion: 0.29
Nodes (4): CORS, db, SLOT, TXT

## Knowledge Gaps
- **91 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `public.bloqueios`, `public.bloqueios`, `2026-10-30_operador-um-toque.sql`, `public.consultas`, `public.bloqueios`, `public.creditos`, `pedidos`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `public.pagamentos_pp` be split into smaller, more focused modules?**
  _Cohesion score 0.10591133004926108 - nodes in this community are weakly interconnected._
- **Why does `public._aprovar_consulta()` connect `public.bloqueios` to `public.pagamentos_pp`, `public.pedidos`, `public.bloqueios`, `public.consultas`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.creditos` connect `public.creditos` to `public`, `2026-10-30_operador-um-toque.sql`, `public.bloqueios`, `public.bloqueios`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06756756756756757 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07013574660633484 - nodes in this community are weakly interconnected._
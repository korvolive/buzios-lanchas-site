# Graph Report - buzios-lanchas-site  (2026-11-18)

## Corpus Check
- 217 files · ~441,017 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .xml 3, .tflite 2, .webmanifest 2)

## Summary
- 1701 nodes · 2800 edges · 135 communities (82 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `55b62594`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- dono-aprovacao/index.ts
- public.anotacoes
- paypal-checkout/index.ts
- public._ligar_passeio
- prerender.mjs
- ref_npm_web_push_3_6_7
- steps
- steps
- steps
- public.salvar_netos_v3
- clima-site/index.ts
- clima-alertas/index.ts
- 2026-11-15_preco-cotado-garantido.sql
- consulta-resgate/index.ts
- public.liberar_sinal
- b
- pedido-indisponivel/index.ts
- aviso-vendedor/index.ts
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- public.bloqueios
- public.cupons
- aviso-chat/index.ts
- consulta-aviso/index.ts
- avaliacao/index.ts
- central-auto/index.ts
- public.revisao_dados
- public.anotacoes
- public.clientes
- whatsapp-codigo/index.ts
- steps
- public
- traduzir/index.ts
- asaas-saques/index.ts
- login/sw.js
- aviso-sinal/index.ts
- fotos-db.py
- public.marcar_wa
- cambio/index.ts
- convite_manual_marca_aviso
- trava_cond_aviso
- README.md
- steps
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- 2026-10-30_operador-um-toque.sql
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- 2026-10-30_asaas-validacao-saques.sql
- public.lanchas
- public.marcar_wa
- 2026-11-05_revisao-diaria.sql
- 2026-11-08_app-versao-minima.sql
- asaas-transferir/index.ts
- asaas-docs/index.ts
- steps
- asaas-chaves-girar/index.ts
- public.consultas
- 2026-11-13_transferir-saldo.sql
- entrar-celular/index.ts
- a
- public.jetski_usos
- asaas-saude/index.ts
- 2026-11-15_jetski-pedido.sql
- marca.js
- 2026-11-16_convite-consulta-vencida.sql
- public.ativar_conta_cliente
- env
- aviso-aprovacao/index.ts
- bordazul-anunciar/index.ts
- public.pp_vaga_h
- 2026-11-17_aviso-dinheiro-na-conta.sql
- whatsapp-webhook/index.ts
- sem-negativo.js
- public.pedidos
- public.bloqueios
- public._desc_parceiro
- public.origem_reserva
- paypal-fatura/index.ts
- aviso-lucas/index.ts
- ref_npm_supabase
- registros-exportar.mjs
- 2026-11-16_bordazul-cadastro-dono.sql
- asaas_contas_reenvio_token
- lanchas
- public.tg_tel_padrao
- aviso-comprovante/index.ts
- 2026-11-17_paypal-cai-no-asaas-repasse-auto.sql
- 2026-11-17_retencao-registros-5-anos.sql
- traduzir-chat/index.ts
- 2026-11-15_jetski-lucas.sql
- 2026-11-05_socios-nome-completo-e-convites-pendentes.sql

## God Nodes (most connected - your core abstractions)
1. `public.jetski_usos` - 28 edges
2. `public.jetskis` - 27 edges
3. `public._ligar_passeio()` - 17 edges
4. `public.cancelar_pre_reserva()` - 14 edges
5. `public.cancelar_pre_reserva()` - 14 edges
6. `public._ligar_passeio()` - 14 edges
7. `X()` - 13 edges
8. `asaas()` - 13 edges
9. `avisarDonos()` - 13 edges
10. `public.vendas_manuais` - 13 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-lucas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.jetski_do_passeio()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql
- `public.jetski_do_passeio()` --reads_from--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql

## Import Cycles
- None detected.

## Communities (135 total, 53 thin omitted)

### Community 0 - "vendedores"
Cohesion: 0.07
Nodes (17): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.oferta_vendedor(), public.salvar_pcts(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts() (+9 more)

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.05
Nodes (76): acabou(), API(), APROVADA, asaas(), atualizarCredito(), AV_DEV, avisarAdmins(), avisarAntecipadas() (+68 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.07
Nodes (43): apnsToken(), ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves() (+35 more)

### Community 4 - "dono-aprovacao/index.ts"
Cohesion: 0.11
Nodes (28): apnsToken(), aprovado(), avisarCliente(), avisarDonos(), brl(), CORS, criarModelos(), d360Key() (+20 more)

### Community 5 - "public.anotacoes"
Cohesion: 0.19
Nodes (13): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos() (+5 more)

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.07
Nodes (44): aceitarPreco(), avisarAdmins(), brlv(), COB_EUR, comQuem(), confirmarSozinho(), CORS, d360Key() (+36 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.14
Nodes (9): pre_pedido_fim, pre_pedido_sinal, public.aprovar_consulta(), public._ligar_passeio(), public._pre_pedido_fim(), public._pre_pedido_sinal(), public._ligar_passeio(), public.lancar_grupo_operador() (+1 more)

### Community 8 - "prerender.mjs"
Cohesion: 0.06
Nodes (34): m, web, SOURCE, web, erros, fotosDB(), lanchasDB(), precosDB() (+26 more)

### Community 9 - "ref_npm_web_push_3_6_7"
Cohesion: 0.13
Nodes (8): CAT, CORS, db, db, T, CORS, db, T

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.06
Nodes (31): concurrency, cancel-in-progress, group, runs-on, steps, APPLE_TEAM_ID, FTP_PASSWORD, FTP_SERVER (+23 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "public.salvar_netos_v3"
Cohesion: 0.19
Nodes (4): public.trocar_horario_pedido(), public.aplicar_netos(), public.salvar_netos_v3(), public._valor_na_data()

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "2026-11-15_preco-cotado-garantido.sql"
Cohesion: 0.07
Nodes (20): public.aprovar_foto(), public.lancar_pedido_operador(), bloqueio_trazido_por, public._bloqueio_trazido_por(), a_consulta_neto_garantido, cotacoes_garantidas_busca, cotacoes_garantidas_lancha, public.cotacoes_abertas_dono() (+12 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.15
Nodes (19): avisarPasseios(), convidarVencidas(), d360Key(), dataLonga(), db, dig(), ES_DDI, hm() (+11 more)

### Community 18 - "public.liberar_sinal"
Cohesion: 0.16
Nodes (4): public.liberar_sinal(), public.pp_vaga(), public.alterar_pedido(), public.trocar_horario_pedido()

### Community 19 - "b"
Cohesion: 0.16
Nodes (15): public.aprovar_alteracao(), public.mover_passeio(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao(), public.solicitar_alteracao(), public.registrar_alteracao(), public._credito_chat() (+7 more)

### Community 20 - "pedido-indisponivel/index.ts"
Cohesion: 0.17
Nodes (12): CORS, dataBR(), db, ddiLang(), email(), ES_DDI, lang(), livres() (+4 more)

### Community 21 - "aviso-vendedor/index.ts"
Cohesion: 0.15
Nodes (9): ASSUNTO(), CORS, dataBR(), db, MAIL, MAIL_PAGO, PUSH, PUSH_PAGO (+1 more)

### Community 22 - "steps"
Cohesion: 0.15
Nodes (12): jobs, prerender, name, on, pull_request, runs-on, steps, name (+4 more)

### Community 23 - "convite-email/index.ts"
Cohesion: 0.15
Nodes (8): CORS, db, ES_DDI, LIGA, MAPA, SLOT, TAXA, TAXA_TXT

### Community 24 - "cadastro-whatsapp/index.ts"
Cohesion: 0.22
Nodes (9): codigoDe(), confere(), CORS, db, dig(), json(), LANG, mandaCodigo() (+1 more)

### Community 25 - "public.bloqueios"
Cohesion: 0.10
Nodes (20): public.aprovar_consulta(), public.registrar_alteracao(), public.definir_condicional(), public.marcar_wa(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais (+12 more)

### Community 26 - "public.cupons"
Cohesion: 0.43
Nodes (4): cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2()

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
Cohesion: 0.19
Nodes (4): public.repasses_asaas_pendentes(), public.repasses_asaas_pendentes(), public.revisao_dados(), public.repasses_asaas_pendentes()

### Community 32 - "public.anotacoes"
Cohesion: 0.17
Nodes (9): a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.periodos_extra(), public.passeios_marinheiro_v2(), anotacoes_grupo_idx, public.anexar_comprovante_passeio(), public.aprovar_pre_pedido() (+1 more)

### Community 33 - "public.clientes"
Cohesion: 0.13
Nodes (9): public._pre_reserva_volta(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador(), public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google() (+1 more)

### Community 34 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 35 - "steps"
Cohesion: 0.07
Nodes (29): concurrency, cancel-in-progress, group, default, description, required, DIAS, PROJECT_REF (+21 more)

### Community 36 - "public"
Cohesion: 0.24
Nodes (9): public.ordenar_lanchas(), public._desc_parceiro(), jetski_dividas_dono, public.jetski_abater(), public.jetski_abater_desfaz(), public.jetski_abatimentos, public.jetski_dividas, public.meus_jetski_alugueis() (+1 more)

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

### Community 66 - "2026-10-30_asaas-validacao-saques.sql"
Cohesion: 0.67
Nodes (3): asaas_validacoes_id, public.asaas_chaves, public.asaas_validacoes

### Community 67 - "public.lanchas"
Cohesion: 0.14
Nodes (17): public.tg_pedido_jetski(), public._jetski_confere(), public.tg_pedido_jetski(), public.tg_pedido_jetski_segurado(), public.jetskis, public.tg_pedido_jetski(), public.tirar_jetski(), public.painel_sinais_desde() (+9 more)

### Community 69 - "2026-11-05_revisao-diaria.sql"
Cohesion: 0.38
Nodes (5): public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo(), trava_cond_aviso, trava_grupo

### Community 76 - "asaas-transferir/index.ts"
Cohesion: 0.25
Nodes (8): API(), asaas(), avisar(), AVISO, brl(), CORS, db, KEY()

### Community 77 - "asaas-docs/index.ts"
Cohesion: 0.10
Nodes (28): API(), avisarRejeitados(), chaveSub(), CORS, d360Key(), db, de64(), ES_DDI (+20 more)

### Community 78 - "steps"
Cohesion: 0.05
Nodes (42): concurrency, cancel-in-progress, group, ANTES, DEPOIS, FUNCOES, IN_FUNCOES, IN_SQL (+34 more)

### Community 79 - "asaas-chaves-girar/index.ts"
Cohesion: 0.32
Nodes (5): abrir(), b64(), db, de64(), fechar()

### Community 80 - "public.consultas"
Cohesion: 0.11
Nodes (9): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.lancar_grupo_operador(), public._valor_na_data(), public._teto_cheio() (+1 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.43
Nodes (5): public.transferencias_saldo, transferencias_saldo_user, zz_auditar, a_teto_diario, public._transferencia_teto()

### Community 82 - "entrar-celular/index.ts"
Cohesion: 0.33
Nodes (4): contas(), CORS, db, dig()

### Community 83 - "a"
Cohesion: 0.15
Nodes (7): public.lancar_pedido_operador(), pre_reserva_volta, public.codigo_convite(), public._confere_valor_op(), public.descontos_grupo, public.lancar_pedido_operador(), public._piso_grupo()

### Community 84 - "public.jetski_usos"
Cohesion: 0.16
Nodes (12): public.tg_pedido_jetski_uso(), jetski_uso_confere, jetski_usos_dia, public.jetski_choca(), public.jetski_desmarcar(), public.jetski_marcar(), public.jetski_ocupado(), public.jetski_salvar() (+4 more)

### Community 86 - "asaas-saude/index.ts"
Cohesion: 0.33
Nodes (6): API(), asaas(), db, Item, KEY(), testarSplit()

### Community 89 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.23
Nodes (6): pedido_jetski, pedido_jetski_uso, public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.tg_pedido_jetski()

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 93 - "public.ativar_conta_cliente"
Cohesion: 0.13
Nodes (10): public.papeis_painel, public.papel_painel(), public.ativar_conta_cliente(), public.ativar_conta_cliente(), public._convite_pagar(), public._uid_email_informado(), public.ativar_conta_cliente(), public._convite_pagar() (+2 more)

### Community 95 - "env"
Cohesion: 0.09
Nodes (22): AUTOR, GH_TOKEN, HEAD, PR, REPO, REVISOR, jobs, segunda-aprovacao (+14 more)

### Community 97 - "aviso-aprovacao/index.ts"
Cohesion: 0.27
Nodes (8): apnsToken(), dataBR(), db, L(), linha(), push(), SLOT, TXT

### Community 101 - "bordazul-anunciar/index.ts"
Cohesion: 0.09
Nodes (24): analisar(), ARQ_TIPOS, CATEG, CIDADES, codigoDe(), conferirCodigo(), CORS, cpfValido() (+16 more)

### Community 102 - "public.pp_vaga_h"
Cohesion: 0.22
Nodes (6): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocas_pedido()

### Community 105 - "2026-11-17_aviso-dinheiro-na-conta.sql"
Cohesion: 0.83
Nodes (3): avisos_entrada_ref, avisos_entrada_user, public.avisos_entrada

### Community 107 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 109 - "public.pedidos"
Cohesion: 0.15
Nodes (11): public.mb_libera_sinal_sozinho(), public.jetski_avisa_conflito(), a_msg_expirou_pre_reserva, a_pre_reserva_prazo_vale, public.tg_msg_expirou_pre_reserva(), public.tg_pre_reserva_prazo_vale(), jetski_sempre_aprendiz, public.meus_jetski_alugueis() (+3 more)

### Community 110 - "public.bloqueios"
Cohesion: 0.08
Nodes (17): public.auto_confirmar_fora(), zz_anotacao_jetski_segura, public.jetski_do_passeio(), public.tg_pedido_jetski_uso(), public.virar_credito(), public.mover_passeio_v2(), passeio_sem_manutencao, public._passeio_sem_manutencao() (+9 more)

### Community 111 - "public._desc_parceiro"
Cohesion: 0.30
Nodes (6): public.meus_socios(), public.definir_desc_parceiro(), public.definir_pct_vendedor(), public._desc_parceiro(), public.meu_vendedor(), public.vendedor_publico()

### Community 112 - "public.origem_reserva"
Cohesion: 0.18
Nodes (5): public.origem_reserva(), public._preco_vendedor(), public.meus_repasses_pp(), public.repasses_feitos(), public.saude_checagens

### Community 114 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 115 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 116 - "ref_npm_supabase"
Cohesion: 0.13
Nodes (7): CORS, db, CORS, db, CORS, db, T

### Community 117 - "registros-exportar.mjs"
Cohesion: 0.23
Nodes (12): api(), chamar(), chaveServidor(), dormir(), exportarFonte(), feitos, FONTES, gravar() (+4 more)

### Community 118 - "2026-11-16_bordazul-cadastro-dono.sql"
Cohesion: 0.24
Nodes (7): bz_cadastros_status, bz_cadastros_tel, public.bz_cadastro_decidir(), public.bz_cadastros, public.bz_cadastros_admin(), public.bz_wa_codigos, public.bz_wa_reservar()

### Community 123 - "lanchas"
Cohesion: 0.33
Nodes (3): public.salvar_lancha(), public.salvar_lancha(), public.bz_faixa()

### Community 125 - "aviso-comprovante/index.ts"
Cohesion: 0.29
Nodes (4): CORS, db, SLOT, TXT

### Community 130 - "2026-11-17_retencao-registros-5-anos.sql"
Cohesion: 0.28
Nodes (4): cofre_registros_trava, public.registros_exportados, registros_exportados_trava, registros_exportados_trava_tudo

### Community 136 - "2026-11-15_jetski-lucas.sql"
Cohesion: 0.16
Nodes (6): a_pedido_jetski_segurado, public._jetski_segura(), public.lancar_reserva_com_jetski(), public.tg_anotacao_jetski_segura(), public.tg_pedido_jetski_uso(), public.tg_anotacao_jetski_segura()

## Knowledge Gaps
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `vendedores`, `public.clientes`, `public.origem_reserva`, `public.bloqueios`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.06531204644412192 - nodes in this community are weakly interconnected._
- **Why does `public._aprovar_consulta()` connect `public.bloqueios` to `2026-11-15_preco-cotado-garantido.sql`, `public.bloqueios`, `public.pedidos`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.papeis_painel` connect `public.ativar_conta_cliente` to `public.origem_reserva`, `public.clientes`, `public.marcar_wa`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050543637966500146 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07312925170068027 - nodes in this community are weakly interconnected._
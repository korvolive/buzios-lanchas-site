# Graph Report - buzios-lanchas-site  (2026-11-17)

## Corpus Check
- 207 files · ~433,971 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .xml 3, .tflite 2, .webmanifest 2)

## Summary
- 1598 nodes · 2685 edges · 131 communities (80 shown, 51 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `850dfe6d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- dono-aprovacao/index.ts
- public._pre_reserva_volta
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
- public.aprovar_foto
- consulta-resgate/index.ts
- public.mb_libera_sinal_sozinho
- 2026-11-16_bordazul-cadastro-dono.sql
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
- aviso-comprovante/index.ts
- public.anotacoes
- public.clientes
- whatsapp-codigo/index.ts
- public.lanchas
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
- public.consultas
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- public._desc_parceiro
- 2026-11-15_jetski-lucas.sql
- public.marcar_wa
- 2026-11-05_revisao-diaria.sql
- 2026-11-08_app-versao-minima.sql
- asaas-transferir/index.ts
- asaas-docs/index.ts
- steps
- asaas-chaves-girar/index.ts
- 2026-11-15_preco-cotado-garantido.sql
- 2026-11-13_transferir-saldo.sql
- entrar-celular/index.ts
- b
- public.pp_vaga_h
- asaas-saude/index.ts
- 2026-10-30_operador-um-toque.sql
- public.revisao_dados
- marca.js
- 2026-11-16_convite-consulta-vencida.sql
- public.ativar_conta_cliente
- public.liberar_sinal
- aviso-aprovacao/index.ts
- bordazul-anunciar/index.ts
- 2026-11-15_jetski-pedido.sql
- 2026-11-17_aviso-dinheiro-na-conta.sql
- whatsapp-webhook/index.ts
- sem-negativo.js
- public.pedidos
- public.anotacoes
- lanchas
- public.jetski_usos
- paypal-fatura/index.ts
- aviso-lucas/index.ts
- ref_npm_supabase
- public._convite_pagar
- public.origem_reserva
- public.consultas
- public.mover_passeio_v2
- public.tg_tel_padrao
- 2026-10-30_asaas-validacao-saques.sql
- 2026-11-05_socios-nome-completo-e-convites-pendentes.sql
- 2026-11-17_paypal-cai-no-asaas-repasse-auto.sql
- public.passeios_marinheiro_v2

## God Nodes (most connected - your core abstractions)
1. `public.jetski_usos` - 28 edges
2. `public.jetskis` - 27 edges
3. `public._ligar_passeio()` - 17 edges
4. `public.cancelar_pre_reserva()` - 14 edges
5. `public.cancelar_pre_reserva()` - 14 edges
6. `public._ligar_passeio()` - 14 edges
7. `asaas()` - 13 edges
8. `X()` - 13 edges
9. `avisarDonos()` - 13 edges
10. `public.vendas_manuais` - 13 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-cortesia-opcional.sql → supabase/sql/2026-11-15_jetski.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-lucas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.jetskis_site_v2()` --reads_from--> `public.jetskis`  [EXTRACTED]
  supabase/sql/2026-11-17_jetski-preco-por-tempo.sql → supabase/sql/2026-11-15_jetski.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql

## Import Cycles
- None detected.

## Communities (131 total, 51 thin omitted)

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
Nodes (42): apnsToken(), ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves() (+34 more)

### Community 4 - "dono-aprovacao/index.ts"
Cohesion: 0.11
Nodes (28): apnsToken(), aprovado(), avisarCliente(), avisarDonos(), brl(), CORS, criarModelos(), d360Key() (+20 more)

### Community 5 - "public._pre_reserva_volta"
Cohesion: 0.19
Nodes (6): pre_reserva_volta, public.codigo_convite(), public._pre_reserva_volta(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador()

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.07
Nodes (42): aceitarPreco(), avisarAdmins(), brlv(), COB_EUR, comQuem(), confirmarSozinho(), CORS, d360Key() (+34 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.12
Nodes (9): pre_pedido_fim, pre_pedido_sinal, public.aprovar_consulta(), public._ligar_passeio(), public._pre_pedido_fim(), public._pre_pedido_sinal(), public._ligar_passeio(), public.lancar_grupo_operador() (+1 more)

### Community 8 - "prerender.mjs"
Cohesion: 0.06
Nodes (33): m, web, SOURCE, web, fotosDB(), lanchasDB(), precosDB(), boatPath() (+25 more)

### Community 9 - "ref_npm_web_push_3_6_7"
Cohesion: 0.10
Nodes (11): CAT, CORS, db, CORS, db, T, db, T (+3 more)

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.07
Nodes (28): runs-on, steps, APPLE_TEAM_ID, FTP_PASSWORD, FTP_SERVER, FTP_USERNAME, jobs, deploy (+20 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "public.salvar_netos_v3"
Cohesion: 0.27
Nodes (3): public.aplicar_netos(), public.salvar_netos_v3(), public._valor_na_data()

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "public.aprovar_foto"
Cohesion: 0.07
Nodes (11): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.aprovar_foto(), public.lancar_pedido_operador(), public.lancar_grupo_operador() (+3 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.15
Nodes (19): avisarPasseios(), convidarVencidas(), d360Key(), dataLonga(), db, dig(), ES_DDI, hm() (+11 more)

### Community 18 - "public.mb_libera_sinal_sozinho"
Cohesion: 0.15
Nodes (7): public.mb_libera_sinal_sozinho(), public.jetski_avisa_conflito(), public.tg_pedido_jetski_uso(), a_msg_expirou_pre_reserva, a_pre_reserva_prazo_vale, public.tg_msg_expirou_pre_reserva(), public.tg_pre_reserva_prazo_vale()

### Community 19 - "2026-11-16_bordazul-cadastro-dono.sql"
Cohesion: 0.24
Nodes (7): bz_cadastros_status, bz_cadastros_tel, public.bz_cadastro_decidir(), public.bz_cadastros, public.bz_cadastros_admin(), public.bz_wa_codigos, public.bz_wa_reservar()

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
Cohesion: 0.13
Nodes (18): public.solicitar_alteracao(), public.definir_condicional(), public.marcar_wa(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais, public.vendas_manuais_lista() (+10 more)

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

### Community 31 - "aviso-comprovante/index.ts"
Cohesion: 0.29
Nodes (4): CORS, db, SLOT, TXT

### Community 32 - "public.anotacoes"
Cohesion: 0.18
Nodes (18): a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva() (+10 more)

### Community 33 - "public.clientes"
Cohesion: 0.24
Nodes (5): public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google(), public.salvar_avaliacao_google()

### Community 34 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 35 - "public.lanchas"
Cohesion: 0.11
Nodes (12): a_pedido_jetski_segurado, public._jetski_confere(), public._jetski_segura(), public.lancar_reserva_com_jetski(), public.tg_pedido_jetski_segurado(), public.tg_pedido_jetski_uso(), public._jetski_confere(), public.jetski_cotar() (+4 more)

### Community 36 - "public"
Cohesion: 0.23
Nodes (9): public.ordenar_lanchas(), public._desc_parceiro(), jetski_dividas_dono, pedido_jetski_troca, public.jetski_abater(), public.jetski_abater_desfaz(), public.jetski_abatimentos, public.jetski_dividas (+1 more)

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
Cohesion: 0.14
Nodes (7): public.marcar_wa(), public.registrar_alteracao(), public.marcar_wa(), public.papeis_painel, public.papel_painel(), public.marcar_wa(), public.marcar_wa_aval()

### Community 60 - "steps"
Cohesion: 0.07
Nodes (34): concurrency, cancel-in-progress, group, jobs, mapa, salvar, permissions, runs-on (+26 more)

### Community 61 - "Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro"
Cohesion: 0.33
Nodes (5): Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro, Checklist antes de abrir um pull request, Falhas de segurança encontradas, Registros e troca de segredos (2026-11-13), Regras

### Community 62 - "public.consultas"
Cohesion: 0.14
Nodes (12): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.lancar_pedido_operador(), public.aprovar_consulta(), public.cancelar_pre_reserva(), public._confere_valor_op(), public.descontos_grupo (+4 more)

### Community 63 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): Mapa do projeto (Graphify), Publicar no Supabase sem confirmação, Segurança

### Community 65 - "2026-11-13_auditoria-e-registro-de-acessos.sql"
Cohesion: 0.21
Nodes (9): auditoria_em, auditoria_tabela_registro, auditoria_trava, auditoria_trava_tudo, public.auditoria, public.copiar_acessos(), public.registro_acessos, registro_acessos_em (+1 more)

### Community 66 - "public._desc_parceiro"
Cohesion: 0.23
Nodes (7): public.meus_socios(), public.definir_desc_parceiro(), public.definir_pct_vendedor(), public._desc_parceiro(), public.meu_vendedor(), public._preco_vendedor(), public.vendedor_publico()

### Community 69 - "2026-11-05_revisao-diaria.sql"
Cohesion: 0.38
Nodes (5): public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo(), trava_cond_aviso, trava_grupo

### Community 76 - "asaas-transferir/index.ts"
Cohesion: 0.25
Nodes (8): API(), asaas(), avisar(), AVISO, brl(), CORS, db, KEY()

### Community 77 - "asaas-docs/index.ts"
Cohesion: 0.11
Nodes (27): API(), avisarRejeitados(), chaveSub(), CORS, d360Key(), db, de64(), ES_DDI (+19 more)

### Community 78 - "steps"
Cohesion: 0.05
Nodes (42): concurrency, cancel-in-progress, group, ANTES, DEPOIS, FUNCOES, IN_FUNCOES, IN_SQL (+34 more)

### Community 79 - "asaas-chaves-girar/index.ts"
Cohesion: 0.32
Nodes (5): abrir(), b64(), db, de64(), fechar()

### Community 80 - "2026-11-15_preco-cotado-garantido.sql"
Cohesion: 0.24
Nodes (9): cotacoes_garantidas_busca, cotacoes_garantidas_lancha, public.cotacoes_abertas_dono(), public.cotacoes_garantidas, public._garantia_cotacao(), public._precos_lanc(), public.registrar_cotacao(), public.tg_anotacao_neto_garantido() (+1 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.43
Nodes (5): public.transferencias_saldo, transferencias_saldo_user, zz_auditar, a_teto_diario, public._transferencia_teto()

### Community 82 - "entrar-celular/index.ts"
Cohesion: 0.33
Nodes (4): contas(), CORS, db, dig()

### Community 83 - "b"
Cohesion: 0.20
Nodes (10): public.mover_passeio(), public.mover_passeio(), public._credito_chat(), public.creditos, public.creditos_admin(), public.meus_creditos(), public.remover_credito(), public.usar_credito() (+2 more)

### Community 84 - "public.pp_vaga_h"
Cohesion: 0.17
Nodes (7): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocar_horario_pedido(), public.trocas_pedido()

### Community 86 - "asaas-saude/index.ts"
Cohesion: 0.33
Nodes (6): API(), asaas(), db, Item, KEY(), testarSplit()

### Community 88 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.08
Nodes (8): public.aprovar_alteracao(), public.alteracoes_pedidas, public.aprovar_alteracao(), public._capacidade(), public._confere_valor_op(), public.lancar_pedido_operador(), public.recusar_alteracao(), public.registrar_alteracao()

### Community 89 - "public.revisao_dados"
Cohesion: 0.16
Nodes (4): public.repasses_asaas_pendentes(), public.pp_vaga(), public.repasses_asaas_pendentes(), public.revisao_dados()

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 93 - "public.ativar_conta_cliente"
Cohesion: 0.31
Nodes (4): public.ativar_conta_cliente(), public.ativar_conta_cliente(), public._convite_pagar(), public.ativar_conta_cliente()

### Community 95 - "public.liberar_sinal"
Cohesion: 0.25
Nodes (3): public.liberar_sinal(), public.alterar_pedido(), public.trocar_horario_pedido()

### Community 97 - "aviso-aprovacao/index.ts"
Cohesion: 0.27
Nodes (8): apnsToken(), dataBR(), db, L(), linha(), push(), SLOT, TXT

### Community 101 - "bordazul-anunciar/index.ts"
Cohesion: 0.09
Nodes (24): analisar(), ARQ_TIPOS, CATEG, CIDADES, codigoDe(), conferirCodigo(), CORS, cpfValido() (+16 more)

### Community 102 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.23
Nodes (6): pedido_jetski, pedido_jetski_uso, public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.tg_pedido_jetski()

### Community 105 - "2026-11-17_aviso-dinheiro-na-conta.sql"
Cohesion: 0.83
Nodes (3): avisos_entrada_ref, avisos_entrada_user, public.avisos_entrada

### Community 107 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 109 - "public.pedidos"
Cohesion: 0.17
Nodes (10): public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tg_pedido_jetski(), public.tg_pedido_jetski(), public.tirar_jetski(), public.painel_sinais_desde(), public.painel_sinais_hoje(), public.painel_sinais_hoje() (+2 more)

### Community 110 - "public.anotacoes"
Cohesion: 0.13
Nodes (14): public.auto_confirmar_fora(), zz_anotacao_jetski_segura, public.jetski_do_passeio(), public.virar_credito(), passeio_sem_manutencao, public._passeio_sem_manutencao(), zz_anotacao_neto_garantido, public._aprovar_consulta() (+6 more)

### Community 111 - "lanchas"
Cohesion: 0.33
Nodes (3): public.salvar_lancha(), public.salvar_lancha(), public.bz_faixa()

### Community 112 - "public.jetski_usos"
Cohesion: 0.16
Nodes (17): jetski_uso_confere, jetski_usos_dia, public.jetski_choca(), public.jetski_desmarcar(), public.jetski_marcar(), public.jetski_ocupado(), public.jetski_salvar(), public.jetski_usos (+9 more)

### Community 114 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 115 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 116 - "ref_npm_supabase"
Cohesion: 0.12
Nodes (6): CORS, db, CORS, db, CORS, db

### Community 117 - "public._convite_pagar"
Cohesion: 0.24
Nodes (4): public.preco_novo_pedido(), public.ativar_conta_cliente(), public._convite_pagar(), public._uid_email_informado()

### Community 118 - "public.origem_reserva"
Cohesion: 0.21
Nodes (6): bloqueio_trazido_por, public._bloqueio_trazido_por(), public.origem_reserva(), public.meus_repasses_pp(), public.repasses_feitos(), public.saude_checagens

### Community 122 - "public.consultas"
Cohesion: 0.33
Nodes (6): a_consulta_neto_garantido, a_consulta_resgate_limpa_pedido, public.tg_consulta_resgate_limpa_pedido(), public.tg_fecha_consultas_site(), zz_anotacao_fecha_consultas, zz_consulta_lancada_fecha_site

### Community 125 - "2026-10-30_asaas-validacao-saques.sql"
Cohesion: 0.33
Nodes (4): asaas_validacoes_id, public.asaas_chaves, public.asaas_validacoes, public.usuario_por_email()

## Knowledge Gaps
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `vendedores`, `public.anotacoes`, `public.marcar_wa`, `public.anotacoes`, `public.origem_reserva`, `public.consultas`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.06531204644412192 - nodes in this community are weakly interconnected._
- **Why does `public.marcar_wa()` connect `public.marcar_wa` to `public.anotacoes`, `public.bloqueios`, `2026-10-30_operador-um-toque.sql`, `public.consultas`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.papeis_painel` connect `public.marcar_wa` to `public.ativar_conta_cliente`, `public.origem_reserva`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050543637966500146 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07446808510638298 - nodes in this community are weakly interconnected._
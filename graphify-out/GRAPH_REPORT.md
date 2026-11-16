# Graph Report - buzios-lanchas-site  (2026-11-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1442 nodes · 2381 edges · 107 communities (70 shown, 37 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eb160dd6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- public.meus_repasses_pp
- 2026-11-15_jetski-pedido.sql
- paypal-checkout/index.ts
- public._ligar_passeio
- prerender.mjs
- ref_npm_supabase
- steps
- steps
- steps
- pedido-vendedor/index.ts
- clima-site/index.ts
- clima-alertas/index.ts
- public.pp_vaga
- consulta-resgate/index.ts
- 2026-11-15_jetski.sql
- public.pp_vaga_h
- pedido-indisponivel/index.ts
- aviso-vendedor/index.ts
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- aviso-equipe/index.ts
- 2026-11-05_socios-nome-completo-e-convites-pendentes.sql
- aviso-chat/index.ts
- consulta-aviso/index.ts
- avaliacao/index.ts
- central-auto/index.ts
- aviso-comprovante/index.ts
- entrar-celular/index.ts
- public.clientes
- whatsapp-codigo/index.ts
- paypal-fatura/index.ts
- traduzir-chat/index.ts
- traduzir/index.ts
- asaas-saques/index.ts
- login/sw.js
- aviso-sinal/index.ts
- fotos-db.py
- asaas-saude/index.ts
- cambio/index.ts
- convite_manual_marca_aviso
- trava_cond_aviso
- README.md
- public.aprovar_foto
- steps
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- public.consultas
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- public._desc_parceiro
- public.marcar_wa
- 2026-11-05_revisao-diaria.sql
- 2026-11-08_app-versao-minima.sql
- asaas-transferir/index.ts
- asaas-docs/index.ts
- steps
- asaas-chaves-girar/index.ts
- public.lanchas
- 2026-11-13_transferir-saldo.sql
- public.aprovar_consulta
- public.lanchas
- public.tg_anotacao_jetski_segura
- public.bloqueios
- whatsapp-webhook/index.ts
- marca.js
- 2026-11-16_bordazul-cadastro-dono.sql
- 2026-11-15_preco-cotado-garantido.sql
- public.anotacoes
- aviso-aprovacao/index.ts
- bordazul-anunciar/index.ts
- 2026-10-30_operador-um-toque.sql
- public.marcar_wa
- public.revisao_dados
- public.salvar_netos_v3
- 2026-11-16_consultas-site-fecham-sozinhas.sql
- lanchas
- public.jetski_do_passeio

## God Nodes (most connected - your core abstractions)
1. `public.jetski_usos` - 23 edges
2. `public.jetskis` - 17 edges
3. `public._ligar_passeio()` - 17 edges
4. `public.cancelar_pre_reserva()` - 14 edges
5. `public.cancelar_pre_reserva()` - 14 edges
6. `public._ligar_passeio()` - 14 edges
7. `X()` - 13 edges
8. `public.marcar_wa()` - 13 edges
9. `public.cancelar_pre_reserva()` - 13 edges
10. `public.vendas_manuais` - 13 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-cortesia-opcional.sql → supabase/sql/2026-11-15_jetski.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.marcar_wa()` --writes_to--> `public.alteracoes_pedidas`  [EXTRACTED]
  supabase/sql/2026-10-30_papeis-operador-auditor.sql → supabase/sql/2026-10-30_operador-um-toque.sql
- `public.origem_reserva()` --reads_from--> `public.papeis_painel`  [EXTRACTED]
  supabase/sql/2026-11-13_origem-da-reserva.sql → supabase/sql/2026-10-30_papeis-operador-auditor.sql

## Import Cycles
- None detected.

## Communities (107 total, 37 thin omitted)

### Community 0 - "vendedores"
Cohesion: 0.07
Nodes (17): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.oferta_vendedor(), public.salvar_pcts(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts() (+9 more)

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.06
Nodes (58): acabou(), API(), APROVADA, asaas(), AV_DEV, avisarAdmins(), avisarAntecipadas(), avisarAprovada() (+50 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.07
Nodes (42): apnsToken(), ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves() (+34 more)

### Community 4 - "public.meus_repasses_pp"
Cohesion: 0.38
Nodes (4): public.meus_repasses_pp(), public.painel_sinais_hoje(), public.repasses_feitos(), public.saude_checagens

### Community 5 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.23
Nodes (6): pedido_jetski, pedido_jetski_uso, public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.tg_pedido_jetski()

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.08
Nodes (38): aceitarPreco(), avisarAdmins(), brlv(), comQuem(), confirmarSozinho(), CORS, d360Key(), dataBR() (+30 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.10
Nodes (18): a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), pre_pedido_fim, pre_pedido_sinal, public.aprovar_consulta(), public._ligar_passeio(), public._pre_pedido_fim() (+10 more)

### Community 8 - "prerender.mjs"
Cohesion: 0.06
Nodes (33): m, web, SOURCE, web, fotosDB(), lanchasDB(), precosDB(), boatPath() (+25 more)

### Community 9 - "ref_npm_supabase"
Cohesion: 0.10
Nodes (11): CAT, CORS, db, CORS, db, TXT, CORS, db (+3 more)

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.07
Nodes (28): runs-on, steps, APPLE_TEAM_ID, FTP_PASSWORD, FTP_SERVER, FTP_USERNAME, jobs, deploy (+20 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "pedido-vendedor/index.ts"
Cohesion: 0.40
Nodes (3): CORS, db, T

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "public.pp_vaga"
Cohesion: 0.25
Nodes (3): public.liberar_sinal(), public.alterar_pedido(), public.trocar_horario_pedido()

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.19
Nodes (13): avisarPasseios(), dataLonga(), db, dig(), ES_DDI, hm(), horaTxt(), LANG (+5 more)

### Community 18 - "2026-11-15_jetski.sql"
Cohesion: 0.12
Nodes (19): jetski_uso_confere, jetski_usos_dia, a_pedido_jetski_segurado, public._jetski_confere(), public._jetski_segura(), public.lancar_reserva_com_jetski(), public.tg_pedido_jetski(), public.tg_pedido_jetski_segurado() (+11 more)

### Community 19 - "public.pp_vaga_h"
Cohesion: 0.17
Nodes (7): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocar_horario_pedido(), public.trocas_pedido()

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

### Community 32 - "entrar-celular/index.ts"
Cohesion: 0.33
Nodes (4): contas(), CORS, db, dig()

### Community 33 - "public.clientes"
Cohesion: 0.25
Nodes (5): public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google(), public.salvar_avaliacao_google()

### Community 34 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 35 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

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

### Community 42 - "asaas-saude/index.ts"
Cohesion: 0.33
Nodes (6): API(), asaas(), db, Item, KEY(), testarSplit()

### Community 59 - "public.aprovar_foto"
Cohesion: 0.07
Nodes (11): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.aprovar_foto(), public.lancar_pedido_operador(), public.lancar_grupo_operador() (+3 more)

### Community 60 - "steps"
Cohesion: 0.07
Nodes (34): concurrency, cancel-in-progress, group, jobs, mapa, salvar, permissions, runs-on (+26 more)

### Community 61 - "Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro"
Cohesion: 0.33
Nodes (5): Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro, Checklist antes de abrir um pull request, Falhas de segurança encontradas, Registros e troca de segredos (2026-11-13), Regras

### Community 62 - "public.consultas"
Cohesion: 0.12
Nodes (17): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), pre_reserva_volta, public._pre_reserva_volta(), public.vencer_pre_pedidos() (+9 more)

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
Cohesion: 0.24
Nodes (9): API(), chaveSub(), CORS, db, de64(), KEY(), LEMBRA, segredo() (+1 more)

### Community 78 - "steps"
Cohesion: 0.05
Nodes (42): concurrency, cancel-in-progress, group, ANTES, DEPOIS, FUNCOES, IN_FUNCOES, IN_SQL (+34 more)

### Community 79 - "asaas-chaves-girar/index.ts"
Cohesion: 0.32
Nodes (5): abrir(), b64(), db, de64(), fechar()

### Community 80 - "public.lanchas"
Cohesion: 0.12
Nodes (12): public.lancar_pedido_operador(), public._capacidade(), public._confere_valor_op(), public._confere_valor_op(), public.descontos_grupo, public.lancar_pedido_operador(), public._piso_grupo(), public.lancar_pedido_operador() (+4 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.43
Nodes (5): public.transferencias_saldo, transferencias_saldo_user, zz_auditar, a_teto_diario, public._transferencia_teto()

### Community 82 - "public.aprovar_consulta"
Cohesion: 0.20
Nodes (11): public.aprovar_consulta(), public.codigo_convite(), public.aprovar_consulta(), public._credito_chat(), public.creditos, public.creditos_admin(), public.meus_creditos(), public.remover_credito() (+3 more)

### Community 83 - "public.lanchas"
Cohesion: 0.13
Nodes (12): public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.jetski_avisa_conflito(), public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.painel_sinais_desde(), public.painel_sinais_hoje() (+4 more)

### Community 89 - "public.bloqueios"
Cohesion: 0.11
Nodes (17): public.registrar_alteracao(), public.definir_condicional(), public.marcar_wa(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais, public.vendas_manuais_lista() (+9 more)

### Community 90 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 92 - "2026-11-16_bordazul-cadastro-dono.sql"
Cohesion: 0.24
Nodes (7): bz_cadastros_status, bz_cadastros_tel, public.bz_cadastro_decidir(), public.bz_cadastros, public.bz_cadastros_admin(), public.bz_wa_codigos, public.bz_wa_reservar()

### Community 93 - "2026-11-15_preco-cotado-garantido.sql"
Cohesion: 0.06
Nodes (23): asaas_validacoes_id, public.asaas_chaves, public.asaas_validacoes, cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2(), cotacoes_garantidas_busca (+15 more)

### Community 95 - "public.anotacoes"
Cohesion: 0.10
Nodes (8): public.auto_confirmar_fora(), zz_anotacao_jetski_segura, public.mb_libera_sinal_sozinho(), public.mover_passeio_v2(), passeio_sem_manutencao, public._passeio_sem_manutencao(), public._aprovar_consulta(), public._soltar_anterior_mesmo_cliente()

### Community 97 - "aviso-aprovacao/index.ts"
Cohesion: 0.27
Nodes (8): apnsToken(), dataBR(), db, L(), linha(), push(), SLOT, TXT

### Community 101 - "bordazul-anunciar/index.ts"
Cohesion: 0.09
Nodes (24): analisar(), ARQ_TIPOS, CATEG, CIDADES, codigoDe(), conferirCodigo(), CORS, cpfValido() (+16 more)

### Community 102 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.08
Nodes (9): public.aprovar_alteracao(), public.mover_passeio(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao(), public.lancar_pedido_operador(), public.recusar_alteracao(), public.solicitar_alteracao() (+1 more)

### Community 106 - "public.marcar_wa"
Cohesion: 0.25
Nodes (4): public.marcar_wa(), public.marcar_wa(), public.papeis_painel, public.papel_painel()

### Community 107 - "public.revisao_dados"
Cohesion: 0.16
Nodes (4): public.repasses_asaas_pendentes(), public.pp_vaga(), public.repasses_asaas_pendentes(), public.revisao_dados()

### Community 108 - "public.salvar_netos_v3"
Cohesion: 0.27
Nodes (3): public.aplicar_netos(), public.salvar_netos_v3(), public._valor_na_data()

### Community 112 - "2026-11-16_consultas-site-fecham-sozinhas.sql"
Cohesion: 0.17
Nodes (9): bloqueio_trazido_por, public._bloqueio_trazido_por(), public.origem_reserva(), a_consulta_neto_garantido, a_consulta_resgate_limpa_pedido, public.tg_consulta_resgate_limpa_pedido(), public.tg_fecha_consultas_site(), zz_anotacao_fecha_consultas (+1 more)

### Community 113 - "lanchas"
Cohesion: 0.33
Nodes (3): public.salvar_lancha(), public.salvar_lancha(), public.bz_faixa()

### Community 118 - "public.jetski_do_passeio"
Cohesion: 0.22
Nodes (4): public.passeios_marinheiro_v2(), public.ordenar_lanchas(), public.jetski_do_passeio(), public.virar_credito()

## Knowledge Gaps
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `vendedores`, `public.marcar_wa`, `2026-11-16_consultas-site-fecham-sozinhas.sql`, `public.aprovar_consulta`, `public.anotacoes`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.06531204644412192 - nodes in this community are weakly interconnected._
- **Why does `public._aprovar_consulta()` connect `public.anotacoes` to `2026-11-16_consultas-site-fecham-sozinhas.sql`, `public.bloqueios`, `public.lanchas`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.origem_reserva()` connect `2026-11-16_consultas-site-fecham-sozinhas.sql` to `vendedores`, `public._desc_parceiro`, `public.meus_repasses_pp`, `public.marcar_wa`, `public.bloqueios`, `2026-11-15_preco-cotado-garantido.sql`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06001984126984127 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07446808510638298 - nodes in this community are weakly interconnected._
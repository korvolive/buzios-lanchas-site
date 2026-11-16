# Graph Report - buzios-lanchas-site  (2026-11-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1367 nodes · 2237 edges · 107 communities (67 shown, 40 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c431346c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- public._valor_na_data
- 2026-11-15_jetski-pedido.sql
- paypal-checkout/index.ts
- public._ligar_passeio
- prerender.mjs
- ref_npm_web_push_3_6_7
- steps
- steps
- steps
- aviso-lucas/index.ts
- clima-site/index.ts
- clima-alertas/index.ts
- passeio_sem_manutencao
- consulta-resgate/index.ts
- 2026-11-15_jetski.sql
- public.salvar_netos_v3
- pedido-indisponivel/index.ts
- aviso-vendedor/index.ts
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- ref_npm_supabase
- public.bloqueios
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
- whatsapp-webhook/index.ts
- cambio/index.ts
- convite_manual_marca_aviso
- trava_cond_aviso
- README.md
- public.aprovar_foto
- steps
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- public
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- public.meus_socios
- 2026-11-15_jetski-revisao-geral.sql
- public.marcar_wa
- 2026-11-05_revisao-diaria.sql
- 2026-11-08_app-versao-minima.sql
- asaas-transferir/index.ts
- asaas-docs/index.ts
- steps
- asaas-chaves-girar/index.ts
- public.consultas
- 2026-11-13_transferir-saldo.sql
- public.creditos
- public.lanchas
- 2026-11-15_jetski-lucas.sql
- public.tg_anotacao_jetski_segura
- public.pedidos
- public.marcar_wa
- marca.js
- lanchas
- 2026-11-15_preco-cotado-garantido.sql
- public.pedidos
- public.anotacoes
- aviso-aprovacao/index.ts
- 2026-10-31_seguranca-travas.sql
- 2026-10-30_pedido-do-operador-pela-central.sql
- bordazul-anunciar/index.ts
- 2026-10-30_operador-um-toque.sql
- 2026-11-16_consultas-site-fecham-sozinhas.sql
- public.lancar_pedido_operador
- public._teto_cheio
- public.mover_passeio_v2

## God Nodes (most connected - your core abstractions)
1. `public.jetski_usos` - 23 edges
2. `public.jetskis` - 17 edges
3. `public._ligar_passeio()` - 17 edges
4. `public.cancelar_pre_reserva()` - 14 edges
5. `public.cancelar_pre_reserva()` - 14 edges
6. `public._ligar_passeio()` - 14 edges
7. `X()` - 13 edges
8. `public.cancelar_pre_reserva()` - 13 edges
9. `public.marcar_wa()` - 13 edges
10. `public.lancar_pedido_operador()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-cortesia-opcional.sql → supabase/sql/2026-11-15_jetski.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-lucas.sql → supabase/sql/2026-11-15_jetski.sql
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-revisao-geral.sql → supabase/sql/2026-11-15_jetski.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public._jetski_segura()` --writes_to--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-lucas.sql → supabase/sql/2026-11-15_jetski.sql

## Import Cycles
- None detected.

## Communities (107 total, 40 thin omitted)

### Community 0 - "vendedores"
Cohesion: 0.06
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

### Community 4 - "public._valor_na_data"
Cohesion: 0.18
Nodes (7): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.lancar_grupo_operador(), public._valor_na_data()

### Community 5 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.23
Nodes (6): pedido_jetski, pedido_jetski_uso, public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.tg_pedido_jetski()

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.08
Nodes (38): aceitarPreco(), avisarAdmins(), brlv(), comQuem(), confirmarSozinho(), CORS, d360Key(), dataBR() (+30 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.16
Nodes (7): public.aprovar_consulta(), public._ligar_passeio(), public._ligar_passeio(), anotacoes_grupo_idx, public.lancar_grupo_operador(), public._ligar_passeio(), public._pre_pedido_fim()

### Community 8 - "prerender.mjs"
Cohesion: 0.06
Nodes (33): m, web, SOURCE, web, fotosDB(), lanchasDB(), precosDB(), boatPath() (+25 more)

### Community 9 - "ref_npm_web_push_3_6_7"
Cohesion: 0.13
Nodes (8): CAT, CORS, db, CORS, db, T, db, T

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.07
Nodes (28): runs-on, steps, APPLE_TEAM_ID, FTP_PASSWORD, FTP_SERVER, FTP_USERNAME, jobs, deploy (+20 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.19
Nodes (13): avisarPasseios(), dataLonga(), db, dig(), ES_DDI, hm(), horaTxt(), LANG (+5 more)

### Community 18 - "2026-11-15_jetski.sql"
Cohesion: 0.21
Nodes (12): jetski_uso_confere, jetski_usos_dia, public.jetski_choca(), public.jetski_desmarcar(), public.jetski_marcar(), public.jetski_ocupado(), public.jetski_salvar(), public.jetski_usos (+4 more)

### Community 19 - "public.salvar_netos_v3"
Cohesion: 0.06
Nodes (15): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocar_horario_pedido(), public.trocas_pedido(), public.aplicar_netos() (+7 more)

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

### Community 25 - "ref_npm_supabase"
Cohesion: 0.18
Nodes (5): CORS, db, CORS, db, T

### Community 26 - "public.bloqueios"
Cohesion: 0.14
Nodes (10): public.registrar_alteracao(), pre_reserva_volta, public._pre_reserva_volta(), public.marcar_wa(), public.marcar_wa(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador() (+2 more)

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
Cohesion: 0.24
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

### Community 42 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 60 - "steps"
Cohesion: 0.07
Nodes (34): concurrency, cancel-in-progress, group, jobs, mapa, salvar, permissions, runs-on (+26 more)

### Community 61 - "Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro"
Cohesion: 0.33
Nodes (5): Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro, Checklist antes de abrir um pull request, Falhas de segurança encontradas, Registros e troca de segredos (2026-11-13), Regras

### Community 62 - "public"
Cohesion: 0.19
Nodes (13): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos() (+5 more)

### Community 63 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): Mapa do projeto (Graphify), Publicar no Supabase sem confirmação, Segurança

### Community 65 - "2026-11-13_auditoria-e-registro-de-acessos.sql"
Cohesion: 0.21
Nodes (9): auditoria_em, auditoria_tabela_registro, auditoria_trava, auditoria_trava_tudo, public.auditoria, public.copiar_acessos(), public.registro_acessos, registro_acessos_em (+1 more)

### Community 67 - "2026-11-15_jetski-revisao-geral.sql"
Cohesion: 0.15
Nodes (7): public.passeios_marinheiro_v2(), public.auto_confirmar_fora(), zz_anotacao_jetski_segura, public.jetski_do_passeio(), public.tg_pedido_jetski_uso(), public.virar_credito(), zz_anotacao_neto_garantido

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

### Community 80 - "public.consultas"
Cohesion: 0.13
Nodes (14): public.lancar_pedido_operador(), public.aprovar_consulta(), public._confere_valor_op(), public.descontos_grupo, public.lancar_pedido_operador(), public._piso_grupo(), public.lancar_pedido_operador(), public.lancar_pedido_vendedor() (+6 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.83
Nodes (3): public.transferencias_saldo, transferencias_saldo_user, zz_auditar

### Community 82 - "public.creditos"
Cohesion: 0.30
Nodes (8): public.codigo_convite(), public._credito_chat(), public.creditos, public.creditos_admin(), public.meus_creditos(), public.remover_credito(), public.usar_credito(), public.virar_credito()

### Community 83 - "public.lanchas"
Cohesion: 0.26
Nodes (6): public.ordenar_lanchas(), public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tg_pedido_jetski(), public.tg_pedido_jetski(), public.tirar_jetski()

### Community 86 - "2026-11-15_jetski-lucas.sql"
Cohesion: 0.20
Nodes (5): public._jetski_confere(), public._jetski_segura(), public.lancar_reserva_com_jetski(), public.tg_pedido_jetski_segurado(), public.tg_pedido_jetski_uso()

### Community 89 - "public.pedidos"
Cohesion: 0.26
Nodes (9): public.definir_condicional(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais, public.vendas_manuais_lista(), public._aprovar_consulta(), public.vendas_manuais_lista() (+1 more)

### Community 90 - "public.marcar_wa"
Cohesion: 0.19
Nodes (5): public.marcar_wa(), public.marcar_wa(), public.papeis_painel, public.papel_painel(), public.recibo_admin()

### Community 91 - "marca.js"
Cohesion: 0.52
Nodes (5): caminho(), no(), titulo(), troca(), zap()

### Community 93 - "2026-11-15_preco-cotado-garantido.sql"
Cohesion: 0.07
Nodes (19): cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2(), cotacoes_garantidas_busca, cotacoes_garantidas_lancha, public.cotacoes_abertas_dono(), public.cotacoes_garantidas (+11 more)

### Community 94 - "public.pedidos"
Cohesion: 0.22
Nodes (7): a_pedido_jetski_segurado, public.mb_libera_sinal_sozinho(), public.jetski_avisa_conflito(), a_msg_expirou_pre_reserva, a_pre_reserva_prazo_vale, public.tg_msg_expirou_pre_reserva(), public.tg_pre_reserva_prazo_vale()

### Community 95 - "public.anotacoes"
Cohesion: 0.17
Nodes (12): public.aprovar_alteracao(), public.mover_passeio(), a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao() (+4 more)

### Community 97 - "aviso-aprovacao/index.ts"
Cohesion: 0.27
Nodes (8): apnsToken(), dataBR(), db, L(), linha(), push(), SLOT, TXT

### Community 99 - "2026-10-30_pedido-do-operador-pela-central.sql"
Cohesion: 0.33
Nodes (4): pre_pedido_fim, pre_pedido_sinal, public._pre_pedido_fim(), public._pre_pedido_sinal()

### Community 101 - "bordazul-anunciar/index.ts"
Cohesion: 0.09
Nodes (24): analisar(), ARQ_TIPOS, CATEG, CIDADES, codigoDe(), conferirCodigo(), CORS, cpfValido() (+16 more)

### Community 102 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.15
Nodes (3): public._capacidade(), public._confere_valor_op(), public.recusar_alteracao()

### Community 103 - "2026-11-16_consultas-site-fecham-sozinhas.sql"
Cohesion: 0.33
Nodes (6): a_consulta_neto_garantido, a_consulta_resgate_limpa_pedido, public.tg_consulta_resgate_limpa_pedido(), public.tg_fecha_consultas_site(), zz_anotacao_fecha_consultas, zz_consulta_lancada_fecha_site

## Knowledge Gaps
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.ativar_conta_cliente()` connect `2026-11-15_preco-cotado-garantido.sql` to `public.lanchas`, `2026-11-15_jetski-revisao-geral.sql`, `public.marcar_wa`, `public.pedidos`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.06359189378057302 - nodes in this community are weakly interconnected._
- **Why does `public.papeis_painel` connect `public.marcar_wa` to `2026-11-15_preco-cotado-garantido.sql`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.marcar_wa()` connect `public.marcar_wa` to `public.consultas`, `public.pedidos`, `public.bloqueios`, `public`, `public.anotacoes`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06001984126984127 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07446808510638298 - nodes in this community are weakly interconnected._
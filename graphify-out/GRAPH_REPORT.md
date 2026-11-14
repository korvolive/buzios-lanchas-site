# Graph Report - buzios-lanchas-site  (2026-11-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 922 nodes · 1542 edges · 73 communities (41 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad68cc81`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- 2026-10-30_operador-um-toque.sql
- public.anotacoes
- paypal-checkout/index.ts
- public._ligar_passeio
- prerender.mjs
- public
- steps
- steps
- steps
- public.consultas
- public.anotacoes
- clima-alertas/index.ts
- public.bloqueios
- consulta-resgate/index.ts
- public.aprovar_foto
- public.aprovar_consulta
- pedido-indisponivel/index.ts
- aviso-vendedor/index.ts
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- aviso-equipe/index.ts
- ref_npm_web_push_3_6_7
- aviso-chat/index.ts
- consulta-aviso/index.ts
- avaliacao/index.ts
- central-auto/index.ts
- aviso-comprovante/index.ts
- entrar-celular/index.ts
- whatsapp-webhook/index.ts
- whatsapp-codigo/index.ts
- paypal-fatura/index.ts
- traduzir-chat/index.ts
- traduzir/index.ts
- login/sw.js
- aviso-sinal/index.ts
- fotos-db.py
- public.salvar_lancha
- cambio/index.ts
- convite_manual_marca_aviso
- trava_cond_aviso
- README.md
- aviso-lucas/index.ts
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- public.bloqueios
- CLAUDE.md
- htaccess.sh
- public.meus_socios
- public.marcar_wa
- 2026-11-05_revisao-diaria.sql
- 2026-11-08_app-versao-minima.sql
- 2026-10-30_papeis-operador-auditor.sql

## God Nodes (most connected - your core abstractions)
1. `public._ligar_passeio()` - 17 edges
2. `public.cancelar_pre_reserva()` - 14 edges
3. `public.cancelar_pre_reserva()` - 14 edges
4. `public._ligar_passeio()` - 14 edges
5. `X()` - 13 edges
6. `public.marcar_wa()` - 13 edges
7. `public.cancelar_pre_reserva()` - 13 edges
8. `public.marcar_wa()` - 12 edges
9. `public.aprovar_consulta()` - 12 edges
10. `public.lancar_pedido_operador()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.marcar_wa()` --writes_to--> `public.alteracoes_pedidas`  [EXTRACTED]
  supabase/sql/2026-10-30_papeis-operador-auditor.sql → supabase/sql/2026-10-30_operador-um-toque.sql
- `public.aprovar_consulta()` --writes_to--> `public.vendas_manuais`  [EXTRACTED]
  supabase/sql/2026-10-31_vendedor-lanca-pedido.sql → supabase/sql/2026-10-30_whatsapp-condicional-vendedor.sql
- `public._aprovar_consulta()` --writes_to--> `public.vendas_manuais`  [EXTRACTED]
  supabase/sql/2026-11-04_pedido-de-grupo.sql → supabase/sql/2026-10-30_whatsapp-condicional-vendedor.sql
- `public._convite_manual_marca_aviso()` --reads_from--> `public.vendas_manuais`  [EXTRACTED]
  supabase/sql/2026-11-04_venda-vendedor-aviso-oficial-sempre.sql → supabase/sql/2026-10-30_whatsapp-condicional-vendedor.sql

## Import Cycles
- None detected.

## Communities (73 total, 32 thin omitted)

### Community 0 - "vendedores"
Cohesion: 0.07
Nodes (15): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts(), public.meus_clientes_venda(), public.definir_parceiro() (+7 more)

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.07
Nodes (49): acabou(), API(), APROVADA, asaas(), AV_DEV, avisarAdmins(), avisarAntecipadas(), avisarAprovada() (+41 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.09
Nodes (37): apnsToken(), ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves() (+29 more)

### Community 4 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.06
Nodes (11): public._capacidade(), public._confere_valor_op(), public.lancar_pedido_operador(), public._piso_operador(), public.recusar_alteracao(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios() (+3 more)

### Community 5 - "public.anotacoes"
Cohesion: 0.15
Nodes (11): public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.recibo_admin(), anotacoes_grupo_idx (+3 more)

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.09
Nodes (32): avisarAdmins(), brlv(), confirmarSozinho(), CORS, d360Key(), dataBR(), dataLonga(), db (+24 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.15
Nodes (9): pre_pedido_fim, pre_pedido_sinal, public.aprovar_consulta(), public._ligar_passeio(), public._pre_pedido_fim(), public._pre_pedido_sinal(), public._ligar_passeio(), public.lancar_grupo_operador() (+1 more)

### Community 8 - "prerender.mjs"
Cohesion: 0.07
Nodes (32): m, web, SOURCE, web, fotosDB(), lanchasDB(), precosDB(), boatPath() (+24 more)

### Community 9 - "public"
Cohesion: 0.14
Nodes (8): pre_reserva_volta, public.codigo_convite(), public._pre_reserva_volta(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador(), public.passeios_para_google(), public.salvar_avaliacao_google()

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.07
Nodes (28): runs-on, steps, APPLE_TEAM_ID, FTP_PASSWORD, FTP_SERVER, FTP_USERNAME, jobs, deploy (+20 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "public.consultas"
Cohesion: 0.07
Nodes (22): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.lancar_pedido_operador(), public._confere_valor_op(), public.descontos_grupo, public.lancar_pedido_operador(), public._piso_grupo() (+14 more)

### Community 14 - "public.anotacoes"
Cohesion: 0.20
Nodes (12): public.aprovar_alteracao(), public.mover_passeio(), a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao() (+4 more)

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "public.bloqueios"
Cohesion: 0.16
Nodes (8): public.marcar_wa(), public.registrar_alteracao(), public.marcar_wa(), public.marcar_wa(), public.marcar_wa(), public.marcar_wa_aval(), public.periodos_extra(), public.passeios_marinheiro_v2()

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.19
Nodes (13): avisarPasseios(), dataLonga(), db, dig(), ES_DDI, hm(), horaTxt(), LANG (+5 more)

### Community 19 - "public.aprovar_consulta"
Cohesion: 0.21
Nodes (11): public.aprovar_consulta(), public.aprovar_consulta(), public._credito_chat(), public.creditos, public.creditos_admin(), public.meus_creditos(), public.remover_credito(), public.usar_credito() (+3 more)

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
Cohesion: 0.24
Nodes (9): codigoDe(), confere(), CORS, db, dig(), json(), LANG, mandaCodigo() (+1 more)

### Community 26 - "ref_npm_web_push_3_6_7"
Cohesion: 0.11
Nodes (11): CAT, CORS, db, CORS, db, T, db, T (+3 more)

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

### Community 33 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 34 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 35 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 37 - "traduzir/index.ts"
Cohesion: 0.47
Nodes (4): CORS, google(), mymemory(), one()

### Community 40 - "aviso-sinal/index.ts"
Cohesion: 0.22
Nodes (4): CORS, db, HOR, QUEM

### Community 41 - "fotos-db.py"
Cohesion: 0.10
Nodes (11): abre(), cabe(), corte(), eixo(), main(), pessoas(), req(), art() (+3 more)

### Community 59 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 61 - "Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro"
Cohesion: 0.40
Nodes (4): Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro, Checklist antes de abrir um pull request, Falhas de segurança encontradas, Regras

### Community 62 - "public.bloqueios"
Cohesion: 0.20
Nodes (9): public.definir_condicional(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais, public.vendas_manuais_lista(), public._pre_pedido_fim(), public.vendas_manuais_lista() (+1 more)

### Community 69 - "2026-11-05_revisao-diaria.sql"
Cohesion: 0.38
Nodes (5): public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo(), trava_cond_aviso, trava_grupo

## Knowledge Gaps
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `vendedores`, `public.bloqueios`, `public.aprovar_consulta`, `public`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.07446808510638298 - nodes in this community are weakly interconnected._
- **Why does `public.minhas_vendas_v2()` connect `vendedores` to `public.bloqueios`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.marcar_wa()` connect `public.bloqueios` to `public.anotacoes`, `public`, `public.consultas`, `2026-10-30_papeis-operador-auditor.sql`, `public.anotacoes`, `public.bloqueios`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06558441558441558 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08710801393728224 - nodes in this community are weakly interconnected._
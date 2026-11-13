# Graph Report - buzios-lanchas-site  (2026-11-13)

## Corpus Check
- 124 files · ~298,875 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .tflite 2, .webmanifest 2, (none) 1)

## Summary
- 890 nodes · 1491 edges · 70 communities (38 shown, 32 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e84172d7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- public._valor_na_data
- 2026-10-30_operador-um-toque.sql
- paypal-checkout/index.ts
- public.donos
- prerender.mjs
- public.marcar_wa
- steps
- steps
- steps
- public.consultas
- 2026-11-05_revisao-diaria.sql
- clima-alertas/index.ts
- public.lancar_pedido_operador
- consulta-resgate/index.ts
- public.aprovar_foto
- aviso-preco/index.ts
- pedido-indisponivel/index.ts
- aviso-vendedor/index.ts
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- ref_npm_supabase
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
- pedido-vendedor/index.ts
- login/sw.js
- fotos-db.py
- public.salvar_lancha
- cambio/index.ts
- convite_manual_marca_aviso
- trava_cond_aviso
- README.md
- aviso-lucas/index.ts
- public.bloqueios
- CLAUDE.md
- htaccess.sh
- public.meus_socios
- public.marcar_wa
- 2026-11-08_app-versao-minima.sql

## God Nodes (most connected - your core abstractions)
1. `public._ligar_passeio()` - 17 edges
2. `public._ligar_passeio()` - 14 edges
3. `public.cancelar_pre_reserva()` - 14 edges
4. `public.cancelar_pre_reserva()` - 14 edges
5. `X()` - 13 edges
6. `public.marcar_wa()` - 13 edges
7. `public.cancelar_pre_reserva()` - 13 edges
8. `public.marcar_wa()` - 12 edges
9. `public.lancar_pedido_operador()` - 12 edges
10. `public.aprovar_consulta()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.marcar_wa()` --writes_to--> `public.alteracoes_pedidas`  [EXTRACTED]
  supabase/sql/2026-10-30_papeis-operador-auditor.sql → supabase/sql/2026-10-30_operador-um-toque.sql
- `public._convite_manual_marca_aviso()` --reads_from--> `public.vendas_manuais`  [EXTRACTED]
  supabase/sql/2026-11-04_venda-vendedor-aviso-oficial-sempre.sql → supabase/sql/2026-10-30_whatsapp-condicional-vendedor.sql
- `altG()` --calls--> `guiaPath()`  [EXTRACTED]
  scripts/prerender.mjs → scripts/paginas.mjs
- `public.salvar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-04_avaliacoes-google-salvar-ao-vivo.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql

## Import Cycles
- None detected.

## Communities (70 total, 32 thin omitted)

### Community 0 - "vendedores"
Cohesion: 0.06
Nodes (17): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.oferta_vendedor(), public.salvar_pcts(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts() (+9 more)

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.07
Nodes (49): acabou(), API(), APROVADA, asaas(), AV_DEV, avisarAdmins(), avisarAntecipadas(), avisarAprovada() (+41 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.09
Nodes (37): apnsToken(), ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves() (+29 more)

### Community 4 - "public._valor_na_data"
Cohesion: 0.18
Nodes (7): public._piso_operador(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios(), public._valor_na_data(), public.lancar_grupo_operador(), public._valor_na_data()

### Community 5 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.15
Nodes (3): public._capacidade(), public._confere_valor_op(), public.recusar_alteracao()

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.09
Nodes (32): avisarAdmins(), brlv(), confirmarSozinho(), CORS, d360Key(), dataBR(), dataLonga(), db (+24 more)

### Community 7 - "public.donos"
Cohesion: 0.29
Nodes (4): public.registrar_alteracao(), public.marcar_wa(), public.marcar_wa(), public.marcar_wa_aval()

### Community 8 - "prerender.mjs"
Cohesion: 0.07
Nodes (31): m, web, SOURCE, web, lanchasDB(), precosDB(), boatPath(), C (+23 more)

### Community 9 - "public.marcar_wa"
Cohesion: 0.23
Nodes (4): public.marcar_wa(), public.marcar_wa(), public.papeis_painel, public.papel_painel()

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
Cohesion: 0.08
Nodes (23): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.lancar_pedido_operador(), public._confere_valor_op(), public.descontos_grupo, public.lancar_pedido_operador(), public._piso_grupo() (+15 more)

### Community 14 - "2026-11-05_revisao-diaria.sql"
Cohesion: 0.38
Nodes (5): public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo(), trava_cond_aviso, trava_grupo

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.19
Nodes (13): avisarPasseios(), dataLonga(), db, dig(), ES_DDI, hm(), horaTxt(), LANG (+5 more)

### Community 19 - "aviso-preco/index.ts"
Cohesion: 0.40
Nodes (3): CORS, db, T

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
Cohesion: 0.20
Nodes (5): CAT, CORS, db, db, T

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

### Community 38 - "pedido-vendedor/index.ts"
Cohesion: 0.40
Nodes (3): CORS, db, T

### Community 41 - "fotos-db.py"
Cohesion: 0.15
Nodes (4): art(), card(), main(), pagina()

### Community 59 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 62 - "public.bloqueios"
Cohesion: 0.05
Nodes (59): public.aprovar_alteracao(), public.mover_passeio(), a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao() (+51 more)

## Knowledge Gaps
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.bloqueios` to `vendedores`, `public.marcar_wa`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.06359189378057302 - nodes in this community are weakly interconnected._
- **Why does `public.minhas_vendas_v2()` connect `vendedores` to `public.bloqueios`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.marcar_wa()` connect `public.marcar_wa` to `public.consultas`, `public.bloqueios`, `public.donos`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06558441558441558 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08710801393728224 - nodes in this community are weakly interconnected._
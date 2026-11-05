# Graph Report - buzios-lanchas-site  (2026-11-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 771 nodes · 1331 edges · 59 communities (39 shown, 20 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a37fbb35`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- 2026-10-30_operador-um-toque.sql
- public
- paypal-checkout/index.ts
- public.cancelar_pre_reserva
- prerender.mjs
- public.anotacoes
- steps
- steps
- steps
- public.consultas
- public.clientes
- clima-alertas/index.ts
- public._ligar_passeio
- consulta-resgate/index.ts
- public.pedidos
- public.bloqueios
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
- whatsapp-codigo/index.ts
- aviso-comprovante/index.ts
- entrar-celular/index.ts
- whatsapp-webhook/index.ts
- 2026-10-30_pedido-do-operador-pela-central.sql
- paypal-fatura/index.ts
- traduzir-chat/index.ts
- traduzir/index.ts
- pedido-vendedor/index.ts
- login/sw.js
- public.passeios_marinheiro_v2
- 2026-10-30_comprovante-no-passeio.sql
- public.salvar_lancha
- cambio/index.ts
- convite_manual_marca_aviso
- trava_cond_aviso
- README.md

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
- `public.lancar_pedido_vendedor()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-04_vendedor-lancar-e-limpa-avaliacoes.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.apagar_avaliacao_google()` --writes_to--> `public.avaliacoes_google`  [EXTRACTED]
  supabase/sql/2026-11-05_revisao-diaria.sql → supabase/sql/2026-11-04_avaliacoes-google-por-lancha.sql
- `public.aprovar_consulta()` --writes_to--> `public.vendas_manuais`  [EXTRACTED]
  supabase/sql/2026-10-31_vendedor-lanca-pedido.sql → supabase/sql/2026-10-30_whatsapp-condicional-vendedor.sql
- `public._aprovar_consulta()` --writes_to--> `public.vendas_manuais`  [EXTRACTED]
  supabase/sql/2026-11-04_pedido-de-grupo.sql → supabase/sql/2026-10-30_whatsapp-condicional-vendedor.sql
- `public._convite_manual_marca_aviso()` --reads_from--> `public.vendas_manuais`  [EXTRACTED]
  supabase/sql/2026-11-04_venda-vendedor-aviso-oficial-sempre.sql → supabase/sql/2026-10-30_whatsapp-condicional-vendedor.sql

## Import Cycles
- None detected.

## Communities (59 total, 20 thin omitted)

### Community 0 - "vendedores"
Cohesion: 0.06
Nodes (17): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.oferta_vendedor(), public.salvar_pcts(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts() (+9 more)

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.08
Nodes (33): acabou(), API(), asaas(), avisarAdmins(), avisarDono(), avisarExpirou(), avisarPassou(), brl() (+25 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.09
Nodes (35): ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves(), comissaoDe() (+27 more)

### Community 4 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.06
Nodes (11): public._capacidade(), public._confere_valor_op(), public.lancar_pedido_operador(), public._piso_operador(), public.recusar_alteracao(), public._valor_na_data(), precos_cheios, public.tg_precos_cheios() (+3 more)

### Community 5 - "public"
Cohesion: 0.09
Nodes (17): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.marcar_wa(), public.papeis_painel, public.papel_painel(), public._confere_valor_op(), public.descontos_grupo (+9 more)

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.10
Nodes (26): avisarAdmins(), brlv(), confirmarSozinho(), CORS, dataBR(), dataLonga(), db, dig() (+18 more)

### Community 7 - "public.cancelar_pre_reserva"
Cohesion: 0.13
Nodes (14): public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), pre_reserva_volta, public.codigo_convite(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva() (+6 more)

### Community 8 - "prerender.mjs"
Cohesion: 0.09
Nodes (17): m, web, SOURCE, web, lanchasDB(), alt(), DB_READ, LANGS (+9 more)

### Community 9 - "public.anotacoes"
Cohesion: 0.18
Nodes (13): public.aprovar_alteracao(), public.mover_passeio(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao(), public.aprovar_consulta(), public.solicitar_alteracao(), public.aprovar_consulta() (+5 more)

### Community 10 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, KS_B64, KS_PASS, jobs, android, name, on (+15 more)

### Community 11 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, jobs, deploy, name, on, push, schedule (+15 more)

### Community 12 - "steps"
Cohesion: 0.09
Nodes (21): ISSUER, KEY_ID, KEY_P8, TEAM, runs-on, steps, jobs, ios (+13 more)

### Community 13 - "public.consultas"
Cohesion: 0.19
Nodes (9): public.lancar_pedido_operador(), public.lancar_pedido_operador(), public.lancar_pedido_operador(), public.lancar_pedido_vendedor(), public.lancar_pedido_vendedor(), public.lancar_pedido_vendedor(), public.lancar_pedido_vendedor(), public.lancar_pedido_vendedor() (+1 more)

### Community 14 - "public.clientes"
Cohesion: 0.15
Nodes (10): public.apagar_avaliacao_google(), public.avaliacoes_google, public.passeios_para_google(), public.salvar_avaliacao_google(), public.salvar_avaliacao_google(), public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo() (+2 more)

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.16
Nodes (16): avisar(), Aviso, BUZIOS, COSTA, db, dentro(), inmet(), lidos (+8 more)

### Community 16 - "public._ligar_passeio"
Cohesion: 0.19
Nodes (7): public.aprovar_consulta(), public._ligar_passeio(), public._ligar_passeio(), anotacoes_grupo_idx, public.aprovar_grupo(), public.lancar_grupo_operador(), public._ligar_passeio()

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.19
Nodes (13): avisarPasseios(), dataLonga(), db, dig(), ES_DDI, hm(), horaTxt(), LANG (+5 more)

### Community 18 - "public.pedidos"
Cohesion: 0.20
Nodes (9): public.definir_condicional(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais, public.vendas_manuais_lista(), public._pre_pedido_fim(), public.vendas_manuais_lista() (+1 more)

### Community 19 - "public.bloqueios"
Cohesion: 0.19
Nodes (8): public.marcar_wa(), public.registrar_alteracao(), public._pre_reserva_volta(), public.marcar_wa(), public.marcar_wa(), public._aprovar_consulta(), public.marcar_wa_aval(), public.periodos_extra()

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

### Community 25 - "ref_npm_supabase"
Cohesion: 0.18
Nodes (5): CORS, db, CORS, db, T

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

### Community 30 - "whatsapp-codigo/index.ts"
Cohesion: 0.25
Nodes (3): CORS, db, LANG

### Community 31 - "aviso-comprovante/index.ts"
Cohesion: 0.29
Nodes (4): CORS, db, SLOT, TXT

### Community 32 - "entrar-celular/index.ts"
Cohesion: 0.33
Nodes (4): contas(), CORS, db, dig()

### Community 33 - "whatsapp-webhook/index.ts"
Cohesion: 0.33
Nodes (5): db, ES_DDI, langOf(), responder(), TXT

### Community 34 - "2026-10-30_pedido-do-operador-pela-central.sql"
Cohesion: 0.33
Nodes (4): pre_pedido_fim, pre_pedido_sinal, public._pre_pedido_fim(), public._pre_pedido_sinal()

### Community 35 - "paypal-fatura/index.ts"
Cohesion: 0.33
Nodes (3): CORS, db, ITEM

### Community 37 - "traduzir/index.ts"
Cohesion: 0.47
Nodes (4): CORS, google(), mymemory(), one()

### Community 38 - "pedido-vendedor/index.ts"
Cohesion: 0.40
Nodes (3): CORS, db, T

### Community 41 - "2026-10-30_comprovante-no-passeio.sql"
Cohesion: 0.50
Nodes (3): a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura()

## Knowledge Gaps
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public.vendas_manuais` connect `public.pedidos` to `vendedores`, `public.anotacoes`, `public.bloqueios`, `public`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.06359189378057302 - nodes in this community are weakly interconnected._
- **Why does `public.minhas_vendas_v2()` connect `vendedores` to `public.pedidos`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Why does `public.marcar_wa()` connect `public` to `public.cancelar_pre_reserva`, `public.anotacoes`, `public.consultas`, `public.pedidos`, `public.bloqueios`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08170731707317073 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08974358974358974 - nodes in this community are weakly interconnected._
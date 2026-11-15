# Graph Report - buzios-lanchas-site  (2026-11-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1178 nodes · 1921 edges · 100 communities (58 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0da00913`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- vendedores
- sortable.min.js
- asaas/index.ts
- notificar/index.ts
- 2026-10-30_operador-um-toque.sql
- 2026-11-15_jetski-pedido.sql
- paypal-checkout/index.ts
- public._ligar_passeio
- prerender.mjs
- ref_npm_web_push_3_6_7
- steps
- steps
- steps
- public._pre_reserva_volta
- clima-site/index.ts
- clima-alertas/index.ts
- public.bloqueios
- consulta-resgate/index.ts
- 2026-11-15_jetski.sql
- public.salvar_netos_v3
- pedido-indisponivel/index.ts
- aviso-vendedor/index.ts
- steps
- convite-email/index.ts
- cadastro-whatsapp/index.ts
- aviso-equipe/index.ts
- public.anotacoes
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
- aviso-lucas/index.ts
- steps
- Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro
- public.cancelar_pre_reserva
- CLAUDE.md
- htaccess.sh
- 2026-11-13_auditoria-e-registro-de-acessos.sql
- public.meus_socios
- public.passeios_marinheiro_v2
- public.marcar_wa
- 2026-11-05_revisao-diaria.sql
- 2026-11-08_app-versao-minima.sql
- asaas-transferir/index.ts
- asaas-docs/index.ts
- public.cupons
- asaas-chaves-girar/index.ts
- public.consultas
- 2026-11-13_transferir-saldo.sql
- public.creditos
- public.liberar_sinal
- public.lancar_pedido_operador
- public.tg_pedido_jetski
- public._valor_na_data
- public._teto_cheio
- public.lancar_pedido_operador
- public.lanchas
- public.mover_passeio_v2
- public.mb_libera_sinal_sozinho
- public.repasses_asaas_pendentes
- public.aprovar_foto
- public.precos
- 2026-10-30_papeis-operador-auditor.sql
- 2026-10-31_seguranca-travas.sql

## God Nodes (most connected - your core abstractions)
1. `public._ligar_passeio()` - 17 edges
2. `public.cancelar_pre_reserva()` - 14 edges
3. `public.cancelar_pre_reserva()` - 14 edges
4. `public._ligar_passeio()` - 14 edges
5. `X()` - 13 edges
6. `public.jetski_usos` - 13 edges
7. `public.cancelar_pre_reserva()` - 13 edges
8. `public.marcar_wa()` - 13 edges
9. `public.marcar_wa()` - 12 edges
10. `public.aprovar_consulta()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `public.tg_pedido_jetski_uso()` --reads_from--> `public.jetski_usos`  [EXTRACTED]
  supabase/sql/2026-11-15_jetski-cortesia-opcional.sql → supabase/sql/2026-11-15_jetski.sql
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

## Communities (100 total, 42 thin omitted)

### Community 0 - "vendedores"
Cohesion: 0.06
Nodes (17): public.minhas_vendas_v2(), public.salvar_netos_v2(), public.salvar_netos_v2(), public.oferta_vendedor(), public.salvar_pcts(), public.pedido_vendedor(), public.vendedor_do_cliente(), public.salvar_pcts() (+9 more)

### Community 1 - "sortable.min.js"
Cohesion: 0.09
Nodes (26): a(), D(), e(), f(), Ft(), G(), h(), I() (+18 more)

### Community 2 - "asaas/index.ts"
Cohesion: 0.06
Nodes (56): acabou(), API(), APROVADA, asaas(), AV_DEV, avisarAdmins(), avisarAntecipadas(), avisarAprovada() (+48 more)

### Community 3 - "notificar/index.ts"
Cohesion: 0.09
Nodes (37): apnsToken(), ASSUNTO, autoConfirma(), avisarCredito(), b64u(), brl(), brlCred(), chaves() (+29 more)

### Community 4 - "2026-10-30_operador-um-toque.sql"
Cohesion: 0.15
Nodes (3): public._capacidade(), public._confere_valor_op(), public.recusar_alteracao()

### Community 5 - "2026-11-15_jetski-pedido.sql"
Cohesion: 0.22
Nodes (6): pedido_jetski, pedido_jetski_uso, public.tg_pedido_jetski(), public.tg_pedido_jetski_uso(), public.tirar_jetski(), public.tg_pedido_jetski()

### Community 6 - "paypal-checkout/index.ts"
Cohesion: 0.07
Nodes (37): avisarAdmins(), brlv(), comQuem(), confirmarSozinho(), CORS, d360Key(), dataBR(), dataLonga() (+29 more)

### Community 7 - "public._ligar_passeio"
Cohesion: 0.13
Nodes (8): pre_pedido_fim, pre_pedido_sinal, public.aprovar_consulta(), public._ligar_passeio(), public._pre_pedido_fim(), public._pre_pedido_sinal(), public._ligar_passeio(), public._ligar_passeio()

### Community 8 - "prerender.mjs"
Cohesion: 0.06
Nodes (33): m, web, SOURCE, web, fotosDB(), lanchasDB(), precosDB(), boatPath() (+25 more)

### Community 9 - "ref_npm_web_push_3_6_7"
Cohesion: 0.11
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

### Community 13 - "public._pre_reserva_volta"
Cohesion: 0.22
Nodes (5): pre_reserva_volta, public._pre_reserva_volta(), public._aprovar_consulta(), public.convidar_cliente(), public.lancar_reserva_operador()

### Community 14 - "clima-site/index.ts"
Cohesion: 0.43
Nodes (6): avisosFortes(), ceuDe(), CORS, Hora, local(), montar()

### Community 15 - "clima-alertas/index.ts"
Cohesion: 0.15
Nodes (18): avisar(), Aviso, BUZIOS, COSTA, dataZ(), db, dentro(), inmet() (+10 more)

### Community 16 - "public.bloqueios"
Cohesion: 0.11
Nodes (19): public.registrar_alteracao(), public.definir_condicional(), public.marcar_wa(), public.resolver_condicionais(), public.venda_manual_paga(), public.venda_manual_salvar(), public.vendas_manuais, public.vendas_manuais_lista() (+11 more)

### Community 17 - "consulta-resgate/index.ts"
Cohesion: 0.19
Nodes (13): avisarPasseios(), dataLonga(), db, dig(), ES_DDI, hm(), horaTxt(), LANG (+5 more)

### Community 18 - "2026-11-15_jetski.sql"
Cohesion: 0.22
Nodes (11): jetski_uso_confere, jetski_usos_dia, public.jetski_choca(), public.jetski_desmarcar(), public.jetski_ocupado(), public.jetski_salvar(), public.jetski_usos, public.jetskis (+3 more)

### Community 19 - "public.salvar_netos_v3"
Cohesion: 0.11
Nodes (10): public.alterar_pedido(), public.segredos_app, public.pedidos_prazo_vencido(), public.pp_vaga_h(), public._troca_ok(), public.trocar_horario_pedido(), public.trocas_pedido(), public.aplicar_netos() (+2 more)

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

### Community 26 - "public.anotacoes"
Cohesion: 0.14
Nodes (16): public.aprovar_alteracao(), public.mover_passeio(), a_comprovante_segura, public.anexar_comprovante_passeio(), public._comprovante_segura(), public.mover_passeio(), public.alteracoes_pedidas, public.aprovar_alteracao() (+8 more)

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

### Community 59 - "aviso-lucas/index.ts"
Cohesion: 0.29
Nodes (3): CORS, db, TXT

### Community 60 - "steps"
Cohesion: 0.07
Nodes (34): concurrency, cancel-in-progress, group, jobs, mapa, salvar, permissions, runs-on (+26 more)

### Community 61 - "Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro"
Cohesion: 0.33
Nodes (5): Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro, Checklist antes de abrir um pull request, Falhas de segurança encontradas, Registros e troca de segredos (2026-11-13), Regras

### Community 62 - "public.cancelar_pre_reserva"
Cohesion: 0.26
Nodes (10): public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.vencer_pre_pedidos(), public.cancelar_pre_reserva(), public.cancelar_pre_reserva(), public.recibo_admin() (+2 more)

### Community 65 - "2026-11-13_auditoria-e-registro-de-acessos.sql"
Cohesion: 0.21
Nodes (9): auditoria_em, auditoria_tabela_registro, auditoria_trava, auditoria_trava_tudo, public.auditoria, public.copiar_acessos(), public.registro_acessos, registro_acessos_em (+1 more)

### Community 69 - "2026-11-05_revisao-diaria.sql"
Cohesion: 0.38
Nodes (5): public.apagar_avaliacao_google(), public.trava_cond_aviso(), public.trava_grupo(), trava_cond_aviso, trava_grupo

### Community 76 - "asaas-transferir/index.ts"
Cohesion: 0.25
Nodes (8): API(), asaas(), avisar(), AVISO, brl(), CORS, db, KEY()

### Community 77 - "asaas-docs/index.ts"
Cohesion: 0.24
Nodes (9): API(), chaveSub(), CORS, db, de64(), KEY(), LEMBRA, segredo() (+1 more)

### Community 78 - "public.cupons"
Cohesion: 0.36
Nodes (4): cupons_boas_vindas_um_por_cliente, public.gerar_cupom_boas_vindas(), public.meus_cupons(), public.meus_cupons_v2()

### Community 79 - "asaas-chaves-girar/index.ts"
Cohesion: 0.32
Nodes (5): abrir(), b64(), db, de64(), fechar()

### Community 80 - "public.consultas"
Cohesion: 0.13
Nodes (13): public.consulta_respondeu(), public.consultas_limpeza(), public.recusar_consulta(), public.lancar_pedido_operador(), public.aprovar_consulta(), public.marcar_wa(), public.marcar_wa(), public._confere_valor_op() (+5 more)

### Community 81 - "2026-11-13_transferir-saldo.sql"
Cohesion: 0.83
Nodes (3): public.transferencias_saldo, transferencias_saldo_user, zz_auditar

### Community 82 - "public.creditos"
Cohesion: 0.25
Nodes (9): public.codigo_convite(), public._credito_chat(), public.creditos, public.creditos_admin(), public.meus_creditos(), public.remover_credito(), public.usar_credito(), public.virar_credito() (+1 more)

### Community 89 - "public._valor_na_data"
Cohesion: 0.25
Nodes (4): public._valor_na_data(), public._valor_na_data(), public.lancar_grupo_operador(), public._valor_na_data()

### Community 92 - "public.lanchas"
Cohesion: 0.20
Nodes (4): public.salvar_lancha(), public.salvar_lancha(), public.ordenar_lanchas(), public.jetski_marcar()

### Community 94 - "public.mb_libera_sinal_sozinho"
Cohesion: 0.29
Nodes (3): public.mb_libera_sinal_sozinho(), passeio_sem_manutencao, public._passeio_sem_manutencao()

### Community 95 - "public.repasses_asaas_pendentes"
Cohesion: 0.22
Nodes (3): public.repasses_asaas_pendentes(), public.alterar_pedido(), public.trocar_horario_pedido()

### Community 97 - "public.precos"
Cohesion: 0.50
Nodes (3): public._piso_operador(), precos_cheios, public.tg_precos_cheios()

## Knowledge Gaps
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `public._pre_pedido_fim()` connect `public.anotacoes` to `public.bloqueios`, `public.salvar_netos_v3`, `public.cancelar_pre_reserva`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `vendedores` be split into smaller, more focused modules?**
  _Cohesion score 0.06359189378057302 - nodes in this community are weakly interconnected._
- **Why does `public.mb_libera_sinal_sozinho()` connect `public.mb_libera_sinal_sozinho` to `public._teto_cheio`, `public.liberar_sinal`, `public.mover_passeio_v2`, `2026-11-15_jetski-pedido.sql`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `sortable.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0927536231884058 - nodes in this community are weakly interconnected._
- **Should `asaas/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06093189964157706 - nodes in this community are weakly interconnected._
- **Should `notificar/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08710801393728224 - nodes in this community are weakly interconnected._
- **Should `paypal-checkout/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07439024390243902 - nodes in this community are weakly interconnected._
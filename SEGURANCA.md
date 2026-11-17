# Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro

Versão 1.1 – 17/11/2026 (1.0 de 13/11/2026). Responsável: sócio-administrador. Vale para qualquer pessoa ou ferramenta que altere os sistemas.

## Regras

1. **Segredos fora do código:** chaves, senhas e tokens só no gerenciador de segredos; nunca no código, no repositório, em planilhas ou mensagens.
2. **Acesso mínimo:** toda tabela nova nasce com regras de acesso por linha (RLS) ligadas; cada perfil vê só o necessário. Funções do banco com privilégio elevado só podem ser executadas pelo servidor, a menos que validem o usuário.
3. **Nada sensível no navegador:** chamadas a Asaas, WhatsApp e outros serviços pagos são feitas apenas por funções do servidor; o navegador nunca recebe chaves.
4. **Validar toda entrada:** dados vindos de usuários, formulários, webhooks e URLs são validados no servidor (tipo, tamanho, formato); webhooks exigem token de autenticação.
5. **Valores e permissões no servidor:** preços, sinais, descontos, repasses e permissões são calculados e conferidos no servidor; o que vem da tela é só pedido.
6. **HTTPS sempre:** todo tráfego criptografado; nada de HTTP.
7. **Dados pessoais:** coletar só o necessário (LGPD), não registrar dados pessoais ou de pagamento em logs, não guardar dados de cartão.
8. **Fluxo de alteração:** cada mudança em ramificação separada, pull request, verificação automática, aprovação do sócio-administrador antes de publicar; mudanças em pagamentos, acessos ou dados de clientes passam por revisão de segurança e, a partir da definição do revisor, por aprovação de pessoa diferente de quem fez a mudança (verificação automática `segunda-aprovacao`, ver abaixo).
9. **Testes sem dados reais:** testes usam dados fictícios e o sandbox do Asaas; a chave de produção nunca é usada em teste.
10. **Bibliotecas:** usar versões mantidas e corrigir alertas de vulnerabilidade conforme os prazos da regra de correção (crítica 24 h, alta 7 dias, média 30, baixa 90).
11. **Registro:** operações financeiras e mudanças de acesso geram registro de auditoria.

## Falhas de segurança encontradas

- Toda falha encontrada (revisão, varredura, alerta de biblioteca, aviso de terceiros) vira uma issue no GitHub com o rótulo `seguranca` e a gravidade no título: crítica, alta, média ou baixa.
- Prazos de correção: crítica 24 h, alta 7 dias, média 30 dias, baixa 90 dias.
- Falha crítica que possa expor dados de clientes ou pagamentos segue o plano de resposta a incidentes (cópia na pasta de segurança da VPS).

## Checklist antes de abrir um pull request

- Nenhum segredo no diff (chaves, tokens, senhas, connection strings).
- Tabela nova: RLS ligado e políticas por perfil; função `security definer` confere o perfil de quem chama ou só é executável pelo servidor.
- Mudança em pagamentos, Asaas, cadastro, acessos ou dados de clientes: rodar uma revisão de segurança do diff antes do merge.
- Ações que movem dinheiro ou enviam mensagens: proteção contra duplicidade e modo de simulação.
- Nada de nome de pessoa da empresa em textos para clientes.

## Registros e troca de segredos (2026-11-13)

- `public.auditoria`: inclusão, mudança e exclusão em pedidos, pagamentos, repasses, saques, contas Asaas, reservas e papéis. Só aceita inclusão (trigger bloqueia mudar e apagar, até para o administrador); guardada 5 anos. Leitura só do administrador.
- `public.registro_acessos`: cada login (hora, IP, aparelho), copiado de `auth.sessions` a cada 10 minutos; guardado 5 anos (desde 17/11/2026; antes 1 ano).
- Limpeza mensal: `limpar_registros_antigos()` (cron dia 1).
- Troca anual do segredo das chaves das subcontas (`ASAAS_CHAVES_SEGREDO`): função `asaas-chaves-girar`. Passo a passo no topo do arquivo dela: gravar o novo em `ASAAS_CHAVES_SEGREDO_NOVO`, chamar `girar`, gravar o mesmo valor em `ASAAS_CHAVES_SEGREDO`, chamar `conferir` e ver `falhas = 0`.

## Política de retenção e descarte de registros (2026-11-17)

Atende ao ponto "Retenção de logs" da avaliação de segurança do Asaas (16/11/2026).

| Registro | Onde fica | Guarda | Proteção |
|---|---|---|---|
| Auditoria de dinheiro, reservas e papéis | `public.auditoria` | 5 anos | só inclusão (trigger bloqueia mudar e apagar) |
| Logins (hora, IP, aparelho) | `public.registro_acessos` | 5 anos | sem escrita pelo site/app; leitura só do administrador |
| Acessos às APIs (por hora, caminho, IP, usuário), login e trilha de login, chamadas às funções do servidor, erros graves do banco | cofre privado `registros-seguranca` (arquivos diários `.jsonl.gz`) | 5 anos | sem acesso do site/app; trigger impede trocar ou apagar arquivo antes de 5 anos; SHA-256 de cada arquivo encadeado em `public.registros_exportados` (só inclusão) |

- A plataforma (Supabase) guarda os registros brutos só por poucos dias. Por isso o workflow `registros-exportar.yml` exporta todo dia às 05:15 (Brasília) o dia anterior; se falhar, a rodada seguinte recupera até 6 dias para trás, e a falha gera aviso do GitHub.
- Os registros não levam chaves nem conteúdo de rotinas do banco (filtrados na exportação). Dados pessoais guardados (IP, login, aparelho) são os exigidos para rastrear acessos (Marco Civil art. 15 e Resolução Conjunta BCB/CMN nº 16/2025) e só o administrador acessa.
- Conferência de integridade: recalcular o SHA-256 de cada arquivo e a cadeia (`cadeia = sha256(cadeia_anterior + sha256)`); qualquer diferença indica alteração.
- Descarte: a rotina mensal `limpar_registros_antigos()` apaga só o que passou de 5 anos. Nada é apagado antes, nem a pedido.
- Pedido de autoridade ou do Asaas: o administrador entrega os arquivos do período com os SHA-256 da tabela.

## Segregação entre quem faz e quem publica (2026-11-17)

Atende ao ponto "Segregação de desenvolvimento e implantação" da avaliação do Asaas.

- Toda mudança vai por pull request no GitHub; o histórico do PR é o registro da aprovação.
- Mudanças sensíveis (pagamentos, Asaas/PayPal, banco e permissões, login, dados de clientes, workflows de publicação) são marcadas pela verificação `segunda-aprovacao`.
- Com o revisor definido (variável `REVISOR_SEGURANCA` no GitHub: funcionário ou revisor técnico externo sob contrato), a verificação exige a aprovação dele na versão final do PR, e a proteção do `main` exige essa verificação antes do merge. O revisor não pode ser o autor da mudança.

# Búzios Lanchas Ltda – Regras de Desenvolvimento Seguro

Versão 1.0 – 13/11/2026. Responsável: sócio-administrador. Vale para qualquer pessoa ou ferramenta que altere os sistemas.

## Regras

1. **Segredos fora do código:** chaves, senhas e tokens só no gerenciador de segredos; nunca no código, no repositório, em planilhas ou mensagens.
2. **Acesso mínimo:** toda tabela nova nasce com regras de acesso por linha (RLS) ligadas; cada perfil vê só o necessário. Funções do banco com privilégio elevado só podem ser executadas pelo servidor, a menos que validem o usuário.
3. **Nada sensível no navegador:** chamadas a Asaas, WhatsApp e outros serviços pagos são feitas apenas por funções do servidor; o navegador nunca recebe chaves.
4. **Validar toda entrada:** dados vindos de usuários, formulários, webhooks e URLs são validados no servidor (tipo, tamanho, formato); webhooks exigem token de autenticação.
5. **Valores e permissões no servidor:** preços, sinais, descontos, repasses e permissões são calculados e conferidos no servidor; o que vem da tela é só pedido.
6. **HTTPS sempre:** todo tráfego criptografado; nada de HTTP.
7. **Dados pessoais:** coletar só o necessário (LGPD), não registrar dados pessoais ou de pagamento em logs, não guardar dados de cartão.
8. **Fluxo de alteração:** cada mudança em ramificação separada, pull request, verificação automática, aprovação do sócio-administrador antes de publicar; mudanças em pagamentos, acessos ou dados de clientes passam por revisão de segurança.
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
- `public.registro_acessos`: cada login (hora, IP, aparelho), copiado de `auth.sessions` a cada 10 minutos; guardado 1 ano (mínimo legal 6 meses).
- Limpeza mensal: `limpar_registros_antigos()` (cron dia 1).
- Troca anual do segredo das chaves das subcontas (`ASAAS_CHAVES_SEGREDO`): função `asaas-chaves-girar`. Passo a passo no topo do arquivo dela: gravar o novo em `ASAAS_CHAVES_SEGREDO_NOVO`, chamar `girar`, gravar o mesmo valor em `ASAAS_CHAVES_SEGREDO`, chamar `conferir` e ver `falhas = 0`.

-- Revisão das permissões de gravação (INSERT/UPDATE/DELETE) das tabelas públicas (Rodrigo 2026-10-30)
-- Só consultas: rodar não muda nada no banco.
--
-- Resultado da revisão feita em 2026-10-30 (nenhuma correção foi necessária):
--   * Todas as tabelas públicas estão com RLS ligado.
--   * Só estas tabelas têm política de gravação para usuário logado, e cada uma exige ser administrador ou o próprio dono/cliente:
--       anotacoes, bloqueios ......... pode_editar_bloqueio / pode_editar(lancha) = administrador ou dono da lancha
--                                      (apagar passeio da Búzios: só administrador; valores de passeio da Búzios travados pelo gatilho trava_valor_buzios)
--       clientes, perfis ............. a própria linha (user_id = auth.uid()) ou administrador; o gatilho trava_whatsapp_ok impede
--                                      o cliente de marcar o próprio WhatsApp como confirmado
--       consultas .................... alterar: só administrador (o operador grava pela função lancar_pedido_operador)
--       donos, ofertas, passeio_preco_base, precos, precos_neto ... só administrador (e_admin())
--       fotos_pendentes, itens, manutencoes ... administrador ou dono da lancha
--       pedidos ...................... cliente cria o próprio pedido pendente, sem passeio ligado, até 5 pendentes;
--                                      os gatilhos limpa_pedido_cliente, pedido_vendedor, pedido_cupom_* e pedido_oferta apagam ou
--                                      recalculam sinal, comprovante, PayPal, repasse, comissão, vendedor e cupom quando quem grava não é administrador.
--                                      Alterar pedido: só administrador.
--       push_subs .................... apagar só a própria inscrição
--   * Sem nenhuma política de gravação (só funções do servidor gravam): lanchas, cupons, vendedores, vendas_manuais, pagamentos_asaas,
--     pagamentos_pp, precos_hist, saques, asaas_contas, pix_donos, convites, avaliacoes, papeis_painel, admins etc.
--   * O operador e o auditor não entram em nenhuma dessas políticas: e_admin() é falso para eles e eles não são dono nem cliente.

-- 1) todas as políticas de gravação, tabela por tabela
select tablename, policyname, cmd, roles::text as papeis, qual as quem_pode_mexer, with_check as o_que_pode_gravar
  from pg_policies
 where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
 order by tablename, cmd, policyname;

-- 2) alerta: política de gravação em tabela sensível que não exige administrador, dono ou o próprio usuário
--    (tem que voltar 0 linhas)
select tablename, policyname, cmd, coalesce(qual,'') || ' / ' || coalesce(with_check,'') as regra
  from pg_policies
 where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
   and (tablename in ('pedidos','anotacoes','bloqueios','lanchas','cupons','cupom_dono','vendedores','vendas_manuais','ofertas','consultas',
                      'donos','admins','papeis_painel','saques','asaas_contas','pix_donos','clientes','perfis','vendedor_leads','cliente_vendedor')
        or tablename like 'pagamentos%' or tablename like 'precos%' or tablename like 'comiss%')
   and coalesce(qual,'') || coalesce(with_check,'') !~ '(e_admin\(\)|pode_editar|auth\.uid\(\)|admins)';

-- 3) alerta: tabela pública sem RLS (tem que voltar 0 linhas)
select c.relname as tabela_sem_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity;

-- 4) alerta: visitante sem login (anon) com permissão de gravar em alguma tabela (tem que voltar 0 linhas)
select table_name, privilege_type
  from information_schema.table_privileges
 where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
union
select table_name, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT','UPDATE');

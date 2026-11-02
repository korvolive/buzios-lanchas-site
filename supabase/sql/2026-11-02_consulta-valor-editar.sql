-- Alterar consulta: o administrador pode gravar o "Valor combinado com o cliente" (revisão 2026-11-02).
-- A tabela consultas usa permissão por coluna; a coluna valor só tinha leitura. A política consultas_admin_edita continua limitando a edição aos administradores.
grant update (valor) on public.consultas to authenticated;

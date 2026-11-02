-- Revisão diária 2026-11-02. Rodar tudo de uma vez no Supabase.

-- 1) Alterar consulta: o administrador pode gravar o "Valor combinado com o cliente".
--    A tabela consultas usa permissão por coluna; a coluna valor só tinha leitura.
--    A política consultas_admin_edita continua limitando a edição aos administradores.
grant update (valor) on public.consultas to authenticated;

-- 2) A função antiga salvar_netos (o app usa só a salvar_netos_v2) ainda aceitava Réveillon até 100% e feriado até 50%.
--    Ninguém mais pode chamá-la; a v2 deixa de ser chamável sem login.
revoke execute on function public.salvar_netos(text, jsonb, text[], integer, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.salvar_netos_v2(text, jsonb, text[], integer, numeric, numeric, jsonb) from public, anon;
grant execute on function public.salvar_netos_v2(text, jsonb, text[], integer, numeric, numeric, jsonb) to authenticated;

-- 3) Pedido lançado pelo vendedor: sem preço de tabela na data, recusa (antes passava com valor vazio e sem teto de comissão).
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'lancar_pedido_vendedor' and p.pronamespace = 'public'::regnamespace;
  if position('if not (v > 0) then' in d) = 0 then raise notice 'lancar_pedido_vendedor já estava corrigida'; return; end if;
  execute replace(d, 'if not (v > 0) then', 'if v is null or v <= 0 then');
end $$;

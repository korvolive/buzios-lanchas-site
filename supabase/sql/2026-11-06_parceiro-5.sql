-- Comissão do parceiro de 3% para 5% (Rodrigo 2026-11-06).
-- 1º passeio do cliente: paga a tabela e os 5% saem da parte da Búzios (desc_parceiro). Do 2º em diante: tabela + 5%, pago pelo cliente.
-- Pedidos antigos mantêm o valor já gravado.
update public.vendedores set teto_pct = 5, pcts = '{"baixa":5,"media":5,"alta":5}'::jsonb where parceiro;
do $$
declare d text; o text;
begin
  o := pg_get_functiondef('public.definir_parceiro'::regproc); d := o;
  d := replace(replace(d, 'cadastrar_vendedor(uid, 3)', 'cadastrar_vendedor(uid, 5)'), 'teto_pct = 3, pcts = ''{"baixa":3,"media":3,"alta":3}''', 'teto_pct = 5, pcts = ''{"baixa":5,"media":5,"alta":5}''');
  if d = o then raise exception 'definir_parceiro nao mudou'; end if; execute d;
  o := pg_get_functiondef('public.pedido_vendedor'::regproc); d := o;
  d := replace(replace(d, '* least(v.teto_pct, 3) / 100', '* v.teto_pct / 100'), 'when v.parceiro then 3 else', 'when v.parceiro then v.teto_pct else');
  if d = o or d like '%least(v.teto_pct, 3)%' then raise exception 'pedido_vendedor nao mudou'; end if; execute d;
  o := pg_get_functiondef('public.vendedor_do_cliente'::regproc); d := o;
  d := replace(d, 'case when v.parceiro then 3 else', 'case when v.parceiro then 5 else');
  if d = o then raise exception 'vendedor_do_cliente nao mudou'; end if; execute d;
end $$;

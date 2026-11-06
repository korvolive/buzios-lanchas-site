-- O administrador escolhe a comissão de cada parceiro, de 1% a 5% (padrão 5%). A diferença fica com a Búzios (Rodrigo 2026-11-06).
do $$
declare d text; o text;
begin
  o := pg_get_functiondef('public.definir_pct_vendedor'::regproc); d := o;
  d := replace(d, 'if pa then raise exception ''parceiro''; end if;', '');
  d := replace(d, 'if p < 1 or p > 10 then raise exception ''A %% vai de 1 a 10''; end if;', 'if p < 1 or p > (case when pa then 5 else 10 end) then raise exception ''A %% vai de 1 a %'', (case when pa then 5 else 10 end); end if;');
  if d = o or d like '%raise exception ''parceiro''%' then raise exception 'definir_pct_vendedor nao mudou'; end if; execute d;
  o := pg_get_functiondef('public.vendedor_do_cliente'::regproc); d := o;
  d := replace(d, 'case when v.parceiro then 5 else', 'case when v.parceiro then v.teto_pct else');
  if d = o then raise exception 'vendedor_do_cliente nao mudou'; end if; execute d;
end $$;

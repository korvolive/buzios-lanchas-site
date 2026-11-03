-- Revisão diária 2026-11-03. Rodar tudo de uma vez no Supabase.

-- 1) Parceiro, 1º passeio: a comissão do parceiro era calculada sobre o preco_base que o navegador manda.
--    Alguém podia mandar um preco_base enorme e inflar a comissão (que depois é paga automaticamente).
--    Agora a comissão sai do menor valor entre o preço do cliente e o preço de tabela da lancha naquela data.
do $$
declare d text; a text; b text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'pedido_vendedor' and p.pronamespace = 'public'::regnamespace;
  a := 'dp := round(new.preco_base * v.teto_pct / 100);';
  b := 'new.preco_cliente := least(coalesce(nullif(new.preco_cliente, 0), new.preco_base), new.preco_base);';
  if position(a in d) = 0 or position(b in d) = 0 then raise notice 'pedido_vendedor já estava diferente: nada mudou'; return; end if;
  d := replace(d, a, b);
  d := replace(d, b || E'\r\n        ' || b, b || E'\r\n        dp := round(least(new.preco_cliente, coalesce(nullif(public.preco_tabela(new.lancha, new.data, new.horario), 0), new.preco_cliente)) * v.teto_pct / 100);');
  d := replace(d, b || E'\n        ' || b, b || E'\n        dp := round(least(new.preco_cliente, coalesce(nullif(public.preco_tabela(new.lancha, new.data, new.horario), 0), new.preco_cliente)) * v.teto_pct / 100);');
  if position('public.preco_tabela(new.lancha' in d) = 0 then raise exception 'não consegui aplicar a correção: nada mudou'; end if;
  execute d;
end $$;

-- 2) vendedor_do_cliente voltou a poder ser chamada sem login (não devolve nada, mas fecha de novo).
revoke execute on function public.vendedor_do_cliente from public, anon;
grant execute on function public.vendedor_do_cliente to authenticated;

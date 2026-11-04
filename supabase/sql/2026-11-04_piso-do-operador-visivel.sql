-- 2026-11-04: o Lucas (operador) vê no formulário "Lançar pedido" o valor mínimo
-- que o sistema aceita para aquela lancha/data/período (mesma regra que já trava o lançamento).
-- Lanchas de dono: neto + metade da comissão da Búzios. Miss Bardot: regra de 3% seg-qui.
create or replace function public.piso_operador(l text, d date, h text)
returns numeric language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.e_admin() or public.papel_painel() = 'operador') then return null; end if;
  return public._piso_operador(l, d, h);
end $$;
revoke all on function public.piso_operador(text, date, text) from public, anon;
grant execute on function public.piso_operador(text, date, text) to authenticated;
select 'ok' as piso_operador;

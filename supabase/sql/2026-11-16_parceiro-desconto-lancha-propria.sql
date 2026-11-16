-- publicar: auto
-- Desconto do parceiro em lancha da própria Búzios (sem dono cadastrado, ex.: Miss Bardot): o valor todo é da Búzios,
-- então o desconto sai inteiro (sem a trava do neto, que nessas lanchas não reflete os períodos especiais).
create or replace function public._desc_parceiro(l text, d date, h text, tb numeric, pct numeric)
returns numeric language plpgsql stable security definer set search_path to 'public' as $f$
declare nt numeric;
begin
  if not (tb > 0) or not (coalesce(pct, 0) > 0) then return 0; end if;
  if not exists (select 1 from public.donos o where o.lancha = l) then
    return round(tb * pct / 100);                              -- lancha da Búzios: tudo é comissão da Búzios
  end if;
  nt := public.preco_neto_tabela(l, d, h);
  if not (nt > 0) or nt >= tb then return 0; end if;           -- sem comissão da Búzios: sem desconto
  return least(round(tb * pct / 100), tb - nt);                -- nunca passa da parte da Búzios (dono intacto)
end $f$;
revoke all on function public._desc_parceiro(text, date, text, numeric, numeric) from public, anon, authenticated;

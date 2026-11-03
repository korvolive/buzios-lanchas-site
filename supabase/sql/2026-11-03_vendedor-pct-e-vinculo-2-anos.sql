-- 2026-11-03 (Rodrigo):
-- 1) % do link de cada vendedor editável pelo administrador (1% a 10%). O cliente que entra pelo link paga tabela + essa %.
--    Parceiro continua fixo em 3%. Vendedor novo começa com 3%.
-- 2) Cliente ligado a vendedor: 2 anos (era 12 meses). Cada reserva com o mesmo vendedor renova: data do passeio + 2 anos.
--    Quem já está ligado hoje ganha mais 12 meses.

-- 1a. o administrador define a % do link de um vendedor
create or replace function public.definir_pct_vendedor(uid uuid, pct numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare pa boolean; p numeric := round(coalesce(pct, 0), 1);
begin
  if not e_admin() then raise exception 'Só o administrador'; end if;
  select parceiro into pa from vendedores where user_id = uid;
  if not found then raise exception 'Não é vendedor'; end if;
  if pa then raise exception 'parceiro'; end if;
  if p < 1 or p > 10 then raise exception 'A %% vai de 1 a 10'; end if;
  update vendedores set teto_pct = p, pcts = jsonb_build_object('baixa', p, 'media', p, 'alta', p) where user_id = uid;
  return p;
end $$;
revoke all on function public.definir_pct_vendedor(uuid, numeric) from public, anon;
grant execute on function public.definir_pct_vendedor(uuid, numeric) to authenticated;

-- 1b. o vendedor não muda a própria %: salvar_pcts só devolve a que o administrador definiu
create or replace function public.salvar_pcts(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v vendedores%rowtype;
begin
  select * into v from vendedores where user_id = auth.uid() and ativo;
  if not found then raise exception 'Você não é vendedor'; end if;
  if v.parceiro then raise exception 'parceiro' using errcode = 'P0001'; end if;
  return jsonb_build_object('baixa', v.teto_pct, 'media', v.teto_pct, 'alta', v.teto_pct);
end $$;

-- 1c. voltar de parceiro para vendedor: 3% (antes ia para 5%)
create or replace function public.definir_parceiro(uid uuid, sim boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
declare cod text;
begin
  if not e_admin() then raise exception 'Só o administrador'; end if;
  cod := public.cadastrar_vendedor(uid, 3);
  update vendedores set parceiro = sim, teto_pct = 3, pcts = '{"baixa":3,"media":3,"alta":3}'::jsonb where user_id = uid;
  return cod;
end $$;

-- 1d. pedido pelo link: vendedor usa a % dele (até 10%), parceiro 3%
-- 2.  12 meses -> 24 meses em todas as funções do vínculo com o vendedor
do $$
declare r record; f text; g text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('pedido_vendedor','liga_lead_vendedor','tg_anotacao_lead','trocar_vendedor_cliente','vendedor_do_cliente','vincular_vendedor')
  loop
    f := pg_get_functiondef(r.oid);
    g := replace(f, '12 months', '24 months');
    if r.proname = 'pedido_vendedor' then
      g := replace(g, '(1 + least(v.teto_pct, 3) / 100)', '(1 + (case when v.parceiro then 3 else least(greatest(v.teto_pct, 1), 10) end) / 100)');
      if position('case when v.parceiro then 3 else least(greatest(v.teto_pct, 1), 10) end' in g) = 0 then raise exception 'pedido_vendedor: trecho da %% não encontrado'; end if;
    end if;
    if g = f then raise exception 'nada mudou em %', r.proname; end if;
    execute g;
  end loop;
end $$;

-- 2b. quem já está ligado a um vendedor hoje ganha mais 12 meses (fica 2 anos)
update public.cliente_vendedor set ate = ate + interval '12 months' where vendedor is not null and ate > now();

-- conferir
select proname, pg_get_functiondef(p.oid) ~ '12 months' tem_12, pg_get_functiondef(p.oid) ~ '24 months' tem_24
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('pedido_vendedor','liga_lead_vendedor','tg_anotacao_lead','trocar_vendedor_cliente','vendedor_do_cliente','vincular_vendedor','definir_pct_vendedor');

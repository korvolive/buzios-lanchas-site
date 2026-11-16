-- publicar: auto
-- Parceiro (Rodrigo 2026-11-16): comissão de 1% a 10% PAGA PELO CLIENTE (por cima da tabela) e desconto do 1º passeio
-- de 0% a 10%, separado, que sai da comissão da Búzios (nunca do dono; travado no que a Búzios ganha naquela lancha/data).
-- Exemplo tabela R$ 2.000, comissão 10%, desconto 5%: 1º passeio o cliente paga 2.100, o parceiro ganha 200, a Búzios abre mão de 100.
-- Do 2º passeio em diante: tabela + comissão (2.200). Parceiros que já existiam ficam com desconto = comissão (mesmo preço de hoje).
alter table public.vendedores add column if not exists desc_pct numeric;
alter table public.vendedores alter column desc_pct set default 5;  -- parceiro novo começa com 5% de desconto
update public.vendedores set desc_pct = coalesce(case when parceiro then teto_pct end, 5) where desc_pct is null;

create or replace function public._desc_parceiro(l text, d date, h text, tb numeric, pct numeric)
returns numeric language plpgsql stable security definer set search_path to 'public' as $f$
declare nt numeric;
begin
  if not (tb > 0) or not (coalesce(pct, 0) > 0) then return 0; end if;
  nt := public.preco_neto_tabela(l, d, h);
  if not (nt > 0) or nt >= tb then return 0; end if;           -- sem comissão da Búzios: sem desconto
  return least(round(tb * pct / 100), tb - nt);                -- nunca passa da parte da Búzios
end $f$;
revoke all on function public._desc_parceiro(text, date, text, numeric, numeric) from public, anon, authenticated;

create or replace function public.definir_pct_vendedor(uid uuid, pct numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $f$
declare pa boolean; p numeric := round(coalesce(pct, 0), 1);
begin
  if not e_admin() then raise exception 'Só o administrador'; end if;
  select parceiro into pa from vendedores where user_id = uid;
  if not found then raise exception 'Não é vendedor'; end if;
  if p < 1 or p > 10 then raise exception 'A %% vai de 1 a 10'; end if;
  update vendedores set teto_pct = p, pcts = jsonb_build_object('baixa', p, 'media', p, 'alta', p) where user_id = uid;
  return p;
end $f$;

create or replace function public.definir_desc_parceiro(uid uuid, pct numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $f$
declare pa boolean; p numeric := round(coalesce(pct, 0), 1);
begin
  if not e_admin() then raise exception 'Só o administrador'; end if;
  select parceiro into pa from vendedores where user_id = uid;
  if not found or not coalesce(pa, false) then raise exception 'Não é parceiro'; end if;
  if p < 0 or p > 10 then raise exception 'O desconto vai de 0 a 10%%'; end if;
  update vendedores set desc_pct = p where user_id = uid;
  return p;
end $f$;
revoke all on function public.definir_desc_parceiro(uuid, numeric) from public, anon;
grant execute on function public.definir_desc_parceiro(uuid, numeric) to authenticated;

-- preço do link (Lucas/ponte usam por preco_vendedor): parceiro = 1º passeio (tabela + comissão - desconto)
create or replace function public._preco_vendedor(uid uuid, l text, d date, h text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $f$
declare v public.vendedores%rowtype; tab numeric; base numeric; pct numeric; preco numeric; com numeric; dp numeric := 0;
begin
  select * into v from public.vendedores where user_id = uid and ativo;
  if v.user_id is null then return null; end if;
  tab := public.preco_tabela(l, d, h);
  if tab is null or tab <= 0 then return null; end if;
  if exists (select 1 from public.donos o where o.user_id = v.user_id and o.lancha = l) then
    preco := tab; base := tab; com := 0;  -- lancha do próprio vendedor: sem comissão
  elsif coalesce(v.parceiro, false) then
    com := round(tab * least(greatest(coalesce(v.teto_pct, 5), 1), 10) / 100);
    dp := public._desc_parceiro(l, d, h, tab, v.desc_pct);
    base := tab - dp; preco := base + com;  -- comissão paga pelo cliente; desconto sai da Búzios
  else
    base := tab - public._bz_reducao(l, d, h, v.bz_pct);
    pct := least(greatest(coalesce(v.teto_pct, 1), 1), 10);
    preco := round(base * (1 + pct / 100)); com := preco - base;
  end if;
  return jsonb_build_object('codigo', v.codigo, 'parceiro', coalesce(v.parceiro, false), 'tabela', tab, 'base', base, 'preco', preco, 'comissao', com, 'desconto', dp);
end $f$;

-- trigger do pedido: troca só o ramo do 1º passeio com parceiro
do $$
declare o text; d text;
begin
  o := replace(pg_get_functiondef('public.pedido_vendedor'::regproc), chr(13), ''); d := o;  -- a função está gravada com CRLF
  if position('_desc_parceiro' in o) > 0 then return; end if;  -- já aplicado
  d := replace(d, $a$        new.preco_cliente := least(coalesce(nullif(new.preco_cliente, 0), new.preco_base), new.preco_base);
        dp := round(least(new.preco_cliente, coalesce(nullif(public.preco_tabela(new.lancha, new.data, new.horario), 0), new.preco_cliente)) * v.teto_pct / 100);
        new.preco_base := new.preco_cliente - dp;
        new.desc_parceiro := dp;
        new.acrescimo_pct := null;$a$,
  $b$        -- (Rodrigo 2026-11-16) comissão do parceiro paga pelo cliente; o desconto do 1º passeio sai da comissão da Búzios
        tb := least(new.preco_base, coalesce(nullif(public.preco_tabela(new.lancha, new.data, new.horario), 0), new.preco_base));
        dp := public._desc_parceiro(new.lancha, new.data, new.horario, tb, v.desc_pct);
        new.preco_base := tb - dp;
        new.preco_cliente := new.preco_base + round(tb * least(greatest(coalesce(v.teto_pct, 5), 1), 10) / 100);
        new.desc_parceiro := case when dp > 0 then dp end;
        new.acrescimo_pct := round((new.preco_cliente / new.preco_base - 1) * 100, 1);$b$);
  d := replace(d, '(case when v.parceiro then v.teto_pct else least(greatest(v.teto_pct, 1), 10) end)', 'least(greatest(v.teto_pct, 1), 10)');
  if d = o or position('_desc_parceiro' in d) = 0 then raise exception 'pedido_vendedor nao mudou'; end if;
  execute d;
end $$;

-- site: o link público devolve também o desconto do parceiro
drop function if exists public.vendedor_publico(text);
create function public.vendedor_publico(cod text)
returns table(codigo text, nome text, teto numeric, pcts jsonb, telefone text, proprias text[], parceiro boolean, empresa text, desconto numeric)
language sql stable security definer set search_path to 'public' as $f$
  select v.codigo, split_part(coalesce(p.nome, c.nome, f.nome, (select m.nome from marinheiros m where m.user_id = v.user_id limit 1), ''), ' ', 1), v.teto_pct, v.pcts,
    coalesce(p.telefone, c.whatsapp, f.telefone, (select m.telefone from marinheiros m where m.user_id = v.user_id and m.telefone is not null limit 1)),
    coalesce((select array_agg(d.lancha) from donos d where d.user_id = v.user_id), '{}'), v.parceiro, v.empresa,
    case when v.parceiro then coalesce(v.desc_pct, 0) else 0 end
  from vendedores v left join clientes c on c.user_id = v.user_id left join perfis p on p.user_id = v.user_id left join freelancers f on f.user_id = v.user_id
  where v.codigo = upper(btrim(cod)) and v.ativo;
$f$;
grant execute on function public.vendedor_publico(text) to anon, authenticated;

-- painel do próprio parceiro no site: precisa do desconto para mostrar o valor do 1º passeio
drop function if exists public.meu_vendedor();
create function public.meu_vendedor()
returns table(codigo text, teto numeric, pcts jsonb, proprias text[], parceiro boolean, desconto numeric)
language sql stable security definer set search_path = public as $$
  select codigo, teto_pct, pcts, coalesce((select array_agg(d.lancha) from donos d where d.user_id = auth.uid()), '{}'), parceiro,
         case when parceiro then coalesce(desc_pct, 0) end
  from vendedores where user_id = auth.uid() and ativo;
$$;
revoke all on function public.meu_vendedor() from public, anon;
grant execute on function public.meu_vendedor() to authenticated;

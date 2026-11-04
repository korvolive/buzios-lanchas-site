-- Vendedor agência (Rodrigo 2026-11-04): o vendedor também pode ter "Nome da empresa" (sem logo).
-- Se preenchido, a janelinha do link e o botão do vendedor mostram o nome da empresa.

-- 1) o próprio vendedor lê (nome null) ou salva ('' apaga) o nome da empresa
create or replace function public.minha_empresa(nome text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if nome is not null then
    update vendedores set empresa = nullif(left(btrim(nome), 60), '') where user_id = auth.uid();
  end if;
  select empresa into r from vendedores where user_id = auth.uid();
  return r;
end $$;
revoke all on function public.minha_empresa(text) from public, anon;
grant execute on function public.minha_empresa(text) to authenticated;

-- 2) o site recebe o nome da empresa também dos vendedores (antes só dos parceiros)
create or replace function public.vendedor_publico(cod text)
 returns table(codigo text, nome text, teto numeric, pcts jsonb, telefone text, proprias text[], parceiro boolean, empresa text)
 language sql stable security definer set search_path to 'public'
as $function$
  select v.codigo, split_part(coalesce(p.nome, c.nome, f.nome, (select m.nome from marinheiros m where m.user_id = v.user_id limit 1), ''), ' ', 1), v.teto_pct, v.pcts,
    coalesce(p.telefone, c.whatsapp, f.telefone, (select m.telefone from marinheiros m where m.user_id = v.user_id and m.telefone is not null limit 1)),
    coalesce((select array_agg(d.lancha) from donos d where d.user_id = v.user_id), '{}'), v.parceiro, v.empresa
  from vendedores v left join clientes c on c.user_id = v.user_id left join perfis p on p.user_id = v.user_id left join freelancers f on f.user_id = v.user_id
  where v.codigo = upper(btrim(cod)) and v.ativo;
$function$;

-- Escunas (2026-11-14). Já aplicado no banco pela migração escunas_categoria.
-- Categoria da embarcação em lanchas.dados.tipo: 'escuna' (vazio = lancha). Escuna aceita até 200 pessoas; lancha continua até 80.
-- O site mostra as escunas numa aba própria (Lanchas | Escunas), separadas das lanchas.
CREATE OR REPLACE FUNCTION public.salvar_lancha(l text, nome text, d jsonb, ativa boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cap int := (d->>'capacidade')::int; pes numeric := (d->>'pes')::numeric; tipo text := coalesce(nullif(d->>'tipo',''),'lancha');
begin
  if not e_admin() then raise exception 'so_admin'; end if;
  if l !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(l) > 40 then raise exception 'slug_invalido'; end if;
  if length(trim(coalesce(nome,''))) < 2 then raise exception 'nome_invalido'; end if;
  if tipo not in ('lancha','escuna') then raise exception 'tipo_invalido'; end if;
  if cap is null or cap < 1 or cap > (case when tipo='escuna' then 200 else 80 end) then raise exception 'capacidade_invalida'; end if;
  if pes is null or pes < 10 or pes > 200 or pes * 2 <> trunc(pes * 2) then raise exception 'pes_invalido'; end if;  -- inteiro ou meio pé
  if exists (select 1 from lanchas x where x.slug = l and x.dados is null) then raise exception 'lancha_do_codigo'; end if;
  insert into lanchas (slug, nome, dados, ativa, oculta, atualizado_em) values (l, trim(nome), d, coalesce(ativa, true), true, now())
    on conflict (slug) do update set nome = excluded.nome, dados = excluded.dados, ativa = excluded.ativa, atualizado_em = now();
  return l;
end $function$;

-- Primeira escuna (oculta até o administrador mostrar no app; nome, pés, fotos e valores editados no app):
-- insert into lanchas (slug, nome, dados, ativa, oculta) values ('escuna-buzios','Escuna Búzios', '{"pes":50,"capacidade":60,"cidade":"buzios","tipo":"escuna",...}', true, true);

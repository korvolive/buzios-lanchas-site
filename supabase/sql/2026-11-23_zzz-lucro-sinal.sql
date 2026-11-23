-- publicar: auto
-- Planilha de lucro (Rodrigo 2026-11-23): na Miss Bardot, mostrar quanto já foi recebido e quanto falta receber.
-- relatorio_lucro passa a devolver também o sinal de cada passeio. Idempotente.
create or replace function public.relatorio_lucro(p_ini date, p_fim date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare r jsonb;
begin
  if not public.e_admin() then raise exception 'admin'; end if;
  if p_ini is null or p_fim is null or p_fim < p_ini or p_fim - p_ini > 400 then raise exception 'periodo'; end if;
  with t as (
    select b.id, b.data, b.horario, b.lancha, coalesce(l.nome, b.lancha) as nome, a.cliente, a.origem,
      a.valor::numeric as v, coalesce(nullif(p.sinal_valor, 0), a.sinal, 0)::numeric as s, a.neto_dono, p.repasse_dono,
      coalesce(p.cupom_dono, 0) as cd,
      (b.lancha = 'miss-bardot') as mb,
      (coalesce(btrim(a.ajudante), '') <> '' or a.ajudante_id is not null) as aj,
      case when p.vendedor is not null and p.preco_cliente > p.preco_base then least(p.preco_cliente - p.preco_base, a.valor) else 0 end as vend
    from bloqueios b
    join anotacoes a on a.bloqueio_id = b.id
    left join lanchas l on l.slug = b.lancha
    left join lateral (select * from pedidos x where x.bloqueio_id = b.id and x.status = 'aprovado' order by x.id desc limit 1) p on true
    where b.data between p_ini and p_fim
      and b.revenda is null and coalesce(b.status_manual, '') <> 'revenda'
      and a.valor > 0
      and (b.lancha = 'miss-bardot' or (a.origem = 'buzios' and (coalesce(a.sinal, 0) > 0 or p.id is not null)))
  )
  select jsonb_build_object(
    'passeios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'data', data, 'horario', horario, 'lancha', nome, 'cliente', left(coalesce(cliente, ''), 60), 'mb', mb, 'aj', aj,
        'valor', v, 'sinal', s, 'vendedor', vend,
        'dono', case when mb then 0
                     when repasse_dono is not null then repasse_dono + greatest(v - s, 0)
                     else coalesce(neto_dono, public.preco_neto_tabela(lancha, data, horario)) - cd end
      ) order by data, horario) from t), '[]'::jsonb),
    'custos', coalesce((select jsonb_agg(to_jsonb(c) order by c.grupo, c.tipo <> 'mensal', c.id) from lucro_custos c), '[]'::jsonb),
    'gastos', coalesce((select jsonb_agg(to_jsonb(g) order by g.data, g.id) from lucro_gastos g where g.data between p_ini and p_fim), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.relatorio_lucro(date, date) from public, anon;
grant execute on function public.relatorio_lucro(date, date) to authenticated;

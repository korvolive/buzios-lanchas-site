-- publicar: auto
-- Planilha de lucro do administrador (Rodrigo 2026-11-22): dentro da aba Planilha, separada da de vendas.
-- Mostra por dia, semana, mês e ano: lucro da Miss Bardot (receita menos diárias, Marina e salário), comissão do site
-- nas lanchas parceiras (valor do cliente menos o que fica com o dono e com o vendedor) menos os custos do site,
-- e o lucro de tudo junto (menos custos gerais como o Google Ads).
-- Custos ficam editáveis pelo próprio painel (lucro_custos); gastos avulsos por dia (Google Ads etc.) em lucro_gastos.
-- Só o administrador lê e escreve. Idempotente.

create table if not exists public.lucro_custos (
  id bigserial primary key,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  grupo text not null check (grupo in ('lancha', 'site', 'geral')),
  -- mensal: custo fixo do mês; passeio_*: diária por passeio da Miss Bardot; combustivel_*: combustível por passeio da Miss Bardot
  -- (diária completa; passeio de 4 h sozinho no dia; cada um de dois passeios de 4 h no mesmo dia); por_passeio: todo passeio da Miss Bardot (insumos etc.)
  tipo text not null default 'mensal' check (tipo in ('mensal', 'passeio_marinheiro', 'passeio_ajudante', 'passeio_sozinho', 'combustivel_diaria', 'combustivel_4h', 'combustivel_4h_dois', 'por_passeio')),
  valor numeric(12,2) check (valor is null or (valor >= 0 and valor <= 1000000)),
  desde date not null default date '2026-10-01',
  ate date,
  criado_em timestamptz not null default now(),
  check (ate is null or ate >= desde)
);
alter table public.lucro_custos enable row level security;
drop policy if exists lucro_custos_admin on public.lucro_custos;
create policy lucro_custos_admin on public.lucro_custos for all to authenticated using (public.e_admin()) with check (public.e_admin());
revoke all on public.lucro_custos from public, anon;
grant select, insert, update, delete on public.lucro_custos to authenticated;
grant usage on sequence public.lucro_custos_id_seq to authenticated;

create table if not exists public.lucro_gastos (
  id bigserial primary key,
  data date not null,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  grupo text not null default 'geral' check (grupo in ('lancha', 'site', 'geral')),
  valor numeric(12,2) not null check (valor >= 0 and valor <= 1000000),
  origem text not null default 'manual' check (origem in ('manual', 'diretor')),
  criado_em timestamptz not null default now(),
  unique (data, nome)
);
create index if not exists lucro_gastos_data on public.lucro_gastos (data);
alter table public.lucro_gastos enable row level security;
drop policy if exists lucro_gastos_admin on public.lucro_gastos;
create policy lucro_gastos_admin on public.lucro_gastos for all to authenticated using (public.e_admin()) with check (public.e_admin());
revoke all on public.lucro_gastos from public, anon;
grant select, insert, update, delete on public.lucro_gastos to authenticated;
grant usage on sequence public.lucro_gastos_id_seq to authenticated;

-- custos que o Rodrigo passou em 22/11 (só entra se a lista estiver vazia; depois ele edita no painel)
insert into public.lucro_custos (nome, grupo, tipo, valor)
select * from (values
  ('Marina (BR Marina)', 'lancha', 'mensal', 4000.00),
  ('Salário do marinheiro', 'lancha', 'mensal', 3000.00),
  ('Manutenção da lancha', 'lancha', 'mensal', 2000.00),
  ('Diária do marinheiro (com ajudante)', 'lancha', 'passeio_marinheiro', 200.00),
  ('Diária do ajudante', 'lancha', 'passeio_ajudante', 200.00),
  ('Diária do marinheiro (sem ajudante)', 'lancha', 'passeio_sozinho', 250.00),
  ('Combustível (diária completa)', 'lancha', 'combustivel_diaria', 350.00),
  ('Combustível (passeio de 4 h sozinho no dia)', 'lancha', 'combustivel_4h', 300.00),
  ('Combustível (cada passeio de 4 h, 2 no mesmo dia)', 'lancha', 'combustivel_4h_dois', 200.00),
  ('Insumos (gelo, carvão, água)', 'lancha', 'por_passeio', 100.00),
  ('Claude (assinatura)', 'site', 'mensal', 1100.00),
  ('Gemini (2 assinaturas)', 'site', 'mensal', 192.00),
  ('VPS', 'site', 'mensal', 549.00),
  ('360dialog (WhatsApp oficial)', 'site', 'mensal', 365.31),
  ('Hospedagem do site (HostGator)', 'site', 'mensal', null),
  ('Supabase (banco: Pro US$ 25 + computação Small)', 'site', 'mensal', null),
  ('ElevenLabs Starter (voz do Lucas)', 'site', 'mensal', null),
  ('Apple Developer (US$ 99 por ano, dividir por 12)', 'site', 'mensal', null)
) v(nome, grupo, tipo, valor)
where not exists (select 1 from public.lucro_custos);

-- três passeios de outubro/novembro lançados antes do repasse automático: a parte do dono que foi de fato repassada
-- (relatório do contador de outubro: Anna 28/10 comissão 80, Maria Jose comissão 150, Isabella 31/10 comissão 360).
-- Sem isso, o relatório usaria a tabela de hoje do dono, que mudou depois.
update public.anotacoes set neto_dono = 1200 where bloqueio_id = 59 and neto_dono is null and valor = 1280;
update public.anotacoes set neto_dono = 2200 where bloqueio_id = 61 and neto_dono is null and valor = 2350;
update public.anotacoes set neto_dono = 1600 where bloqueio_id = 82 and neto_dono is null and valor = 1960;

-- passeios do período com o que fica com cada um (só o administrador)
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
        'valor', v, 'vendedor', vend,
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

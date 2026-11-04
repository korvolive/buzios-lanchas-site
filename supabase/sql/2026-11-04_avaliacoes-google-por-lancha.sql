-- Avaliações do Google por lancha (Rodrigo 2026-11-04).
-- O Grok (operador) ou o administrador copia a avaliação do Google e diz de qual lancha é.
-- O site mostra na página da lancha com o selo "Google". Elas NÃO entram nas estrelinhas da busca (regra do Google).
create table if not exists public.avaliacoes_google (
  id bigserial primary key,
  lancha text not null references public.lanchas(slug) on delete cascade,
  autor text not null check (length(btrim(autor)) between 1 and 80),
  nota int not null check (nota between 1 and 5),
  texto text check (texto is null or length(texto) <= 2000),
  data date,
  perfil text not null default 'buzios' check (perfil in ('buzios','miss-bardot')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (lancha, autor, data)
);
alter table public.avaliacoes_google enable row level security;
drop policy if exists "avaliacoes_google le" on public.avaliacoes_google;
create policy "avaliacoes_google le" on public.avaliacoes_google for select using (true);
grant select (id, lancha, autor, nota, texto, data, perfil, criado_em) on public.avaliacoes_google to anon, authenticated;

create or replace function public.pode_avaliacao_google() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.e_admin() or coalesce(public.papel_painel() = 'operador', false);
$$;

-- lançar ou corrigir (mesma lancha + autor + data atualiza)
create or replace function public.salvar_avaliacao_google(l text, autor text, nota int, texto text default null, data date default null, perfil text default 'buzios')
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare i bigint;
begin
  if not public.pode_avaliacao_google() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.lanchas where slug = l) then raise exception 'lancha' using errcode = 'P0001'; end if;
  insert into public.avaliacoes_google (lancha, autor, nota, texto, data, perfil)
    values (l, btrim(autor), nota, nullif(btrim(texto), ''), data, coalesce(perfil, 'buzios'))
  on conflict (lancha, autor, data) do update set nota = excluded.nota, texto = excluded.texto, perfil = excluded.perfil
  returning id into i;
  return i;
end $$;

create or replace function public.apagar_avaliacao_google(aid bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.pode_avaliacao_google() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  delete from public.avaliacoes_google where id = aid;
end $$;

-- passeios realizados dos últimos 120 dias, com o nome do cliente: ajuda a achar de qual lancha é cada avaliação do Google
-- (foi_ao_google = o cliente tocou em "Avaliar no Google" no app a partir desse passeio)
create or replace function public.passeios_para_google() returns table (cliente text, lancha text, data_passeio date, foi_ao_google boolean)
language sql stable security definer set search_path to 'public' as $$
  select coalesce(nullif(btrim(a.cliente), ''), c.nome, ''), b.lancha, b.data,
         exists (select 1 from public.google_convites g join public.pedidos p on p.id = g.pedido_id where p.bloqueio_id = b.id)
    from public.bloqueios b
    join public.anotacoes a on a.bloqueio_id = b.id
    join public.realizados r on r.bloqueio_id = b.id and r.aconteceu
    left join public.clientes c on c.user_id = a.cliente_conta
   where public.pode_avaliacao_google() and b.data >= current_date - 120 and b.data <= current_date
   order by b.data desc;
$$;

revoke all on function public.salvar_avaliacao_google(text, text, int, text, date, text) from public, anon;
revoke all on function public.apagar_avaliacao_google(bigint) from public, anon;
revoke all on function public.passeios_para_google() from public, anon;
grant execute on function public.salvar_avaliacao_google(text, text, int, text, date, text) to authenticated;
grant execute on function public.apagar_avaliacao_google(bigint) to authenticated;
grant execute on function public.passeios_para_google() to authenticated;
grant execute on function public.pode_avaliacao_google() to authenticated;

-- conferir
select count(*) from public.avaliacoes_google;

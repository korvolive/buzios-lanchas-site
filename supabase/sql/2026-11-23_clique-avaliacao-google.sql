-- publicar: auto
-- Rodrigo 2026-11-23: medir o funil da avaliação no Google. O link do pedido de avaliação passa por /avaliar-google/?r=<passeio>,
-- que grava o clique aqui e abre o Google. Assim dá para saber se o cliente nem abre o link ou se abre e não avalia.
-- Sem dado pessoal (só o id do passeio e a hora). Só o administrador lê. Idempotente.
create table if not exists public.cliques_google (
  id bigint generated always as identity primary key,
  bloqueio_id bigint references public.bloqueios(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists cliques_google_bloqueio on public.cliques_google (bloqueio_id);
alter table public.cliques_google enable row level security;
revoke all on public.cliques_google from anon, authenticated;
grant select on public.cliques_google to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cliques_google' and policyname='cliques_google: admin le') then
    create policy "cliques_google: admin le" on public.cliques_google for select to authenticated using (public.e_admin());
  end if;
end $$;

-- grava o clique: id de passeio inexistente vira null; o mesmo passeio conta no máximo 1 vez por minuto; teto de 300 cliques por hora
create or replace function public.clique_google(r bigint default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare b bigint;
begin
  select id into b from public.bloqueios where id = r;
  if b is not null and exists (select 1 from public.cliques_google where bloqueio_id = b and criado_em > now() - interval '1 minute') then return; end if;
  if (select count(*) from public.cliques_google where criado_em > now() - interval '1 hour') >= 300 then return; end if;
  insert into public.cliques_google (bloqueio_id) values (b);
end $$;
revoke all on function public.clique_google(bigint) from public;
grant execute on function public.clique_google(bigint) to anon, authenticated;

-- limpa o clique de teste feito na criação (23/11, sem passeio)
delete from public.cliques_google where bloqueio_id is null and criado_em < '2026-11-23 12:40:00+00';

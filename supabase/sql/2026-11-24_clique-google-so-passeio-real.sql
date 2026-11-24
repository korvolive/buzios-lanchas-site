-- publicar: auto
-- Revisão diária 2026-11-24: /avaliar-google/ (clique_google) é público. Antes, cliques sem passeio ou com passeio
-- inexistente gastavam o teto global de 300/h e deixavam de contar os cliques com passeio. Agora: com passeio, no máximo
-- 1 por minuto e 5 por dia por passeio; sem passeio (link antigo, sem ?r=), teto próprio de 30 por hora. Índice em criado_em para a conta ficar barata. Idempotente.
create index if not exists cliques_google_criado on public.cliques_google (criado_em);
create or replace function public.clique_google(r bigint default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare b bigint;
begin
  select id into b from public.bloqueios where id = r;
  if b is null then
    if (select count(*) from public.cliques_google where bloqueio_id is null and criado_em > now() - interval '1 hour') >= 30 then return; end if;
    insert into public.cliques_google (bloqueio_id) values (null); return;
  end if;
  if exists (select 1 from public.cliques_google where bloqueio_id = b and criado_em > now() - interval '1 minute') then return; end if;
  if (select count(*) from public.cliques_google where bloqueio_id = b and criado_em > now() - interval '1 day') >= 5 then return; end if;
  insert into public.cliques_google (bloqueio_id) values (b);
end $$;
revoke all on function public.clique_google(bigint) from public;
grant execute on function public.clique_google(bigint) to anon, authenticated;

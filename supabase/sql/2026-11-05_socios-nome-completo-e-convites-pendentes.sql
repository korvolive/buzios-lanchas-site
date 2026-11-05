-- Sócios (Rodrigo 2026-11-05): a lista "Seus sócios" mostra o nome completo (antes só o primeiro nome)
-- e o vendedor vê quantos convites enviados ainda não foram aceitos (o convite vale 30 dias).
create or replace function public.meus_socios()
 returns table(user_id uuid, nome text, pct numeric, desde timestamp with time zone)
 language sql stable security definer set search_path to 'public'
as $function$
  select v.user_id, btrim(coalesce(p.nome, c.nome, f.nome, '')), v.indicacao_pct, v.criado_em
  from vendedores v left join perfis p on p.user_id = v.user_id left join clientes c on c.user_id = v.user_id left join freelancers f on f.user_id = v.user_id
  where v.indicado_por = auth.uid() order by v.criado_em desc;
$function$;

create or replace function public.convites_socio_pendentes()
 returns integer
 language sql stable security definer set search_path to 'public'
as $function$
  select count(*)::int from convites_socio
  where de = auth.uid() and usado_por is null and criado_em > now() - interval '30 days';
$function$;
revoke all on function public.convites_socio_pendentes() from public, anon;
grant execute on function public.convites_socio_pendentes() to authenticated;

-- Dono publica as fotos da lancha sem esperar o administrador (Rodrigo 2026-11-05).
-- O app confere cada foto no aparelho: com a lancha aparecendo, o dono publica na hora (aprovar_foto);
-- sem lancha detectada (ex.: banheiro, cabine), a foto continua esperando a aprovação da Búzios.
create or replace function public.aprovar_foto(pid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.fotos_pendentes; atual jsonb; n int;
begin
  select * into r from public.fotos_pendentes where id=pid; if r.id is null then return; end if;
  if not (public.e_admin() or (public.pode_editar(r.lancha) and r.enviado_por = auth.uid())) then raise exception 'sem_permissao'; end if;
  select lista into atual from public.fotos where lancha=r.lancha;
  n := coalesce(jsonb_array_length(atual),0);
  if n>=15 then raise exception 'limite_15'; end if;
  if n<=1 then atual := coalesce(atual,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('f',r.f,'p','center 50%'));
  else atual := jsonb_insert(atual, array[(n-1)::text], jsonb_build_object('f',r.f,'p','center 50%'));
  end if;
  insert into public.fotos(lancha, lista, atualizado_em) values (r.lancha, atual, now())
    on conflict (lancha) do update set lista=excluded.lista, atualizado_em=now();
  delete from public.fotos_pendentes where id=pid;
end $$;

-- conferência (deve voltar dono_ok = true)
select prosrc like '%pode_editar(r.lancha)%' as dono_ok from pg_proc where proname = 'aprovar_foto';

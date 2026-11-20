-- publicar: auto
-- O servidor (vigia, conta de operador) marca/desmarca passeio em que o cliente reclamou: sem pedido de avaliação (Rodrigo 2026-11-20).
-- Idempotente.
create or replace function public.pausar_avaliacao(p_bid bigint, p_motivo text default null, p_pausar boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'sem permissao' using errcode = '42501'; end if;
  if not exists (select 1 from public.bloqueios where id = p_bid) then return jsonb_build_object('ok', false, 'motivo', 'passeio'); end if;
  if p_pausar then
    insert into public.avaliacao_pausada (bloqueio_id, motivo) values (p_bid, left(p_motivo, 300))
    on conflict (bloqueio_id) do update set motivo = excluded.motivo;
  else
    delete from public.avaliacao_pausada where bloqueio_id = p_bid;
  end if;
  return jsonb_build_object('ok', true, 'pausada', p_pausar);
end $f$;
revoke all on function public.pausar_avaliacao(bigint, text, boolean) from public, anon;
grant execute on function public.pausar_avaliacao(bigint, text, boolean) to authenticated;

create or replace function public.avaliacoes_pausadas()
returns table(bloqueio_id bigint, motivo text, criado_em timestamptz) language plpgsql security definer set search_path to 'public' as $f$
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'sem permissao' using errcode = '42501'; end if;
  return query select a.bloqueio_id, a.motivo, a.criado_em from public.avaliacao_pausada a where a.criado_em > now() - interval '30 days';
end $f$;
revoke all on function public.avaliacoes_pausadas() from public, anon;
grant execute on function public.avaliacoes_pausadas() to authenticated;

-- publicar: auto
-- 18/11/2026 (Rodrigo): leitura das pré-reservas apagadas pelo servidor (vencidas), para o aviso gentil ao cliente
-- (painel-worker/actions/aviso-pre-vencida-auto.mjs na VPS). Só leitura, só admin/operador. Idempotente.
create or replace function public.pre_reservas_vencidas(desde timestamptz, p_bid text default null)
returns table(bid text, em timestamptz, bloq jsonb, anot jsonb)
language sql stable security definer set search_path to 'public' as $$
  select b.registro, b.em, b.antes, a.antes
    from public.auditoria b
    join public.auditoria a on a.tabela = 'anotacoes' and a.operacao = 'DELETE' and a.quem is null and (a.antes->>'bloqueio_id') = b.registro
   where b.tabela = 'bloqueios' and b.operacao = 'DELETE' and b.quem is null
     and (public.e_admin() or coalesce(public.papel_painel() = 'operador', false))
     and (case when p_bid is not null then b.registro = p_bid else b.em >= desde end)
   order by b.id desc limit 200;
$$;
revoke all on function public.pre_reservas_vencidas(timestamptz, text) from public, anon;
grant execute on function public.pre_reservas_vencidas(timestamptz, text) to authenticated;

-- publicar: auto
-- 2026-11-26 (Rodrigo 25/11 23h30): o convite do relançamento com prazo curto diz o tempo ("por 40 minutos/1 hora/2 horas").
-- O pre-auto (sessão operador do painel) não lê public.prazo_curto (RLS sem política). Esta função só lê a linha dos bloqueios pedidos.
-- Desfazer: drop function public.prazo_curto_de(bigint[]);
create or replace function public.prazo_curto_de(p_bids bigint[])
returns table(bloqueio_id bigint, ate timestamptz)
language sql stable security definer set search_path to 'public'
as $$
  select p.bloqueio_id, p.ate from public.prazo_curto p
   where p.bloqueio_id = any(p_bids) and cardinality(p_bids) <= 50
     and (public.e_admin() or coalesce(public.papel_painel() = 'operador', false));
$$;
revoke all on function public.prazo_curto_de(bigint[]) from public, anon;
grant execute on function public.prazo_curto_de(bigint[]) to authenticated;

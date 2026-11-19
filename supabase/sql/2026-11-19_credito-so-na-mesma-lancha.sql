-- publicar: auto
-- Crédito de desistência só na mesma lancha (Rodrigo 2026-11-19): o sinal já foi repassado ao dono daquela lancha,
-- então o crédito não pode ser usado em outra. Volta a checagem que existia até 2026-11-15. Idempotente.
create or replace function public.usar_credito(cid bigint, bid bigint default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.creditos%rowtype; l text;
begin
  if not public.e_admin() then raise exception 'Só o administrador usa o crédito'; end if;
  select * into c from public.creditos where id = cid for update;
  if c.id is null then raise exception 'Crédito não encontrado'; end if;
  if c.usado_em is not null or c.removido_em is not null then raise exception 'Este crédito já foi usado ou removido'; end if;
  if c.valido_ate < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Este crédito já venceu'; end if;
  if bid is not null and exists (select 1 from public.creditos where usado_bloqueio = bid) then raise exception 'Este passeio já usou um crédito'; end if;
  if bid is not null then
    select lancha into l from public.bloqueios where id = bid;
    if l is null then raise exception 'Passeio não encontrado'; end if;
    if l <> c.lancha then raise exception 'O crédito vale só na lancha em que foi dado'; end if;
  end if;
  update public.creditos set usado_em = now(), usado_bloqueio = bid where id = cid;
end $$;

revoke all on function public.usar_credito(bigint, bigint) from public, anon;
grant execute on function public.usar_credito(bigint, bigint) to authenticated;
notify pgrst, 'reload schema';

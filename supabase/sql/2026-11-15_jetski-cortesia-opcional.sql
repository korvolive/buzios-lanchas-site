-- Cortesia de jetski opcional (Rodrigo 2026-11-15): o cliente marca se quer os minutos de cortesia.
-- Só cortesia: jetski_min nulo, valor e neto nulos. Cortesia + tempo pago: o uso dura min + cortesia.
-- O cliente manda qualquer número > 0 em jetski_cortesia; o banco troca pelo cortesia_min do jetski (só na lancha da cortesia).
alter table public.pedidos add column if not exists jetski_cortesia int;
grant insert (jetski_cortesia) on public.pedidos to authenticated;

create or replace function public.tg_pedido_jetski()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare j public.jetskis; w record; a int; n numeric; c int; tot int; mudou boolean;
begin
  if tg_op = 'UPDATE' then
    if (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_valor, new.jetski_neto, new.jetski_cortesia) is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_valor, old.jetski_neto, old.jetski_cortesia)
       and auth.uid() is not null and not public.e_admin() then
      new.jetski := old.jetski; new.jetski_min := old.jetski_min; new.jetski_ini := old.jetski_ini; new.jetski_valor := old.jetski_valor; new.jetski_neto := old.jetski_neto; new.jetski_cortesia := old.jetski_cortesia;
    end if;
    if new.jetski_repasse is distinct from old.jetski_repasse or new.jetski_repasse_em is distinct from old.jetski_repasse_em then
      if auth.uid() is not null and not public.e_admin() then new.jetski_repasse := old.jetski_repasse; new.jetski_repasse_em := old.jetski_repasse_em; end if;
    end if;
    mudou := (new.jetski, new.jetski_min, new.jetski_ini, new.jetski_cortesia, new.lancha, new.data, new.horario, new.hora_ini, new.hora_fim)
             is distinct from (old.jetski, old.jetski_min, old.jetski_ini, old.jetski_cortesia, old.lancha, old.data, old.horario, old.hora_ini, old.hora_fim);
    if not mudou then return new; end if;
  else
    new.jetski_repasse := null; new.jetski_repasse_em := null;
  end if;
  if new.jetski is null then
    new.jetski_min := null; new.jetski_ini := null; new.jetski_valor := null; new.jetski_neto := null; new.jetski_cortesia := null; return new;
  end if;
  select * into j from public.jetskis where id = new.jetski;
  if j.id is null or not j.ativo or (j.oculto and not public.e_admin()) then raise exception 'JETSKI_INDISPONIVEL'; end if;
  if exists (select 1 from public.lanchas l where l.slug = new.lancha and l.dados->>'tipo' = 'escuna') then raise exception 'JETSKI_SO_LANCHA'; end if;
  c := case when coalesce(new.jetski_cortesia,0) > 0 and j.cortesia_lancha = new.lancha and coalesce(j.cortesia_min,0) > 0 then j.cortesia_min else 0 end;
  new.jetski_cortesia := nullif(c, 0);
  if new.jetski_ini is null or (new.jetski_min is null and c = 0) then raise exception 'JETSKI_HORARIO'; end if;
  if new.jetski_min is null then n := null;
  else
    n := public.jetski_neto(j, new.jetski_min);
    if n is null or n <= 0 then raise exception 'JETSKI_TEMPO'; end if;
  end if;
  tot := coalesce(new.jetski_min, 0) + c;
  w := public.jetski_janela(new.horario, new.hora_ini, new.hora_fim);
  a := extract(epoch from new.jetski_ini)::int / 60;
  if w.ini is null or w.fim is null or a % 30 <> 0 or a < w.ini + 60 or a + tot > w.fim - 60 then raise exception 'JETSKI_JANELA'; end if;
  new.jetski_neto := n; new.jetski_valor := case when n is null then null else public.jetski_valor(n) end;
  if tg_op = 'UPDATE' and (new.jetski, new.jetski_min) is not distinct from (old.jetski, old.jetski_min) and old.jetski_valor is not null
     and (exists (select 1 from public.pagamentos_asaas x where x.pedido = new.id and x.pago_em is not null)
          or exists (select 1 from public.pagamentos_pp x where x.pedido = new.id and x.pago_em is not null)) then
    new.jetski_neto := old.jetski_neto; new.jetski_valor := old.jetski_valor;
  end if;
  return new;
end $function$;

create or replace function public.tg_pedido_jetski_uso()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare vivo boolean := new.status in ('pendente','aprovado'); u bigint; a time; f time; tot int;
begin
  select id into u from public.jetski_usos where pedido_id = new.id and removido_em is null limit 1;
  if new.jetski is null or not vivo then
    if u is not null then update public.jetski_usos set removido_em = now() where id = u; end if;
    return null;
  end if;
  tot := coalesce(new.jetski_min, 0) + coalesce(new.jetski_cortesia, 0);
  a := new.jetski_ini; f := new.jetski_ini + make_interval(mins => tot);
  if u is null then
    insert into public.jetski_usos (jetski, data, ini, fim, tipo, lancha, pedido_id, bloqueio_id, minutos, valor, neto, criado_por)
      values (new.jetski, new.data, a, f, 'uso', new.lancha, new.id, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto, new.cliente);
  else
    update public.jetski_usos set jetski = new.jetski, data = new.data, ini = a, fim = f, lancha = new.lancha, bloqueio_id = new.bloqueio_id,
      minutos = tot, valor = new.jetski_valor, neto = new.jetski_neto
    where id = u and (jetski, data, ini, fim, lancha, bloqueio_id, minutos, valor, neto)
      is distinct from (new.jetski, new.data, a, f, new.lancha, new.bloqueio_id, tot, new.jetski_valor, new.jetski_neto);
  end if;
  return null;
end $function$;

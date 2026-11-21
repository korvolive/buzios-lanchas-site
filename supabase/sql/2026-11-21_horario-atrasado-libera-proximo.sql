-- publicar: auto
-- Passeio que atrasou ou foi combinado com até 1 hora a mais (Rodrigo 2026-11-21, Chefe 10h30 às 14h30):
-- a tarde da mesma lancha continua à venda, deslocada para depois dela, sempre com 4 horas.
--   manhã termina entre 14h e 15h  -> tarde livre do fim da manhã até 4h depois (ex.: 14h30 às 18h30, no máximo 19h)
-- Só para frente: tarde que começa antes das 14h continua ocupando a manhã (manhã às 9h no site não foi pedida).
-- Acima de 1 hora de sobra, o outro período continua ocupado como antes (periodos_extra).
-- Sem dado de cliente; idempotente.

create or replace function public.periodos_ajustados()
returns table(lancha text, data date, horario text, hora_ini text, hora_fim text)
language sql stable security definer set search_path = public as $$
  select b.lancha::text, b.data, x.h, to_char(x.i, 'HH24:MI'), to_char(x.f, 'HH24:MI')
  from public.bloqueios b
  join public.anotacoes a on a.bloqueio_id = b.id
  cross join lateral (select substr(a.hora_ini, 1, 5)::time ti, substr(a.hora_fim, 1, 5)::time tf) t
  cross join lateral (
    select 'tarde'::text h, t.tf i, t.tf + interval '4 hours' f
     where b.horario = 'manha' and t.tf > time '14:00' and t.tf <= time '15:00'
  ) x
  where b.data >= (now() at time zone 'America/Sao_Paulo')::date
    and b.revenda is null
    and b.horario = 'manha'
    and a.hora_ini ~ '^\d{1,2}:\d{2}' and a.hora_fim ~ '^\d{1,2}:\d{2}'
    and not exists (select 1 from public.bloqueios o where o.lancha = b.lancha and o.data = b.data and o.horario in (x.h, 'dia'))
$$;
revoke all on function public.periodos_ajustados() from public;
grant execute on function public.periodos_ajustados() to anon, authenticated;

-- o período que só foi empurrado não conta mais como ocupado no site
create or replace function public.periodos_extra()
returns table(lancha text, data date, horario text)
language sql stable security definer set search_path = public as $$
  select b.lancha::text, b.data, p.h
  from public.bloqueios b
  join public.anotacoes a on a.bloqueio_id = b.id
  cross join (values ('manha', '10:00'::time, '14:00'::time), ('tarde', '14:00'::time, '18:00'::time)) p(h, i, f)
  where b.data >= (now() at time zone 'America/Sao_Paulo')::date
    and b.revenda is null
    and b.horario in ('manha', 'tarde')
    and a.hora_ini ~ '^\d{1,2}:\d{2}' and a.hora_fim ~ '^\d{1,2}:\d{2}'
    and substr(a.hora_ini, 1, 5)::time < p.f
    and substr(a.hora_fim, 1, 5)::time > p.i
    and p.h <> b.horario
    and not exists (select 1 from public.periodos_ajustados() j where j.lancha = b.lancha::text and j.data = b.data and j.horario = p.h)
$$;
revoke all on function public.periodos_extra() from public;
grant execute on function public.periodos_extra() to anon, authenticated;

-- pedido feito no site para o período empurrado já sai com o horário certo (o cliente não escolhe horário; o servidor põe)
create or replace function public.pedido_oferta()
returns trigger language plpgsql security definer set search_path = public as $function$
declare o public.ofertas%rowtype; cod text;
begin
  if public.e_admin() or coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' then
    new.oferta := old.oferta; new.hora_ini := old.hora_ini; new.hora_fim := old.hora_fim;
    return new;
  end if;
  new.hora_ini := null; new.hora_fim := null;
  if new.oferta is not null then
    select * into o from public.ofertas where id = new.oferta and lancha = new.lancha and data = new.data and horario = new.horario;
    if not found then new.oferta := null; end if;
  end if;
  if new.oferta is null then
    select j.hora_ini, j.hora_fim into new.hora_ini, new.hora_fim
      from public.periodos_ajustados() j where j.lancha = new.lancha::text and j.data = new.data and j.horario = new.horario limit 1;
    return new;
  end if;
  new.hora_ini := o.hora_ini; new.hora_fim := o.hora_fim;
  if o.valor > 0 then new.preco_base := o.valor; new.preco_cliente := null; end if;
  if o.vendedor is not null and o.comissao is not null
     and not exists (select 1 from public.cliente_vendedor cv where cv.cliente = new.cliente and cv.ate > now() and cv.vendedor <> o.vendedor) then
    select codigo into cod from public.vendedores where user_id = o.vendedor and ativo;
    if cod is not null then
      new.vendedor_cod := cod;
      if new.preco_base > 0 then new.preco_cliente := new.preco_base + o.comissao; end if;
    end if;
  end if;
  return new;
end $function$;

-- conferência: a tarde da Chefe de 21/11 deve aparecer das 14:30 às 18:30 (se ainda estiver livre)
select * from public.periodos_ajustados();

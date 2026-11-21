-- publicar: auto
-- Embarque sempre gravado na reserva (Rodrigo 2026-11-21): pedido/consulta/passeio NOVO que chega sem local
-- recebe o local da lancha para aquele período quando ela só tem um (o mesmo que os avisos já mandam ao cliente).
-- Vale para toda lancha; a regra por período da Miss Bardot (manhã Porto Veleiro, tarde Golfinho) continua igual.
-- Lancha com mais de um local (ex.: dia inteiro Porto Veleiro ou BR Marina) fica vazia para quem fecha escolher.
-- Também grava o local no passeio 241 (Spartana 30/12 tarde), criado hoje sem local. Sem dado de cliente; idempotente.

create or replace function public._embarque_padrao(p_lancha text, p_horario text)
returns text
language sql stable security definer set search_path = public as $$
  select case when jsonb_typeof(x.lst) = 'array' and jsonb_array_length(x.lst) = 1 then x.lst->>0 end
  from public.lanchas l
  cross join lateral (select case when p_horario = 'dia' then l.dados->'embarque'->'7'
                                  when jsonb_typeof(l.dados->'embarque'->p_horario) = 'array'
                                       and jsonb_array_length(l.dados->'embarque'->p_horario) > 0 then l.dados->'embarque'->p_horario
                                  else l.dados->'embarque'->'4' end as lst) x
  where l.slug = p_lancha and p_horario in ('manha', 'tarde', 'dia')
$$;
revoke all on function public._embarque_padrao(text, text) from public, anon, authenticated;

create or replace function public.tg_embarque_periodo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare lch text; hr text;
begin
  if tg_table_name = 'anotacoes' then
    select b.lancha, b.horario into lch, hr from public.bloqueios b where b.id = new.bloqueio_id;
  else
    if tg_table_name = 'pedidos' then
      if new.bloqueio_id is not null then return new; end if;
    end if;
    lch := new.lancha; hr := new.horario;
  end if;
  if lch is null then return new; end if;
  if hr in ('manha', 'tarde') then
    new.embarque := coalesce(public._embarque_periodo(lch, hr, new.embarque), new.embarque);
  end if;
  if nullif(btrim(coalesce(new.embarque, '')), '') is null then
    new.embarque := public._embarque_padrao(lch, hr);
  end if;
  return new;
end $$;
revoke all on function public.tg_embarque_periodo() from public, anon, authenticated;

update public.anotacoes set embarque = public._embarque_padrao('spartana', 'tarde')
 where bloqueio_id = 241 and nullif(btrim(coalesce(embarque, '')), '') is null
   and exists (select 1 from public.bloqueios b where b.id = 241 and b.lancha = 'spartana' and b.horario = 'tarde');

-- Conferir
select (select embarque from public.anotacoes where bloqueio_id = 241) as spartana_241,
       public._embarque_padrao('midas', 'tarde') midas_tarde, public._embarque_padrao('miss-bardot', 'dia') mb_dia;

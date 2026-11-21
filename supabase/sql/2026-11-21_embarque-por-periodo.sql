-- publicar: auto
-- Embarque por período (Rodrigo 2026-11-21): na Miss Bardot, passeio das 10h às 14h (manhã) embarca no Porto Veleiro,
-- que fecha às 17h; passeio das 14h em diante (tarde) continua no Píer do Golfinho. Dia inteiro (7h) fica como estava.
-- Só para frente: reservas já feitas não mudam (o gatilho age só em linha NOVA).
-- Como funciona: lanchas.dados.embarque ganha as chaves opcionais "manha" e "tarde" (além de "4" e "7").
-- Quando a lancha tem a chave do período com um único local, todo pedido/consulta/passeio novo daquele período
-- recebe esse local se veio vazio ou com um dos dois píeres da Praia dos Ossos (o padrão antigo).
-- BR Marina, "Outro" (casa do cliente etc.) e mudanças feitas depois no painel continuam valendo.
-- Sem dado de cliente; idempotente.

update public.lanchas
   set dados = jsonb_set(jsonb_set(dados, '{embarque,manha}', '["Porto Veleiro (Praia dos Ossos)"]'),
                         '{embarque,tarde}', '["Píer do Golfinho (Praia dos Ossos)"]'),
       atualizado_em = now()
 where slug = 'miss-bardot'
   and dados ? 'embarque'
   and (dados->'embarque'->'manha' is distinct from '["Porto Veleiro (Praia dos Ossos)"]'::jsonb
        or dados->'embarque'->'tarde' is distinct from '["Píer do Golfinho (Praia dos Ossos)"]'::jsonb);

create or replace function public._embarque_periodo(p_lancha text, p_horario text, p_atual text)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_horario not in ('manha', 'tarde') then p_atual
    when jsonb_typeof(l.dados->'embarque'->p_horario) <> 'array' or jsonb_array_length(l.dados->'embarque'->p_horario) <> 1 then p_atual
    when nullif(btrim(coalesce(p_atual, '')), '') is null
      or p_atual in ('Píer do Golfinho (Praia dos Ossos)', 'Porto Veleiro (Praia dos Ossos)')
      then l.dados->'embarque'->p_horario->>0
    else p_atual end
  from (select null) z left join public.lanchas l on l.slug = p_lancha
$$;
revoke all on function public._embarque_periodo(text, text, text) from public, anon, authenticated;

create or replace function public.tg_embarque_periodo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare lch text; hr text;
begin
  if tg_table_name = 'anotacoes' then
    select b.lancha, b.horario into lch, hr from public.bloqueios b where b.id = new.bloqueio_id;
  else
    if tg_table_name = 'pedidos' then
      if new.bloqueio_id is not null then return new; end if; -- pedido ligado a passeio que já existe: mantém o local dele
    end if;
    lch := new.lancha; hr := new.horario;
  end if;
  if lch is not null and hr in ('manha', 'tarde') then
    new.embarque := coalesce(public._embarque_periodo(lch, hr, new.embarque), new.embarque);
  end if;
  return new;
end $$;
revoke all on function public.tg_embarque_periodo() from public, anon, authenticated;

drop trigger if exists a0_embarque_periodo on public.anotacoes;
create trigger a0_embarque_periodo before insert on public.anotacoes
  for each row execute function public.tg_embarque_periodo();
drop trigger if exists a0_embarque_periodo on public.consultas;
create trigger a0_embarque_periodo before insert on public.consultas
  for each row execute function public.tg_embarque_periodo();
drop trigger if exists a0_embarque_periodo on public.pedidos;
create trigger a0_embarque_periodo before insert on public.pedidos
  for each row execute function public.tg_embarque_periodo();

-- Conferir: manha = Porto Veleiro, tarde = Píer do Golfinho, dia = sem mudança
select public._embarque_periodo('miss-bardot', 'manha', null) manha,
       public._embarque_periodo('miss-bardot', 'tarde', 'Porto Veleiro (Praia dos Ossos)') tarde,
       public._embarque_periodo('miss-bardot', 'dia', 'BR Marina') dia;

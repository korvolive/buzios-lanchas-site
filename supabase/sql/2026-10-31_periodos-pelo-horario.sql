-- Site: passeio com Entrada/Saída fora do padrão ocupa os dois períodos que toca (Rodrigo 2026-10-31).
-- Ex.: Les Zuzu "tarde" das 13h às 17h também ocupa a manhã (10h-14h).
-- Devolve só os períodos A MAIS (lancha, data, período), sem nenhum dado do cliente; o site soma aos bloqueios normais.
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
$$;
revoke all on function public.periodos_extra() from public;
grant execute on function public.periodos_extra() to anon, authenticated;

-- conferência: deve listar a manhã da Les Zuzu de 31/10 e a manhã da Midas de 28/12
select * from public.periodos_extra();

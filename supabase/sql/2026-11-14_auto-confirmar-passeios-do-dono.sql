-- Passeios do dono (de fora) confirmam sozinhos que aconteceram quando o horário termina (Rodrigo 2026-11-14).
-- Mesma regra de fim do aviso "fim" (notificar): hora_fim combinada, senão manhã 14h, tarde 18h, diária 17h; noite só no dia seguinte.
-- Roda a cada minuto, antes do aviso de 15 em 15 min, então o dono não recebe mais o "Passeio terminou: confirme".
create or replace function public.auto_confirmar_fora()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare agora timestamp := (now() at time zone 'America/Sao_Paulo'); hoje date := agora::date; hora numeric := extract(hour from agora) + extract(minute from agora)/60.0; n integer;
begin
  insert into public.realizados (bloqueio_id, aconteceu, por, quitado)
  select b.id, true, null, null
    from public.bloqueios b
    join public.anotacoes a on a.bloqueio_id = b.id
   where coalesce(a.origem, 'fora') <> 'buzios'
     and b.data >= greatest(date '2026-10-21', hoje - 3)
     and b.data <= hoje
     and not exists (select 1 from public.realizados r where r.bloqueio_id = b.id)
     and (b.data < hoje or hora >= coalesce(extract(hour from a.hora_fim::time) + extract(minute from a.hora_fim::time)/60.0,
                                            case b.horario when 'manha' then 14 when 'tarde' then 18 when 'dia' then 17 else 99 end))
  on conflict (bloqueio_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.auto_confirmar_fora() from public, anon, authenticated;
select cron.schedule('auto-confirmar-fora', '* * * * *', 'select public.auto_confirmar_fora()');

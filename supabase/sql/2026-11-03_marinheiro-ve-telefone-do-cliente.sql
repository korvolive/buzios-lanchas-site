-- Búzios Lanchas (Rodrigo 2026-11-03): o marinheiro precisa falar com o cliente (avisar que está esperando no embarque).
-- Fixo da lancha: nome e WhatsApp de todos os passeios dela. Freelancer: nome e WhatsApp só dos passeios em que foi escalado.
-- Valores e sinal continuam fora daqui.
create or replace function public.passeios_marinheiro_v2()
returns table(id bigint, lancha text, data date, horario text, cliente text, telefone text, pessoas integer, obs text,
              marinheiro text, eu boolean, embarque text, hora_ini text, hora_fim text)
language sql stable security definer set search_path to 'public' as $$
  select b.id, b.lancha, b.data, b.horario,
    case when coalesce(m.fixo,false) or a.marinheiro = auth.uid() then a.cliente end,
    case when coalesce(m.fixo,false) or a.marinheiro = auth.uid() then a.telefone end,
    a.pessoas::int, a.obs,
    coalesce(quem.nome, fr.nome), coalesce(a.marinheiro = auth.uid(), false),
    a.embarque, a.hora_ini::text, a.hora_fim::text
  from public.bloqueios b
  left join public.anotacoes a on a.bloqueio_id = b.id
  left join public.marinheiros m on m.lancha = b.lancha and m.user_id = auth.uid()
  left join public.marinheiros quem on quem.lancha = b.lancha and quem.user_id = a.marinheiro
  left join public.freelancers fr on fr.user_id = a.marinheiro
  where b.data >= current_date and (coalesce(m.fixo,false) or a.marinheiro = auth.uid())
  order by b.data, b.horario
  limit 300;
$$;
revoke all on function public.passeios_marinheiro_v2() from public, anon;
grant execute on function public.passeios_marinheiro_v2() to authenticated;
select 'ok' as resultado;

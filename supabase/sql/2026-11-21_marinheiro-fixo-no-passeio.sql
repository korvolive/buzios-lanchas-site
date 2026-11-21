-- publicar: auto
-- Passeio sem marinheiro marcado usa o marinheiro fixo da lancha (Rodrigo 2026-11-21).
-- Assim o pedido de avaliação volta a pedir a avaliação do marinheiro (com cupom ao avaliar)
-- nas lanchas parceiras, sem depender de alguém marcar o marinheiro em cada passeio.
-- Só preenche na criação do passeio (INSERT): se o dono tirar o marinheiro depois, ou o marinheiro
-- recusar, fica como ele deixou. Só quando a lancha tem exatamente um fixo e ele está livre no horário.

create or replace function public.tg_marinheiro_fixo_padrao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare bl record; fixo uuid; n int;
begin
  if new.marinheiro is not null or new.bloqueio_id is null then return new; end if;
  select * into bl from public.bloqueios where id = new.bloqueio_id;
  if bl.id is null then return new; end if;
  select count(*), min(m.user_id::text)::uuid into n, fixo
    from public.marinheiros m where m.lancha = bl.lancha and m.fixo and m.user_id is not null;
  if n <> 1 then return new; end if;
  -- já está em outra lancha nesse horário: não marca (sem erro)
  if exists (select 1 from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
              where a.marinheiro = fixo and b.id <> bl.id and b.data = bl.data
                and public.choca_horario(b.horario, bl.horario)) then
    return new;
  end if;
  new.marinheiro := fixo;
  return new;
end $$;

revoke all on function public.tg_marinheiro_fixo_padrao() from public, anon, authenticated;

drop trigger if exists a1_marinheiro_fixo_padrao on public.anotacoes;
create trigger a1_marinheiro_fixo_padrao before insert on public.anotacoes
  for each row execute function public.tg_marinheiro_fixo_padrao();

-- passeios a partir de amanhã já criados sem marinheiro: marca o fixo (mesma regra)
do $$
declare r record; fixo uuid;
begin
  for r in
    select a.bloqueio_id, b.lancha, b.data, b.horario
      from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
     where a.marinheiro is null and a.marinheiro_recusou is null
       and b.data > (now() at time zone 'America/Sao_Paulo')::date -- amanhã em diante: passeio de hoje pode já ter recebido o pedido
     order by b.data
  loop
    fixo := null;
    select min(m.user_id::text)::uuid into fixo from public.marinheiros m
     where m.lancha = r.lancha and m.fixo and m.user_id is not null
    having count(*) = 1;
    continue when fixo is null;
    continue when exists (select 1 from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
                           where a.marinheiro = fixo and b.id <> r.bloqueio_id and b.data = r.data
                             and public.choca_horario(b.horario, r.horario));
    update public.anotacoes set marinheiro = fixo where bloqueio_id = r.bloqueio_id and marinheiro is null;
  end loop;
end $$;

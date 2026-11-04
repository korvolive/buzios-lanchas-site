-- Nenhuma lancha fica sem valor (Rodrigo 2026-11-04).
-- Média vazia = baixa; alta vazia = média; colunas antigas de pico e réveillon = alta.
-- O Réveillon e Carnaval de verdade sai da alta + % do dono (0% = preço da alta).
create or replace function public.tg_precos_cheios() returns trigger
language plpgsql as $$
begin
  new.media      := coalesce(nullif(new.media, 0), new.baixa);
  new.alta       := coalesce(nullif(new.alta, 0), new.media);
  new.pico       := new.alta;
  new.reveillon  := new.alta;
  new.media7     := coalesce(nullif(new.media7, 0), new.baixa7);
  new.alta7      := coalesce(nullif(new.alta7, 0), new.media7);
  new.pico7      := new.alta7;
  new.reveillon7 := new.alta7;
  return new;
end $$;

drop trigger if exists precos_cheios on public.precos;
create trigger precos_cheios before insert or update on public.precos
  for each row execute function public.tg_precos_cheios();

-- conferir: nenhuma linha com valor vazio
select lancha, baixa, media, alta, baixa7, media7, alta7 from public.precos
 where media is null or alta is null or media7 is null or alta7 is null;

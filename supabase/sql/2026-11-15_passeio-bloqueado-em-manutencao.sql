-- Passeio em dia de manutenção (Rodrigo 2026-11-15): para marcar passeio num dia em que a lancha está em manutenção,
-- o dono (ou o administrador) tem que remover a manutenção antes. O app já pergunta "remover a manutenção?" e, se ele
-- confirmar, apaga todas as manutenções que cobrem aquele dia e segue com o passeio (mntFree em login/index.html).
-- Este gatilho é a trava do servidor: nenhum passeio novo (nem passeio movido para outro dia/lancha) entra num dia de
-- manutenção, venha de onde vier. Passeios que já existiam quando a manutenção foi marcada continuam como estão.
-- Linhas de revenda não são passeio da lancha e ficam de fora (o site também as ignora).
-- security definer: a trava vale mesmo para quem não enxerga a tabela de manutenções; função de gatilho, não dá para chamar direto.
create or replace function public._passeio_sem_manutencao()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if new.revenda is not null then return new; end if;
  if tg_op = 'UPDATE' and new.lancha is not distinct from old.lancha and new.data is not distinct from old.data then return new; end if;
  if exists (select 1 from public.manutencoes m where m.lancha = new.lancha and m.de <= new.data and new.data <= m.ate) then
    raise exception 'A lancha está em manutenção nesse dia. Remova a manutenção antes de marcar o passeio.'
      using errcode = 'P0001';
  end if;
  return new;
end $f$;

create or replace trigger passeio_sem_manutencao before insert or update of lancha, data on public.bloqueios
  for each row execute function public._passeio_sem_manutencao();
revoke all on function public._passeio_sem_manutencao() from public, anon, authenticated;

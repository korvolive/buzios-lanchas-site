-- publicar: auto
-- Búzios Lanchas: editar as datas de uma manutenção já marcada, sem apagar e criar de novo (Rodrigo, 2026-11-22).
-- Mesmas regras de quem pode criar/apagar (administrador ou dono da lancha). Idempotente.

grant update (de, ate) on public.manutencoes to authenticated;

drop policy if exists manut_editar on public.manutencoes;
create policy manut_editar on public.manutencoes for update to authenticated
  using (public.e_admin() or exists (select 1 from public.donos d where d.user_id = auth.uid() and d.lancha = manutencoes.lancha))
  with check ((public.e_admin() or exists (select 1 from public.donos d where d.user_id = auth.uid() and d.lancha = manutencoes.lancha))
              and ate >= current_date);

-- a trava de períodos cruzados passa a valer também na edição (a função já ignora o próprio registro)
drop trigger if exists manut_sem_sobrepor on public.manutencoes;
create trigger manut_sem_sobrepor before insert or update of de, ate on public.manutencoes
  for each row execute function public.manut_sem_sobrepor();

-- Búzios Lanchas: "Transferir Saldo" do administrador para a conta Asaas de uma pessoa (2026-11-13)
create table if not exists public.transferencias_saldo (id bigserial primary key, req text unique, user_id uuid not null, valor numeric(12,2) not null check (valor > 0), motivo text not null, comprovante text, status text not null default 'enviando', erro text, criado_por uuid, criado_em timestamptz not null default now());
create index if not exists transferencias_saldo_user on public.transferencias_saldo (user_id, criado_em);
alter table public.transferencias_saldo enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='transferencias_saldo' and policyname='transferencias_saldo: admin le') then create policy "transferencias_saldo: admin le" on public.transferencias_saldo for select using (public.e_admin()); end if;
  if not exists (select 1 from pg_policies where tablename='transferencias_saldo' and policyname='transferencias_saldo: quem recebe le') then create policy "transferencias_saldo: quem recebe le" on public.transferencias_saldo for select using (user_id = auth.uid()); end if;
  if not exists (select 1 from pg_trigger where tgname='zz_auditar' and tgrelid='public.transferencias_saldo'::regclass) then create trigger zz_auditar after insert or update on public.transferencias_saldo for each row execute function public._auditar(); end if;
end $$;
revoke insert, update on public.transferencias_saldo from anon, authenticated;

-- publicar: auto
-- Sacar do card de saldo (Rodrigo 2026-11-20): o administrador tira dinheiro da conta Asaas da Búzios para uma chave Pix
-- no CNPJ da própria Búzios (a validação de saques do Asaas recusa qualquer outro CPF/CNPJ). Só até a parte da Búzios.
-- A chave usada fica aqui (só o administrador lê) e vem preenchida no próximo saque.
create table if not exists public.saques_buzios (id bigserial primary key, req text unique, valor numeric(12,2) not null check (valor > 0), chave text not null, asaas_id text, status text not null default 'enviando', erro text, criado_por uuid, criado_em timestamptz not null default now());
alter table public.saques_buzios enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saques_buzios' and policyname='saques_buzios: admin le') then create policy "saques_buzios: admin le" on public.saques_buzios for select using (public.e_admin()); end if;
  if not exists (select 1 from pg_trigger where tgname='zz_auditar' and tgrelid='public.saques_buzios'::regclass) then create trigger zz_auditar after insert or update on public.saques_buzios for each row execute function public._auditar(); end if;
end $$;
revoke all on public.saques_buzios from anon, authenticated;
grant select on public.saques_buzios to authenticated;

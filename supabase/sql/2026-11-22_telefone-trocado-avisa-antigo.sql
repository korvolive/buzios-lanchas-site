-- publicar: auto
-- Aviso de segurança (saque e troca de chave Pix) também para o telefone que estava na conta antes de uma troca
-- recente (Rodrigo 2026-11-22, opção 1): quem rouba o login pode trocar o telefone antes da chave Pix.
-- Guarda o número anterior quando perfis.telefone ou clientes.whatsapp muda. A função aviso-seguranca lê (service_role).
-- Idempotente.

create table if not exists public.telefones_trocados (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  origem text not null check (origem in ('perfis', 'clientes')),
  antes text not null,
  depois text,
  em timestamptz not null default now()
);
create index if not exists telefones_trocados_user_em on public.telefones_trocados (user_id, em);
alter table public.telefones_trocados enable row level security;
revoke all on public.telefones_trocados from anon, authenticated;

create or replace function public.tg_telefone_trocado()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare a text; d text;
begin
  if tg_table_name = 'perfis' then a := old.telefone; d := new.telefone;
  else a := old.whatsapp; d := new.whatsapp; end if;
  if nullif(regexp_replace(coalesce(a, ''), '\D', '', 'g'), '') is null then return new; end if;
  if regexp_replace(coalesce(a, ''), '\D', '', 'g') = regexp_replace(coalesce(d, ''), '\D', '', 'g') then return new; end if;
  if new.user_id is null then return new; end if;
  insert into public.telefones_trocados (user_id, origem, antes, depois) values (new.user_id, tg_table_name, a, d);
  return new;
end $$;
revoke all on function public.tg_telefone_trocado() from public, anon, authenticated;

drop trigger if exists zz_telefone_trocado on public.perfis;
create trigger zz_telefone_trocado after update of telefone on public.perfis
  for each row execute function public.tg_telefone_trocado();
drop trigger if exists zz_telefone_trocado on public.clientes;
create trigger zz_telefone_trocado after update of whatsapp on public.clientes
  for each row execute function public.tg_telefone_trocado();

-- guarda 1 ano
delete from public.telefones_trocados where em < now() - interval '365 days';

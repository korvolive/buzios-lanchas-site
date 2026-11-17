-- publicar: auto
-- Búzios Lanchas: retenção de registros por 5 anos (avaliação de segurança Asaas, 16/11/2026, item "Retenção de logs").
-- 1) registro_acessos (logins) passa de 1 ano para 5 anos.
-- 2) Exportação diária dos registros da plataforma (acessos à API, login, funções, erros do banco)
--    para o cofre privado "registros-seguranca", com impressão digital (SHA-256) encadeada numa tabela só de inclusão.
--    Quem exporta: .github/workflows/registros-exportar.yml (todo dia, 05:15 BRT).
-- Idempotente.

-- 1) limpeza mensal: nada com menos de 5 anos sai
create or replace function public.limpar_registros_antigos() returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  delete from public.registro_acessos where em < now() - interval '5 years';
  get diagnostics a = row_count;
  perform set_config('buzios.limpeza', '1', true);
  delete from public.auditoria where em < now() - interval '5 years';
  get diagnostics b = row_count;
  delete from public.registros_exportados where dia < (now() - interval '5 years')::date;
  perform set_config('buzios.limpeza', '0', true);
  return jsonb_build_object('acessos', a, 'auditoria', b);
end $$;
revoke execute on function public.limpar_registros_antigos() from public, anon, authenticated;

-- 2) índice dos arquivos exportados, encadeado: cadeia = sha256(cadeia_anterior || sha256_do_arquivo)
create table if not exists public.registros_exportados (
  id bigserial primary key,
  em timestamptz not null default now(),
  dia date not null,
  fonte text not null,
  arquivo text not null,
  linhas integer not null,
  bytes bigint not null,
  sha256 text not null,
  cadeia_anterior text,
  cadeia text not null,
  unique (dia, fonte)
);
alter table public.registros_exportados enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'registros_exportados' and policyname = 'registros_exportados: admin le') then
    create policy "registros_exportados: admin le" on public.registros_exportados for select using (public.e_admin());
  end if;
end $$;
revoke insert, update, delete, truncate on public.registros_exportados from anon, authenticated;

create or replace function public._registros_exportados_trava() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('buzios.limpeza', true) = '1' and old.dia < (now() - interval '5 years')::date then
    return old;
  end if;
  raise exception 'registros_exportados só aceita inclusão';
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'registros_exportados_trava' and tgrelid = 'public.registros_exportados'::regclass) then
    create trigger registros_exportados_trava before update or delete on public.registros_exportados for each row execute function public._registros_exportados_trava();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'registros_exportados_trava_tudo' and tgrelid = 'public.registros_exportados'::regclass) then
    create trigger registros_exportados_trava_tudo before truncate on public.registros_exportados for each statement execute function public._registros_exportados_trava();
  end if;
end $$;

-- cofre privado: sem política para anon/authenticated (ninguém do site ou do app lê nem grava); só o servidor
insert into storage.buckets (id, name, public)
values ('registros-seguranca', 'registros-seguranca', false)
on conflict (id) do update set public = false;

-- trava no cofre: arquivo gravado não pode ser trocado nem apagado antes de 5 anos (nem pela chave de servidor)
create or replace function public._cofre_registros_trava() returns trigger language plpgsql as $$
begin
  if old.bucket_id = 'registros-seguranca' and old.created_at > now() - interval '5 years'
     and (tg_op = 'DELETE' or new.bucket_id is distinct from old.bucket_id or new.name is distinct from old.name
          or new.version is distinct from old.version) then
    raise exception 'cofre de registros: arquivo não pode ser alterado nem apagado antes de 5 anos';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'cofre_registros_trava' and tgrelid = 'storage.objects'::regclass) then
    create trigger cofre_registros_trava before update or delete on storage.objects for each row execute function public._cofre_registros_trava();
  end if;
exception when insufficient_privilege then
  raise notice 'sem permissão para trava em storage.objects; cofre segue protegido pela cadeia de SHA-256';
end $$;

-- Búzios Lanchas: compromissos de segurança com o Asaas (2026-11-13)
-- 5.1.3  auditoria só de inclusão: dinheiro, reservas e papéis. Nem o administrador altera ou apaga.
-- 5.1.4  registro de acessos (login, hora, IP, aparelho) guardado por 1 ano (mínimo legal 6 meses, Marco Civil art. 15);
--        auditoria guardada por 5 anos. Depois disso a rotina mensal apaga.

create table if not exists public.auditoria (
  id bigserial primary key,
  em timestamptz not null default now(),
  tabela text not null,
  operacao text not null,
  registro text,
  quem uuid default auth.uid(),
  papel text default current_setting('request.jwt.claim.role', true),
  antes jsonb,
  depois jsonb
);
create index if not exists auditoria_em on public.auditoria (em);
create index if not exists auditoria_tabela_registro on public.auditoria (tabela, registro);
alter table public.auditoria enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'auditoria' and policyname = 'auditoria: admin le') then
    create policy "auditoria: admin le" on public.auditoria for select using (public.e_admin());
  end if;
end $$;
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

-- trava: nada muda nem sai da auditoria, a não ser a limpeza dos registros com mais de 5 anos
create or replace function public._auditoria_trava() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('buzios.limpeza', true) = '1' and old.em < now() - interval '5 years' then return old; end if;
  end if;
  raise exception 'a auditoria só aceita inclusão';
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'auditoria_trava' and tgrelid = 'public.auditoria'::regclass) then
    create trigger auditoria_trava before update or delete on public.auditoria for each row execute function public._auditoria_trava();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'auditoria_trava_tudo' and tgrelid = 'public.auditoria'::regclass) then
    create trigger auditoria_trava_tudo before truncate on public.auditoria for each statement execute function public._auditoria_trava();
  end if;
end $$;

-- grava cada inclusão, mudança e exclusão das tabelas abaixo. Se a auditoria falhar, a operação do app segue (só fica um aviso no log).
create or replace function public._auditar() returns trigger language plpgsql security definer set search_path = public as $$
declare a jsonb; d jsonb; r jsonb;
begin
  if tg_op <> 'INSERT' then a := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then d := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and a = d then return null; end if;
  r := coalesce(d, a);
  begin
    insert into public.auditoria (tabela, operacao, registro, antes, depois)
    values (tg_table_name, tg_op, coalesce(r->>'id', r->>'pedido', r->>'bloqueio_id', r->>'user_id'), a, d);
  exception when others then raise warning 'auditoria %: %', tg_table_name, sqlerrm;
  end;
  return null;
end $$;
revoke execute on function public._auditar() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['pedidos','pagamentos_asaas','pagamentos_pp','repasses_pp','saques','asaas_contas','asaas_config',
                           'bloqueios','anotacoes','admins','papeis_painel','donos','vendedores'] loop
    if to_regclass('public.' || t) is not null and not exists (select 1 from pg_trigger where tgname = 'zz_auditar' and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger zz_auditar after insert or update or delete on public.%I for each row execute function public._auditar()', t);
    end if;
  end loop;
end $$;

-- registro de acessos: cada login (sessão nova) copiado de auth.sessions a cada 10 minutos, com hora, IP e aparelho
create table if not exists public.registro_acessos (
  sessao uuid primary key,
  user_id uuid,
  em timestamptz,
  ip text,
  user_agent text,
  aal text,
  copiado_em timestamptz not null default now()
);
create index if not exists registro_acessos_em on public.registro_acessos (em);
create index if not exists registro_acessos_user on public.registro_acessos (user_id, em);
alter table public.registro_acessos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'registro_acessos' and policyname = 'registro_acessos: admin le') then
    create policy "registro_acessos: admin le" on public.registro_acessos for select using (public.e_admin());
  end if;
end $$;
revoke insert, update, delete, truncate on public.registro_acessos from anon, authenticated;

create or replace function public.copiar_acessos() returns integer language sql security definer set search_path = public, auth as $$
  with x as (
    insert into public.registro_acessos (sessao, user_id, em, ip, user_agent, aal)
    select s.id, s.user_id, s.created_at, host(s.ip), s.user_agent, s.aal::text from auth.sessions s
    on conflict (sessao) do nothing returning 1)
  select count(*)::int from x
$$;
revoke execute on function public.copiar_acessos() from public, anon, authenticated;

-- limpeza mensal: acessos com mais de 1 ano, auditoria com mais de 5 anos
create or replace function public.limpar_registros_antigos() returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  delete from public.registro_acessos where em < now() - interval '1 year';
  get diagnostics a = row_count;
  perform set_config('buzios.limpeza', '1', true);
  delete from public.auditoria where em < now() - interval '5 years';
  get diagnostics b = row_count;
  perform set_config('buzios.limpeza', '0', true);
  return jsonb_build_object('acessos', a, 'auditoria', b);
end $$;
revoke execute on function public.limpar_registros_antigos() from public, anon, authenticated;

select public.copiar_acessos();
select cron.schedule('copiar-acessos', '*/10 * * * *', 'select public.copiar_acessos()');
select cron.schedule('limpar-registros-antigos', '30 4 1 * *', 'select public.limpar_registros_antigos()');

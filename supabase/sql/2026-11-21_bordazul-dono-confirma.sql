-- publicar: auto
-- Bordazul: o dono confirma antes do pagamento (Rodrigo 2026-11-21).
-- Fora de Búzios os donos não mantêm a agenda em dia. Nas embarcações dessas cidades, todo pedido vai para o dono aprovar
-- (WhatsApp /aprovar/ + app) e só depois do ok o cliente recebe o pagamento. Em Búzios nada muda.
-- Também marca a origem de cada cliente (Bordazul ou Búzios Lanchas) pelo site de onde veio, para o atendimento certo
-- (Bernardo no Bordazul, Lucas na Búzios Lanchas) responder, no mesmo número oficial, sem os dois falarem com a mesma pessoa.
-- Idempotente.

-- 1) Embarcação que exige a confirmação do dono: dados.confirma_dono manda; sem ele, toda cidade diferente de Búzios.
create or replace function public.lancha_confirma_dono(p text)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select case when l.dados ? 'confirma_dono' then coalesce((l.dados->>'confirma_dono')::boolean, false)
                               else coalesce(nullif(l.dados->>'cidade', ''), 'buzios') <> 'buzios' end
                     from public.lanchas l where l.slug = p), false)
$$;
grant execute on function public.lancha_confirma_dono(text) to anon, authenticated, service_role;

-- 2) Prazos do dono (lembrete e aviso ao cliente quando ele demora)
alter table public.aprovacoes_dono add column if not exists lembrete_em timestamptz;
alter table public.aprovacoes_dono add column if not exists sem_resposta_em timestamptz;
alter table public.aprovacoes_dono add column if not exists sem_resposta_envio text;

-- 3) Origem do cliente
alter table public.consultas add column if not exists origem text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'consultas_origem_ck') then
    alter table public.consultas add constraint consultas_origem_ck check (origem is null or origem in ('buzios', 'bordazul'));
  end if;
end $$;

create table if not exists public.atendimento_origem (
  tel text primary key check (tel ~ '^[0-9]{8,16}$'),
  origem text not null check (origem in ('buzios', 'bordazul')),
  fonte text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.atendimento_origem enable row level security;
drop policy if exists atendimento_origem_admin_le on public.atendimento_origem;
create policy atendimento_origem_admin_le on public.atendimento_origem for select to authenticated using (public.e_admin());
revoke all on public.atendimento_origem from anon;
grant select on public.atendimento_origem to authenticated;

-- grava a origem do número: a primeira vale; só troca se o cliente ficou 30 dias sem nenhum contato novo (só o servidor chama)
create or replace function public.marcar_origem(p_tel text, p_origem text, p_fonte text default null)
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare d text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'); o text;
begin
  if p_origem not in ('buzios', 'bordazul') then return null; end if;
  if (length(d) = 10 or length(d) = 11) and left(d, 2) <> '55' then d := '55' || d; end if;
  if length(d) < 8 or length(d) > 16 then return null; end if;
  insert into public.atendimento_origem (tel, origem, fonte) values (d, p_origem, left(p_fonte, 40))
  on conflict (tel) do update set
    origem = case when public.atendimento_origem.atualizado_em < now() - interval '30 days' then excluded.origem else public.atendimento_origem.origem end,
    fonte = case when public.atendimento_origem.atualizado_em < now() - interval '30 days' then excluded.fonte else public.atendimento_origem.fonte end,
    atualizado_em = now()
  returning origem into o;
  return o;
end $$;
revoke all on function public.marcar_origem(text, text, text) from public, anon, authenticated;
grant execute on function public.marcar_origem(text, text, text) to service_role;

-- consulta nova do site: a origem vem do endereço da página (Bordazul e os sites das outras cidades = bordazul) (cabeçalho Origin/Referer do navegador); a equipe não muda nada
create or replace function public.consulta_origem()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare h json; u text;
begin
  if new.origem is null and new.criado_por is null then
    begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
    u := lower(coalesce(h->>'origin', h->>'referer', ''));
    if u ~ '^https?://([a-z0-9-]+\.)*(bordazul|cabofriolanchas|lanchasemarraial)\.com\.br(:[0-9]+)?(/|$)' then new.origem := 'bordazul';
    elsif u ~ '^https?://([a-z0-9-]+\.)*lanchaembuzios\.com\.br(:[0-9]+)?(/|$)' then new.origem := 'buzios';
    end if;
  end if;
  if new.origem is not null and new.telefone is not null then
    begin perform public.marcar_origem(new.telefone, new.origem, 'site'); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists a_consulta_origem on public.consultas;
create trigger a_consulta_origem before insert on public.consultas for each row execute function public.consulta_origem();

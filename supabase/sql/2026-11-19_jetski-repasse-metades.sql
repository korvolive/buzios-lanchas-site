-- publicar: auto
-- Jet ski em duas metades + cortesia só do mesmo dono (Rodrigo 2026-11-19).
-- 1) O dono do jet ski recebe 50% 2 h antes da saída da lancha (como antes, só com o dinheiro do pedido já na Búzios)
--    e os outros 50% sozinhos no fim do horário do jet ski (início + tempo + cortesia). Nunca recebe só depois.
-- 2) Cliente desistiu ou não apareceu: a segunda metade sai normalmente.
-- 3) Cancelado ou devolvido ao cliente depois da primeira metade: a segunda fica na Búzios e o administrador recebe um
--    aviso para acertar a primeira direto com o dono. Acabou o desconto automático nos próximos repasses (jetski_dividas).
-- 4) Cortesia de jet ski só numa lancha do mesmo dono do jet ski (vale também para o administrador); começa desligada.
-- Idempotente, sem DROP de dados.

alter table public.pedidos add column if not exists jetski_metade1 numeric(10,2);   -- quanto foi na 1ª metade (nulo = repasse antigo, inteiro)
alter table public.pedidos add column if not exists jetski_repasse2 text;           -- 'asaas:<id>', 'asaas:enviando' ou 'buzios' (ficou na Búzios)
alter table public.pedidos add column if not exists jetski_repasse2_em timestamptz;

-- só o servidor (ou o administrador) mexe nas colunas novas
create or replace function public.tg_pedido_jetski_metades_protege()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.e_admin() then
    new.jetski_metade1 := old.jetski_metade1; new.jetski_repasse2 := old.jetski_repasse2; new.jetski_repasse2_em := old.jetski_repasse2_em;
  end if;
  return new;
end $$;
revoke execute on function public.tg_pedido_jetski_metades_protege() from public, anon, authenticated;
create or replace trigger pedido_jetski_metades_protege before update of jetski_metade1, jetski_repasse2, jetski_repasse2_em on public.pedidos
  for each row execute function public.tg_pedido_jetski_metades_protege();

-- acertos com o dono: jet ski cancelado/devolvido depois de ele já ter recebido (o administrador resolve direto com ele)
create table if not exists public.jetski_acertos (
  id bigserial primary key,
  pedido bigint not null,
  jetski uuid,
  dono uuid,
  pago numeric(10,2) not null default 0,     -- o que o dono já recebeu
  retido numeric(10,2) not null default 0,   -- o que ficou na Búzios (segunda metade)
  motivo text,
  criado_em timestamptz not null default now(),
  avisado_em timestamptz,
  resolvido_em timestamptz,
  resolvido_por uuid
);
create unique index if not exists jetski_acertos_pedido_jetski on public.jetski_acertos (pedido, jetski);
alter table public.jetski_acertos enable row level security;
drop policy if exists "jetski_acertos: admin le" on public.jetski_acertos;
create policy "jetski_acertos: admin le" on public.jetski_acertos for select to authenticated using (public.e_admin());
revoke all on table public.jetski_acertos from anon, authenticated;
grant select on table public.jetski_acertos to authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'zz_auditar' and tgrelid = 'public.jetski_acertos'::regclass) then
    create trigger zz_auditar after insert or update or delete on public.jetski_acertos for each row execute function public._auditar();
  end if;
end $$;

create or replace function public.jetski_acerto_resolver(p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.e_admin() then raise exception 'SO_ADMIN'; end if;
  update public.jetski_acertos set resolvido_em = now(), resolvido_por = auth.uid() where id = p_id and resolvido_em is null;
  return found;
end $$;
revoke execute on function public.jetski_acerto_resolver(bigint) from public, anon;
grant execute on function public.jetski_acerto_resolver(bigint) to authenticated;

-- troca ou retirada do jet ski num pedido em que o dono já recebeu: não vira mais dívida automática; vira acerto (aviso ao administrador).
-- O jet ski novo (troca) volta a receber do zero, nas duas metades.
create or replace function public.tg_pedido_jetski_troca()
returns trigger language plpgsql security definer set search_path = public as $$
declare d uuid; pago numeric := 0;
begin
  if old.jetski is null or new.jetski is not distinct from old.jetski then return new; end if;
  if old.jetski_repasse is null and old.jetski_repasse2 is null then return new; end if;
  if old.jetski_repasse like 'asaas:%' and old.jetski_repasse <> 'asaas:enviando' or old.jetski_repasse = 'divida' then
    pago := coalesce(old.jetski_metade1, old.jetski_neto, 0);
  end if;
  if old.jetski_repasse2 like 'asaas:%' and old.jetski_repasse2 <> 'asaas:enviando' then
    pago := coalesce(old.jetski_neto, pago);
  end if;
  select dono into d from public.jetskis where id = old.jetski;
  if coalesce(old.jetski_neto, 0) > 0 then
    insert into public.jetski_acertos (pedido, jetski, dono, pago, retido, motivo)
    values (old.id, old.jetski, d, round(pago, 2), greatest(round(coalesce(old.jetski_neto, 0) - pago, 2), 0),
            case when new.jetski is null then 'jet ski devolvido ao cliente' else 'troca de jet ski' end)
    on conflict (pedido, jetski) do nothing;
  end if;
  new.jetski_repasse := null; new.jetski_repasse_em := null;
  new.jetski_metade1 := null; new.jetski_repasse2 := null; new.jetski_repasse2_em := null;
  return new;
end $$;
revoke execute on function public.tg_pedido_jetski_troca() from public, anon, authenticated;
create or replace trigger pedido_jetski_troca before update of jetski on public.pedidos
  for each row execute function public.tg_pedido_jetski_troca();

-- crédito por desistência: o jet ski que já começou a ser pago ao dono não entra no crédito (como antes);
-- nada muda em virar_credito (ele já só soma jet ski com jetski_repasse nulo).

-- aluguéis do dono: as duas metades e quando cai cada uma
drop function if exists public.meus_jetski_alugueis();
create function public.meus_jetski_alugueis()
returns table(jetski uuid, nome text, data date, ini time, fim time, lancha text, minutos int, cortesia_min int,
              neto numeric, situacao text, cai_em timestamp, recebido_em timestamptz,
              metade1 numeric, cai2_em timestamp, recebido2_em timestamptz)
language sql stable security definer set search_path = public as $$
  select u.jetski, j.nome, u.data, u.ini, u.fim, u.lancha, u.minutos, u.cortesia_min,
    nullif(coalesce(p.jetski_neto, u.neto), 0),
    case when p.jetski_repasse = 'asaas:enviando' or p.jetski_repasse2 = 'asaas:enviando' then 'enviando'
         when p.jetski_repasse2 = 'buzios' then 'retido'
         when p.jetski_repasse2 is not null then 'recebido'
         when p.jetski_repasse is not null and p.jetski_metade1 is null then 'recebido'   -- repasse antigo, inteiro
         when p.jetski_repasse is not null then 'metade'
         when coalesce(p.jetski_neto, u.neto, 0) = 0 then 'cortesia'
         when p.status = 'aprovado' then 'garantido'
         else 'aguardando' end,
    case when p.id is not null then public.inicio_combinado(p.data, p.horario, p.hora_ini, p.bloqueio_id) - interval '2 hours' end,
    p.jetski_repasse_em,
    case when p.jetski_metade1 is not null then p.jetski_metade1
         when coalesce(p.jetski_neto, 0) > 0 and p.jetski_repasse is null then round(p.jetski_neto / 2, 2) end,
    case when p.jetski_ini is not null then p.data + p.jetski_ini + make_interval(mins => coalesce(p.jetski_min, 0) + coalesce(p.jetski_cortesia, 0)) end,
    p.jetski_repasse2_em
  from public.jetski_usos u
  join public.jetskis j on j.id = u.jetski
  left join public.pedidos p on p.id = u.pedido_id
  where u.removido_em is null and u.tipo = 'uso'
    and u.data >= (now() at time zone 'America/Sao_Paulo')::date - 30
    and (j.dono = auth.uid() or public.e_admin())
  order by u.data, u.ini
$$;
revoke all on function public.meus_jetski_alugueis() from public, anon;
grant execute on function public.meus_jetski_alugueis() to authenticated;

-- cortesia de jet ski: só numa lancha do mesmo dono, para todo mundo (até o administrador); tempo de 15 a 180 min, de 15 em 15
create or replace function public.tg_jetski_cortesia_mesmo_dono()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cortesia_lancha is not null and not exists (select 1 from public.donos d where d.lancha = new.cortesia_lancha and d.user_id = new.dono) then
    if tg_op = 'UPDATE' and new.cortesia_lancha is not distinct from old.cortesia_lancha then
      new.cortesia_lancha := null; new.cortesia_min := 0;   -- jet ski mudou de dono: a cortesia desliga sozinha
    else
      raise exception 'CORTESIA_LANCHA';
    end if;
  end if;
  if new.cortesia_lancha is null then new.cortesia_min := 0;
  elsif coalesce(new.cortesia_min, 0) < 15 or new.cortesia_min > 180 or new.cortesia_min % 15 <> 0 then raise exception 'CORTESIA_MIN';
  end if;
  return new;
end $$;
revoke execute on function public.tg_jetski_cortesia_mesmo_dono() from public, anon, authenticated;
create or replace trigger jetski_cortesia_mesmo_dono before insert or update of cortesia_lancha, cortesia_min, dono on public.jetskis
  for each row execute function public.tg_jetski_cortesia_mesmo_dono();

-- a lancha mudou de dono (ou saiu da lista de donos): cortesia de jet ski de quem não é mais dono dela desliga
create or replace function public.tg_donos_cortesia_jetski()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.jetskis j set cortesia_lancha = null, cortesia_min = 0
   where j.cortesia_lancha = old.lancha
     and not exists (select 1 from public.donos d where d.lancha = j.cortesia_lancha and d.user_id = j.dono);
  return null;
end $$;
revoke execute on function public.tg_donos_cortesia_jetski() from public, anon, authenticated;
create or replace trigger donos_cortesia_jetski after delete or update on public.donos
  for each row execute function public.tg_donos_cortesia_jetski();

-- conferência dos que já existem (hoje: só o Sea-Doo na Les Zuzu, mesmo dono, fica como está)
update public.jetskis j set cortesia_lancha = null, cortesia_min = 0
 where j.cortesia_lancha is not null
   and not exists (select 1 from public.donos d where d.lancha = j.cortesia_lancha and d.user_id = j.dono);

-- publicar: auto
-- Jet ski cancelado depois do repasse (Rodrigo 2026-11-17, cartão de decisão "Aprovar as 3 regras"):
-- 1) desistência do cliente no dia: o dono fica com o valor (virar_credito já tira o jet ski repassado do crédito; nada muda aqui);
-- 2) remarcação por mar ou Marinha: o pedido muda de data e o jet ski já pago vai junto; jetski_repasse continua preenchido e não paga de novo;
-- 3) devolução ao cliente ou troca de jet ski depois do repasse: o dono fica devendo e o valor sai sozinho dos próximos repasses de jet ski dele.
-- Idempotente, sem DROP/DELETE de dados.

create table if not exists public.jetski_dividas (
  id bigserial primary key,
  dono uuid not null,
  jetski uuid,
  pedido bigint not null,
  valor numeric(10,2) not null check (valor > 0),
  restante numeric(10,2) not null check (restante >= 0 and restante <= valor),
  motivo text,
  criado_em timestamptz not null default now(),
  criado_por uuid
);
create index if not exists jetski_dividas_dono on public.jetski_dividas (dono) where restante > 0;
alter table public.jetski_dividas enable row level security;
drop policy if exists "jetski_dividas: dono e admin leem" on public.jetski_dividas;
create policy "jetski_dividas: dono e admin leem" on public.jetski_dividas for select to authenticated
  using (dono = auth.uid() or public.e_admin());
revoke all on table public.jetski_dividas from anon, authenticated;
grant select on table public.jetski_dividas to authenticated;

-- cada desconto feito num repasse (para desfazer se o envio falhar)
create table if not exists public.jetski_abatimentos (
  id bigserial primary key,
  divida bigint not null references public.jetski_dividas(id),
  pedido bigint not null,
  valor numeric(10,2) not null check (valor > 0),
  criado_em timestamptz not null default now()
);
alter table public.jetski_abatimentos enable row level security;
drop policy if exists "jetski_abatimentos: dono e admin leem" on public.jetski_abatimentos;
create policy "jetski_abatimentos: dono e admin leem" on public.jetski_abatimentos for select to authenticated
  using (public.e_admin() or exists (select 1 from public.jetski_dividas d where d.id = divida and d.dono = auth.uid()));
revoke all on table public.jetski_abatimentos from anon, authenticated;
grant select on table public.jetski_abatimentos to authenticated;

do $$ declare t text; begin
  foreach t in array array['jetski_dividas','jetski_abatimentos'] loop
    if not exists (select 1 from pg_trigger where tgname = 'zz_auditar' and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger zz_auditar after insert or update or delete on public.%I for each row execute function public._auditar()', t);
    end if;
  end loop;
end $$;

-- troca ou retirada do jet ski num pedido já repassado: dívida do dono antigo e o repasse volta a valer para o jet ski novo.
-- Roda depois de "pedido_jetski" (ordem alfabética), que já desfaz a troca de quem não é administrador.
create or replace function public.tg_pedido_jetski_troca()
returns trigger language plpgsql security definer set search_path = public as $$
declare d uuid;
begin
  if old.jetski is null or old.jetski_repasse is null or new.jetski is not distinct from old.jetski then return new; end if;
  select dono into d from public.jetskis where id = old.jetski;
  if d is not null and coalesce(old.jetski_neto, 0) > 0 then
    insert into public.jetski_dividas (dono, jetski, pedido, valor, restante, motivo, criado_por)
    values (d, old.jetski, old.id, round(old.jetski_neto, 2), round(old.jetski_neto, 2),
            case when new.jetski is null then 'devolvido ao cliente' else 'troca de jet ski' end, auth.uid());
  end if;
  new.jetski_repasse := null; new.jetski_repasse_em := null;
  return new;
end $$;
revoke execute on function public.tg_pedido_jetski_troca() from public, anon, authenticated;
create or replace trigger pedido_jetski_troca before update of jetski on public.pedidos
  for each row execute function public.tg_pedido_jetski_troca();

-- desconto da dívida no repasse (só o servidor): devolve quanto ainda vai para o dono
create or replace function public.jetski_abater(p_pid bigint, p_dono uuid, p_valor numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare r record; falta numeric := round(coalesce(p_valor, 0), 2); x numeric;
begin
  if falta <= 0 then return 0; end if;
  for r in select id, restante from public.jetski_dividas
            where dono = p_dono and restante > 0 and pedido <> p_pid order by criado_em, id for update loop
    exit when falta <= 0;
    x := least(r.restante, falta);
    update public.jetski_dividas set restante = restante - x where id = r.id;
    insert into public.jetski_abatimentos (divida, pedido, valor) values (r.id, p_pid, x);
    falta := falta - x;
  end loop;
  return falta;
end $$;
revoke execute on function public.jetski_abater(bigint, uuid, numeric) from public, anon, authenticated;
grant execute on function public.jetski_abater(bigint, uuid, numeric) to service_role;

-- envio recusado pelo Asaas: a dívida volta como estava
create or replace function public.jetski_abater_desfaz(p_pid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, divida, valor from public.jetski_abatimentos where pedido = p_pid for update loop
    update public.jetski_dividas set restante = least(valor, restante + r.valor) where id = r.divida;
    delete from public.jetski_abatimentos where id = r.id;
  end loop;
end $$;
revoke execute on function public.jetski_abater_desfaz(bigint) from public, anon, authenticated;
grant execute on function public.jetski_abater_desfaz(bigint) to service_role;

-- administrador devolve o jet ski ao cliente num pedido já pago (regra 3). O dinheiro ao cliente sai à mão no Asaas;
-- se o dono já recebeu, o gatilho acima registra a dívida.
create or replace function public.tirar_jetski(pid bigint, devolver boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare p public.pedidos;
begin
  if not public.e_admin() then raise exception 'SO_ADMIN'; end if;
  if not coalesce(devolver, false) then return public.tirar_jetski(pid); end if;
  select * into p from public.pedidos where id = pid for update;
  if p.id is null or p.jetski is null then return false; end if;
  update public.pedidos set jetski = null, atualizado_em = now() where id = pid;
  return true;
end $$;
revoke execute on function public.tirar_jetski(bigint, boolean) from public, anon;
grant execute on function public.tirar_jetski(bigint, boolean) to authenticated;

-- aluguéis do dono: repasse coberto pela dívida aparece como "descontado" (era "recebido")
create or replace function public.meus_jetski_alugueis()
returns table(jetski uuid, nome text, data date, ini time, fim time, lancha text, minutos int, cortesia_min int,
              neto numeric, situacao text, cai_em timestamp, recebido_em timestamptz)
language sql stable security definer set search_path = public as $$
  select u.jetski, j.nome, u.data, u.ini, u.fim, u.lancha, u.minutos, u.cortesia_min,
    nullif(coalesce(p.jetski_neto, u.neto), 0),
    case when p.jetski_repasse = 'divida' then 'descontado'
         when p.jetski_repasse is not null and p.jetski_repasse <> 'asaas:enviando' then 'recebido'
         when p.jetski_repasse = 'asaas:enviando' then 'enviando'
         when coalesce(p.jetski_neto, u.neto, 0) = 0 then 'cortesia'
         when p.status = 'aprovado' then 'garantido'
         else 'aguardando' end,
    case when p.id is not null then public.inicio_combinado(p.data, p.horario, p.hora_ini, p.bloqueio_id) - interval '2 hours' end,
    p.jetski_repasse_em
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

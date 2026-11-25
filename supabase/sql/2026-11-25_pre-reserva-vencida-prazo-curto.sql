-- publicar: auto
-- 25/11/2026 (Rodrigo, caso Marcelo / pedido 107 na JC Pescador): pré-reserva que venceu sem sinal não reabre sozinha.
-- O cliente é avisado que venceu e perguntado se ainda quer; se ele voltar e a pré-reserva for lançada de novo
-- (mesmo telefone, mesma data, até 3 dias depois de vencer), o prazo novo é CURTO: 2 horas
-- (respeitando a regra de nunca vencer entre 23h e 9h, que fica no _prazo_pre_fim).
-- Como todo o sistema calcula o prazo por _prazo_pre_fim(bloqueios.criado_em, data), o jeito seguro é recuar o criado_em
-- do bloqueio novo (mesmo método já usado para estender prazos) e alinhar pedidos.pagar_ate.
-- Também troca o texto do aviso no chat do app quando o prazo vence. Idempotente.

-- 1) bloqueios que receberam o prazo curto (só o servidor lê/escreve)
create table if not exists public.prazo_curto (
  bloqueio_id bigint primary key,
  ate timestamptz not null,
  criado_em timestamptz not null default now()
);
alter table public.prazo_curto enable row level security;
revoke all on table public.prazo_curto from public, anon, authenticated;

-- 2) houve pré-reserva deste telefone, nesta data, que venceu sem sinal nos últimos 3 dias?
create or replace function public._pre_vencida_recente(p_tel text, p_data date)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select regexp_replace(coalesce(p_tel, ''), '\D', '', 'g') <> '' and exists (
    select 1
      from public.auditoria ab
      join public.auditoria aa on aa.tabela = 'anotacoes' and aa.operacao = 'DELETE' and aa.quem is null
                              and (aa.antes->>'bloqueio_id') = ab.registro
     where ab.tabela = 'bloqueios' and ab.operacao = 'DELETE' and ab.quem is null
       and ab.em >= now() - interval '3 days'
       and (ab.antes->>'data')::date = p_data
       and regexp_replace(coalesce(aa.antes->>'telefone', ''), '\D', '', 'g') = regexp_replace(p_tel, '\D', '', 'g')
       and coalesce((aa.antes->>'valor')::numeric, 0) > 0
       and coalesce((aa.antes->>'sinal')::numeric, 0) = 0
       -- apagado porque o prazo acabou (não por troca de lancha ou cancelamento antes do prazo)
       and public._prazo_pre_fim((ab.antes->>'criado_em')::timestamptz, (ab.antes->>'data')::date) <= ab.em + interval '5 minutes'
  )
$$;
revoke all on function public._pre_vencida_recente(text, date) from public, anon, authenticated;

-- 3) recua o criado_em para o prazo ficar em agora + p_horas (ou 9h/8h se cair de madrugada). Só encurta, nunca alonga.
create or replace function public._aplicar_prazo_curto(p_bid bigint, p_horas int default 2)
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare b record; alvo timestamptz; normal timestamptz; c timestamptz; f timestamptz; melhor timestamptz; melhor_c timestamptz; k int; ids bigint[];
begin
  select * into b from public.bloqueios where id = p_bid;
  if not found then return null; end if;
  alvo := now() + make_interval(hours => p_horas);
  normal := public._prazo_pre_fim(b.criado_em, b.data);
  foreach k in array array[12, 6, 3, 2, 1] loop
    c := alvo - make_interval(hours => k);
    if c > now() then continue; end if; -- criado no futuro mudaria a contagem de dias (ex.: véspera virando "mesmo dia" às 23h40)
    f := public._prazo_pre_fim(c, b.data);
    if f >= alvo - interval '1 minute' and (melhor is null or f < melhor) then melhor := f; melhor_c := c; end if;
  end loop;
  if melhor is null or melhor >= normal - interval '1 minute' then return null; end if; -- o prazo normal já é curto
  -- grupo (várias lanchas, um pagamento): o _ligar_passeio usa o criado_em do bloqueio principal, então o grupo todo recua junto
  select coalesce(array_agg(a.bloqueio_id), array[p_bid]) into ids from public.anotacoes a
   where a.grupo is not null and a.grupo = (select grupo from public.anotacoes where bloqueio_id = p_bid);
  if not (p_bid = any(ids)) then ids := ids || p_bid; end if;
  update public.bloqueios set criado_em = melhor_c where id = any(ids) and data = b.data;
  insert into public.prazo_curto(bloqueio_id, ate) select x, melhor from unnest(ids) x
    on conflict (bloqueio_id) do update set ate = excluded.ate, criado_em = now();
  update public.pedidos set pagar_ate = melhor, atualizado_em = now() where bloqueio_id = any(ids) and status = 'pendente';
  return melhor;
end $$;
revoke all on function public._aplicar_prazo_curto(bigint, int) from public, anon, authenticated;

-- 4) gatilho: pré-reserva nova (valor lançado, sinal zero) de quem acabou de deixar uma vencer na mesma data
create or replace function public.tg_pre_vencida_prazo_curto()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare b record;
begin
  if coalesce(new.valor, 0) <= 0 or coalesce(new.sinal, 0) <> 0 or coalesce(new.telefone, '') = '' then return null; end if;
  if tg_op = 'UPDATE' and old.telefone is not distinct from new.telefone and coalesce(old.valor, 0) > 0 then return null; end if;
  if exists (select 1 from public.prazo_curto where bloqueio_id = new.bloqueio_id) then return null; end if;
  select * into b from public.bloqueios where id = new.bloqueio_id;
  if not found or b.criado_em < now() - interval '15 minutes' then return null; end if; -- só pré-reserva recém-lançada
  if not public._pre_vencida_recente(new.telefone, b.data) then return null; end if;
  perform public._aplicar_prazo_curto(new.bloqueio_id, 2);
  return null;
exception when others then
  raise warning 'prazo curto falhou (bloqueio %): %', new.bloqueio_id, sqlerrm; -- nunca trava o lançamento da pré-reserva
  return null;
end $$;
revoke all on function public.tg_pre_vencida_prazo_curto() from public, anon, authenticated;
create or replace trigger zz_pre_vencida_prazo_curto after insert or update of telefone, valor on public.anotacoes
  for each row execute function public.tg_pre_vencida_prazo_curto();

-- 5) pedido criado (ou ligado) depois: o pagar_ate segue o prazo real do bloqueio com prazo curto
create or replace function public.tg_pedido_prazo_curto()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare b record;
begin
  if new.bloqueio_id is null or new.status is distinct from 'pendente' then return new; end if;
  if tg_op = 'UPDATE' and old.bloqueio_id is not distinct from new.bloqueio_id then return new; end if;
  if not exists (select 1 from public.prazo_curto where bloqueio_id = new.bloqueio_id) then return new; end if;
  select * into b from public.bloqueios where id = new.bloqueio_id;
  if found then new.pagar_ate := public._prazo_pre_fim(b.criado_em, b.data); end if;
  return new;
exception when others then
  raise warning 'prazo curto no pedido falhou: %', sqlerrm;
  return new;
end $$;
revoke all on function public.tg_pedido_prazo_curto() from public, anon, authenticated;
create or replace trigger zz_pedido_prazo_curto before insert or update of bloqueio_id on public.pedidos
  for each row execute function public.tg_pedido_prazo_curto();

-- 6) texto do aviso no chat do app quando o prazo vence (Rodrigo: avisar que venceu, que a lancha voltou a ficar
--    disponível para outras pessoas, e perguntar se ainda tem interesse, com prazo curto de 2 horas)
do $do$
declare def text;
begin
  def := pg_get_functiondef('public.vencer_pre_pedidos'::regproc);
  if position('O prazo para pagar o sinal acabou e a data foi liberada. Se ainda quiser o passeio, fale com a gente aqui no chat.' in def) > 0 then
    def := replace(def, 'O prazo para pagar o sinal acabou e a data foi liberada. Se ainda quiser o passeio, fale com a gente aqui no chat.',
      'O prazo para pagar o sinal terminou, e a lancha voltou a ficar disponível para outras pessoas. Você ainda tem interesse? Se quiser, liberamos um novo prazo curto, de 2 horas, para o pagamento. É só responder aqui.');
    def := replace(def, 'ultima_msg = ''O prazo para pagar o sinal acabou e a data foi liberada.''',
      'ultima_msg = ''O prazo para pagar o sinal terminou. Você ainda tem interesse?''');
    execute def;
  end if;
end $do$;

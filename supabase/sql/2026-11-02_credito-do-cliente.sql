-- Crédito do cliente (Rodrigo 2026-11-02)
-- O cliente desiste e o sinal pago vira crédito para usar em até 1 ano, só na mesma lancha.
-- "Virar crédito" apaga o passeio (a data volta a ficar livre no site) e guarda o crédito.
-- O cliente vê o crédito em Meus passeios; o administrador vê o card "Créditos de clientes" em Reservas.
-- Remover o crédito (ex.: a data foi vendida e o sinal devolvido) não apaga a linha: marca removido_em.

create table if not exists public.creditos (
  id bigint generated always as identity primary key,
  cliente uuid references auth.users(id) on delete set null,
  nome text,
  telefone text,
  lancha text not null,
  valor numeric not null check (valor > 0 and valor <= 99999),
  valido_ate date not null,
  origem_data date,
  origem_horario text,
  origem_bloqueio bigint,
  obs text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  usado_em timestamptz,
  usado_bloqueio bigint references public.bloqueios(id) on delete set null,
  removido_em timestamptz,
  removido_por uuid,
  aviso_vence_em timestamptz,   -- aviso de 30 dias antes de vencer (função notificar, rodada "fim")
  aviso_venceu_em timestamptz   -- aviso de crédito vencido
);
alter table public.creditos enable row level security;
revoke all on public.creditos from anon, authenticated; -- leitura e escrita só pelas funções abaixo

-- mensagem automática no chat de atendimento do cliente (cria o chat se ainda não existe). Texto em português;
-- o app mostra no idioma de quem lê pelo código sistema = credito:<acao>:<valor>:<lancha>:<válido até>
create or replace function public._credito_chat(c public.creditos, acao text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare cv bigint; nm text; v text; tx text;
begin
  if c.cliente is null or not exists (select 1 from public.clientes where user_id = c.cliente) then return; end if;
  insert into public.conversas (tipo, cliente) values ('suporte', c.cliente) on conflict (cliente) where tipo = 'suporte' do nothing;
  select id into cv from public.conversas where tipo = 'suporte' and cliente = c.cliente;
  select nome into nm from public.lanchas where slug = c.lancha;
  v := 'R$ ' || trim(to_char(c.valor, case when c.valor = trunc(c.valor) then 'FM999G999' else 'FM999G999D00' end));
  v := translate(v, ',.', '.,');
  tx := case acao
    when 'novo' then format('O sinal que você pagou virou um crédito de %s para usar na %s até %s. Quando escolher a nova data, é só chamar a gente aqui no chat ou no WhatsApp. O crédito também aparece em Meus passeios.', v, coalesce(nm, c.lancha), to_char(c.valido_ate, 'DD/MM/YYYY'))
    else format('O seu crédito de %s na %s foi encerrado. Qualquer dúvida, fale com a gente aqui.', v, coalesce(nm, c.lancha)) end;
  insert into public.mensagens (conversa, autor, texto, sistema) values (cv, null, tx, 'credito:' || acao || ':' || c.valor || ':' || c.lancha || ':' || c.valido_ate);
  update public.conversas set ultima_em = now(), ultima_msg = left(tx, 80), encerrada_em = null where id = cv;
exception when others then null; -- o aviso no chat nunca impede o crédito
end $$;

-- administrador: passeio da Búzios Lanchas com sinal pago vira crédito; o passeio sai da agenda
create or replace function public.virar_credito(bid bigint, ate date, v numeric default null)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; c public.creditos%rowtype; tel text; val numeric;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.e_admin() then raise exception 'Só o administrador transforma em crédito'; end if;
  select * into b from public.bloqueios where id = bid for update;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if b.id is null or a.bloqueio_id is null then raise exception 'Passeio não encontrado'; end if;
  if a.origem is distinct from 'buzios' then raise exception 'Só passeio fechado pela Búzios Lanchas vira crédito'; end if;
  if not (coalesce(a.sinal, 0) > 0) then raise exception 'Este passeio não tem sinal pago'; end if;
  if b.data < hoje then raise exception 'A data deste passeio já passou'; end if;
  val := coalesce(v, a.sinal);
  if not (val > 0 and val <= 99999) then raise exception 'Valor do crédito inválido'; end if;
  if ate is null or ate <= hoje or ate > hoje + interval '2 years' then raise exception 'Escolha uma validade entre amanhã e 2 anos'; end if;
  tel := coalesce(nullif(btrim(a.telefone), ''), (select whatsapp from public.clientes where user_id = a.cliente_conta));
  insert into public.creditos (cliente, nome, telefone, lancha, valor, valido_ate, origem_data, origem_horario, origem_bloqueio, obs)
    values (a.cliente_conta, nullif(btrim(a.cliente), ''), tel, b.lancha, val, ate, b.data, b.horario, b.id, nullif(btrim(a.obs), ''))
    returning * into c;
  perform public._credito_chat(c, 'novo');
  update public.pedidos set motivo = 'credito' where bloqueio_id = bid and status in ('aprovado', 'pendente');
  delete from public.bloqueios where id = bid; -- o gatilho cancela o pedido ligado; a data fica livre
  return c.id;
end $$;

-- administrador e suporte: todos os créditos (abertos primeiro)
create or replace function public.creditos_admin()
returns setof public.creditos language sql stable security definer set search_path to 'public' as $$
  select * from public.creditos
   where public.e_admin() or coalesce(public.papel_painel() = 'operador', false)
   order by (usado_em is null and removido_em is null) desc, valido_ate, id
   limit 300;
$$;

-- cliente: os créditos dele ainda abertos
create or replace function public.meus_creditos()
returns table (id bigint, lancha text, valor numeric, valido_ate date, origem_data date)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.lancha, c.valor, c.valido_ate, c.origem_data from public.creditos c
   where auth.uid() is not null and c.cliente = auth.uid() and c.usado_em is null and c.removido_em is null
     and c.valido_ate >= (now() at time zone 'America/Sao_Paulo')::date
   order by c.valido_ate;
$$;

-- administrador: crédito usado no passeio novo (bid) ou marcado como usado sem passeio (bid nulo)
create or replace function public.usar_credito(cid bigint, bid bigint default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.creditos%rowtype; l text;
begin
  if not public.e_admin() then raise exception 'Só o administrador usa o crédito'; end if;
  select * into c from public.creditos where id = cid for update;
  if c.id is null then raise exception 'Crédito não encontrado'; end if;
  if c.usado_em is not null or c.removido_em is not null then raise exception 'Este crédito já foi usado ou removido'; end if;
  if c.valido_ate < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Este crédito já venceu'; end if;
  if bid is not null and exists (select 1 from public.creditos where usado_bloqueio = bid) then raise exception 'Este passeio já usou um crédito'; end if;
  if bid is not null then
    select lancha into l from public.bloqueios where id = bid;
    if l is null then raise exception 'Passeio não encontrado'; end if;
    if l <> c.lancha then raise exception 'O crédito vale só na lancha em que foi dado'; end if;
  end if;
  update public.creditos set usado_em = now(), usado_bloqueio = bid where id = cid;
end $$;

-- administrador: remove o crédito (ex.: vendeu a data e devolveu o sinal); fica guardado como removido
create or replace function public.remover_credito(cid bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.creditos%rowtype;
begin
  if not public.e_admin() then raise exception 'Só o administrador remove o crédito'; end if;
  update public.creditos set removido_em = now(), removido_por = auth.uid()
   where id = cid and usado_em is null and removido_em is null returning * into c;
  if c.id is null then raise exception 'Este crédito já foi usado ou removido'; end if;
  perform public._credito_chat(c, 'removido');
end $$;

revoke all on function public._credito_chat(public.creditos, text) from public, anon, authenticated;
revoke all on function public.virar_credito(bigint, date, numeric), public.creditos_admin(), public.meus_creditos(),
  public.usar_credito(bigint, bigint), public.remover_credito(bigint) from public, anon;
grant execute on function public.virar_credito(bigint, date, numeric), public.creditos_admin(), public.meus_creditos(),
  public.usar_credito(bigint, bigint), public.remover_credito(bigint) to authenticated;

notify pgrst, 'reload schema';

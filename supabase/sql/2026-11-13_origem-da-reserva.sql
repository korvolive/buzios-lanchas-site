-- Búzios Lanchas: quem trouxe a reserva (Rodrigo 2026-11-13).
-- Os avisos que chegam ao administrador (e-mail e celular) passam a dizer a origem:
-- vendedor (nome), parceiro (nome), Lucas (WhatsApp), dono da lancha, painel da Búzios Lanchas ou site (cliente direto).
-- Só identificação: não muda nenhum fluxo.

-- 1) guarda quem lançou o pedido quando a consulta é aprovada (a consulta é apagada na aprovação)
alter table public.bloqueios add column if not exists trazido_por uuid;

-- Gatilho: o passeio que nasce da aprovação de uma consulta (mesma lancha, dia e horário, que ainda existe nesse instante)
-- herda quem lançou a consulta (vendedor ou Lucas). Sem consulta igual, fica vazio e vale quem criou o passeio.
create or replace function public._bloqueio_trazido_por()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.trazido_por is null then
    select coalesce(c.vendedor, c.criado_por) into new.trazido_por
      from public.consultas c
     where c.lancha = new.lancha and c.data = new.data and c.horario = new.horario
       and (c.vendedor is not null or c.criado_por is not null)
     order by c.criado_em desc limit 1;
  end if;
  return new;
end $function$;
create or replace trigger bloqueio_trazido_por before insert on public.bloqueios for each row execute function public._bloqueio_trazido_por();

-- 2) origem de um pedido, passeio (bloqueio) ou consulta: { tipo, nome }
--    tipo: vendedor | parceiro | lucas | dono | painel | site
--    Pedido que o cliente fez no site (antes de existir o passeio): vale o link de vendedor/parceiro ou a oferta;
--    sem nada disso, "site". Passeio lançado por alguém: vale quem lançou (Lucas, vendedor, dono ou painel).
create or replace function public.origem_reserva(p_pedido bigint default null, p_bloqueio bigint default null, p_consulta bigint default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  pd public.pedidos%rowtype; b public.bloqueios%rowtype; c public.consultas%rowtype; vend uuid; quem uuid; v_nome text; do_site boolean := false;
begin
  if p_consulta is not null then
    select * into c from public.consultas where id = p_consulta;
    if c.id is null then return null; end if;
    vend := c.vendedor; quem := c.criado_por;
    if vend is null and quem is null then return jsonb_build_object('tipo', 'site'); end if;
  else
    if p_pedido is not null then select * into pd from public.pedidos where id = p_pedido; end if;
    if pd.id is null and p_bloqueio is not null then select * into pd from public.pedidos where bloqueio_id = p_bloqueio order by id desc limit 1; end if;
    select * into b from public.bloqueios where id = coalesce(p_bloqueio, pd.bloqueio_id);
    if pd.id is null and b.id is null then return null; end if;
    -- o cliente pediu pelo site antes do passeio existir (o convite do painel cria o pedido junto com o passeio)
    do_site := pd.id is not null and (b.id is null or pd.criado_em < b.criado_em - interval '1 minute');
    vend := coalesce(pd.vendedor, (select vendedor from public.vendas_manuais where bloqueio_id = b.id));
    if pd.oferta is not null then
      select coalesce(o.vendedor, o.criado_por) into quem from public.ofertas o where o.id::text = pd.oferta::text;
    end if;
    if quem is null and not do_site then quem := coalesce(b.trazido_por, b.criado_por); end if;
  end if;
  -- o administrador também pode ter link de vendedor: aí vale como painel (o nome dele nunca aparece)
  if vend is not null and exists (select 1 from public.admins where user_id = vend) then quem := vend; vend := null; end if;
  if vend is null and quem is not null and not exists (select 1 from public.admins where user_id = quem)
     and exists (select 1 from public.vendedores where user_id = quem) then vend := quem; end if;
  if vend is not null then
    v_nome := coalesce(nullif(trim((select nome from public.perfis where user_id = vend)), ''), nullif(trim((select nome from public.clientes where user_id = vend)), ''), (select codigo from public.vendedores where user_id = vend));
    return jsonb_build_object('tipo', case when coalesce((select parceiro from public.vendedores where user_id = vend), false) then 'parceiro' else 'vendedor' end, 'nome', v_nome);
  end if;
  if quem is not null and exists (select 1 from public.papeis_painel where user_id = quem and papel = 'operador') then return jsonb_build_object('tipo', 'lucas'); end if;
  if quem is not null and exists (select 1 from public.admins where user_id = quem) then return jsonb_build_object('tipo', 'painel'); end if;
  if quem is not null and exists (select 1 from public.donos where user_id = quem) then
    v_nome := coalesce(nullif(trim((select nome from public.perfis where user_id = quem)), ''), nullif(trim((select nome from public.clientes where user_id = quem)), ''));
    return jsonb_build_object('tipo', 'dono', 'nome', v_nome);
  end if;
  if do_site or (pd.id is not null and quem = pd.cliente) then return jsonb_build_object('tipo', 'site'); end if;
  return null;
end $function$;
revoke all on function public.origem_reserva(bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.origem_reserva(bigint, bigint, bigint) to service_role;

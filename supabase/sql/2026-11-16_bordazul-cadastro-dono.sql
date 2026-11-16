-- publicar: auto
-- 2026-11-16: cadastro do dono no Bordazul (bordazul.com.br/anunciar), pedido pelo Rodrigo.
-- O dono confirma o WhatsApp com um código, preenche a lancha, manda documentos e fotos, escolhe o neto dentro da faixa
-- da cidade e assina o termo de parceria com outro código no WhatsApp. Depois disso o cadastro vai para análise.
-- Tudo passa pela função bordazul-anunciar (chave de serviço): as tabelas não têm política, ninguém lê direto pelo site.
-- O administrador vê e decide pelas funções bz_cadastros_admin / bz_cadastro_decidir.

create table if not exists public.bz_wa_codigos (
  tel text primary key,
  cod_hash text,
  expira_em timestamptz,
  tentativas int not null default 0,
  envios int not null default 0,
  dia date not null default current_date,
  ultimo_envio timestamptz
);
alter table public.bz_wa_codigos enable row level security;

create table if not exists public.bz_cadastros (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique,
  token_expira timestamptz,
  tel text not null,
  tel_ok_em timestamptz,
  dados jsonb not null default '{}'::jsonb,
  arquivos jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho',
  termo_versao text,
  termo_hash text,
  assinatura jsonb,
  analise jsonb,
  decisao jsonb,
  lancha text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint bz_cadastros_status_ck check (status in ('rascunho', 'em_analise', 'correcao', 'aprovado', 'recusado'))
);
alter table public.bz_cadastros enable row level security;
create index if not exists bz_cadastros_tel on public.bz_cadastros (tel);
create index if not exists bz_cadastros_status on public.bz_cadastros (status);

-- documentos e fotos do cadastro: pasta privada, só a função (link assinado) e o administrador abrem
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bz-cadastros', 'bz-cadastros', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

-- faixa do neto (passeio de 4h na baixa temporada) pelo tamanho: referência = média de R$ por pé das lanchas no ar,
-- de 30% abaixo a 60% acima (as lanchas maiores e mais equipadas cobram mais por pé)
create or replace function public.bz_faixa(p_pes numeric)
returns jsonb language sql stable security definer set search_path = public as $$
  with r as (
    select avg(p.neto::numeric / nullif((l.dados->>'pes')::numeric, 0)) as por_pe
    from lanchas l join precos_neto p on p.lancha = l.slug and p.chave = 'baixa'
    where l.ativa and not coalesce(l.oculta, false) and (l.dados->>'pes') ~ '^[0-9]+([.,][0-9]+)?$' and p.neto > 0
  )
  select jsonb_build_object(
    'ref', round(coalesce(por_pe, 60) * greatest(p_pes, 1) / 50) * 50,
    'min', round(coalesce(por_pe, 60) * greatest(p_pes, 1) * 0.7 / 50) * 50,
    'max', round(coalesce(por_pe, 60) * greatest(p_pes, 1) * 1.6 / 50) * 50)
  from r;
$$;
revoke all on function public.bz_faixa(numeric) from public, anon, authenticated;
grant execute on function public.bz_faixa(numeric) to service_role;

-- lista para o administrador (sem o token)
create or replace function public.bz_cadastros_admin(p_status text default null)
returns table (id uuid, tel text, status text, dados jsonb, arquivos jsonb, assinatura jsonb, analise jsonb, decisao jsonb, lancha text, criado_em timestamptz, atualizado_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from admins a where a.user_id = auth.uid()) then raise exception 'só o administrador'; end if;
  return query select c.id, c.tel, c.status, c.dados, c.arquivos, c.assinatura, c.analise, c.decisao, c.lancha, c.criado_em, c.atualizado_em
    from bz_cadastros c where c.status <> 'rascunho' and (p_status is null or c.status = p_status) order by c.atualizado_em desc limit 200;
end $$;
revoke all on function public.bz_cadastros_admin(text) from public, anon;
grant execute on function public.bz_cadastros_admin(text) to authenticated;

-- decisão do administrador: aprovar, pedir correção ou recusar (com o motivo, que o dono vê na página)
create or replace function public.bz_cadastro_decidir(p_id uuid, p_acao text, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c bz_cadastros;
begin
  if not exists (select 1 from admins a where a.user_id = auth.uid()) then raise exception 'só o administrador'; end if;
  if p_acao not in ('aprovado', 'correcao', 'recusado') then raise exception 'ação'; end if;
  select * into c from bz_cadastros where id = p_id for update;
  if c.id is null then raise exception 'cadastro'; end if;
  update bz_cadastros set status = p_acao, atualizado_em = now(),
    decisao = jsonb_build_object('acao', p_acao, 'motivo', left(coalesce(p_motivo, ''), 600), 'por', auth.uid(), 'em', now())
  where id = p_id;
  return jsonb_build_object('ok', true, 'status', p_acao);
end $$;
revoke all on function public.bz_cadastro_decidir(uuid, text, text) from public, anon;
grant execute on function public.bz_cadastro_decidir(uuid, text, text) to authenticated;

-- limite de códigos: 60 s entre envios, 5 por número por dia, 300 por dia no total. Reserva atômica.
create or replace function public.bz_wa_reservar(p_tel text)
returns boolean language plpgsql security definer set search_path = public as $$
declare w bz_wa_codigos; total int;
begin
  select coalesce(sum(envios), 0) into total from bz_wa_codigos where dia = current_date;
  if total >= 300 then return false; end if;
  insert into bz_wa_codigos (tel) values (p_tel) on conflict (tel) do nothing;
  select * into w from bz_wa_codigos where tel = p_tel for update;
  if w.dia <> current_date then update bz_wa_codigos set envios = 0, dia = current_date where tel = p_tel; w.envios := 0; end if;
  if w.ultimo_envio is not null and w.ultimo_envio > now() - interval '60 seconds' then return false; end if;
  if w.envios >= 5 then return false; end if;
  update bz_wa_codigos set envios = envios + 1, ultimo_envio = now() where tel = p_tel;
  return true;
end $$;
revoke all on function public.bz_wa_reservar(text) from public, anon, authenticated;
grant execute on function public.bz_wa_reservar(text) to service_role;

-- conta a tentativa antes de conferir o código (no máximo 5 por código), de forma atômica
create or replace function public.bz_wa_tentativa(p_tel text)
returns table (cod_hash text, expira_em timestamptz) language sql security definer set search_path = public as $$
  update bz_wa_codigos w set tentativas = w.tentativas + 1 where w.tel = p_tel and w.tentativas < 5 returning w.cod_hash, w.expira_em;
$$;
revoke all on function public.bz_wa_tentativa(text) from public, anon, authenticated;
grant execute on function public.bz_wa_tentativa(text) to service_role;

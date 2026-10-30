-- Papéis do painel /login/ além do administrador (Rodrigo 2026-10-30)
--   operador: vê reservas/passeios, pedidos, consultas, cadastros pela metade e o "WhatsApp pendente"; só grava o registro de envio do WhatsApp (marcar_wa).
--   auditor:  vê o que o administrador vê; não grava nada (nem marcar_wa).
--
-- Como a segurança funciona: esses papéis NÃO entram na tabela admins, então e_admin() continua falso para eles.
-- Toda função e política que grava já exige e_admin() (ou ser dono/cliente/vendedor), por isso recusa os dois papéis sem precisar mexer nelas.
-- Este arquivo só ACRESCENTA leitura (políticas de SELECT e funções de leitura STABLE) e o marcar_wa para o operador.
--
-- Antes de rodar: convide as duas contas no Supabase (Authentication > Users > Invite user):
--   amigo-buzios@mail.grokbot.com            -> operador
--   amigo-buzios+analista@mail.grokbot.com   -> auditor
-- Depois rode este arquivo inteiro no SQL Editor. Pode rodar de novo sem problema.

-- 1) quem tem qual papel (só as funções leem; ninguém grava pelo app)
create table if not exists public.papeis_painel (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('operador','auditor')),
  criado_em timestamptz not null default now()
);
alter table public.papeis_painel enable row level security;
revoke all on public.papeis_painel from anon, authenticated;

insert into public.papeis_painel (user_id, papel)
  select id, 'operador' from auth.users where lower(email) = 'amigo-buzios@mail.grokbot.com'
  on conflict (user_id) do update set papel = excluded.papel;
insert into public.papeis_painel (user_id, papel)
  select id, 'auditor' from auth.users where lower(email) = 'amigo-buzios+analista@mail.grokbot.com'
  on conflict (user_id) do update set papel = excluded.papel;
-- papel de painel nunca é administrador
delete from public.admins where user_id in (select user_id from public.papeis_painel);

-- 2) funções de checagem
create or replace function public.papel_painel()
returns text language sql stable security definer set search_path to 'public' as $$
  select papel from public.papeis_painel where user_id = auth.uid();
$$;
-- leitura de tudo o que o administrador vê: administrador ou auditor
create or replace function public.painel_le()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.e_admin() or coalesce(public.papel_painel() = 'auditor', false);
$$;
-- leitura da parte de atendimento: administrador, auditor ou operador
create or replace function public.painel_le_atend()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.e_admin() or coalesce(public.papel_painel() in ('auditor','operador'), false);
$$;
revoke all on function public.papel_painel() from public, anon;
revoke all on function public.painel_le() from public, anon;
revoke all on function public.painel_le_atend() from public, anon;
grant execute on function public.papel_painel() to authenticated;
grant execute on function public.painel_le() to authenticated;
grant execute on function public.painel_le_atend() to authenticated;

-- 3) leitura das tabelas (só SELECT; as colunas continuam limitadas pelos mesmos grants de coluna do administrador)
do $$
declare t text;
begin
  -- atendimento: operador e auditor
  foreach t in array array['pedidos','consultas','vendedor_leads','clientes','anotacoes','realizados','perfis','vendedores','marinheiros','freelancers'] loop
    execute format('drop policy if exists painel_le on public.%I', t);
    execute format('create policy painel_le on public.%I for select to authenticated using (public.painel_le_atend())', t);
  end loop;
  -- resto do que o administrador lê: só auditor
  foreach t in array array['cupom_dono','passeio_preco_base','asaas_contas','convites','avaliacoes','pagamentos_asaas','avaliacoes_excluidas',
                           'donos','precos_hist','pix_donos','ofertas','pagamentos_pp','precos_neto','cupons','saques','visualizadores','fotos_pendentes'] loop
    execute format('drop policy if exists painel_le on public.%I', t);
    execute format('create policy painel_le on public.%I for select to authenticated using (public.painel_le())', t);
  end loop;
end $$;

-- 4) funções de leitura do administrador passam a aceitar o auditor
-- Só funções STABLE (o Postgres não deixa função STABLE gravar nada). Troca e_admin() por painel_le() no texto da função.
-- cliente_do_passeio também filtrava por pode_editar(lancha); ali o auditor entra junto.
-- Não mexe em pode_editar, participa, pode_anexar nem nas funções do chat (elas também valem para gravar).
do $$
declare f text; def text;
begin
  foreach f in array array['avaliacoes_marinheiro','cliente_do_passeio','clientes_do_vendedor','ficha_cliente','lista_clientes_v2','lista_donos',
                           'lista_freelancers_v2','lista_usuarios','marinheiros_ocupados','notas_marinheiros','pedidos_vendedor_lista','perfil_marinheiro',
                           'usuarios_bloqueados_lista','usuarios_verificados','vendas_manuais_lista','vendedor_do_cliente','verif_usuario','verif_vendedores',
                           'vinculo_cliente_v2'] loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f and p.provolatile = 's';
    if def is null then raise notice 'pulei % (não existe ou não é STABLE)', f; continue; end if;
    def := replace(def, 'public.e_admin()', 'public.painel_le()');
    def := replace(def, 'public.pode_editar(b.lancha)', '(public.pode_editar(b.lancha) or public.painel_le())');
    execute def;
  end loop;
end $$;

-- 5) marcar_wa: o operador pode registrar os envios; o auditor não
create or replace function public.marcar_wa(tipo text, rid bigint)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare agora timestamptz := now(); lch text; atend boolean := public.e_admin() or coalesce(public.papel_painel() = 'operador', false);
begin
  if tipo in ('pix','central','aprovado_cliente','aprovado_dono','consulta','lead') then
    if not atend then raise exception 'Sem acesso'; end if;
    if tipo = 'pix' then update public.pedidos set wa_pix_em = agora where id = rid;
    elsif tipo = 'central' then update public.pedidos set wa_central_em = agora where id = rid;
    elsif tipo = 'aprovado_cliente' then update public.pedidos set wa_aprovado_cliente_em = agora where id = rid;
    elsif tipo = 'aprovado_dono' then update public.pedidos set wa_aprovado_dono_em = agora where id = rid;
    elsif tipo = 'consulta' then update public.consultas set wa_resposta_em = agora where id = rid;
    else update public.vendedor_leads set wa_lead_em = agora where id = rid;
    end if;
  elsif tipo in ('condicional','cond_inicio') then
    if not atend then raise exception 'Sem acesso'; end if;
    if tipo = 'condicional' then update public.anotacoes set wa_cond_em = agora where bloqueio_id = rid;
    else update public.anotacoes set wa_cond_ini_em = agora where bloqueio_id = rid;
    end if;
  elsif tipo = 'alteracao' then
    -- aviso de reserva alterada (rid = id da alteração)
    if not atend then raise exception 'Sem acesso'; end if;
    update public.alteracoes_pedidas set wa_em = agora where id = rid;
  elsif tipo in ('cobranca','convite','aviso','embarque') then
    -- avisos do passeio: administrador, operador ou dono da lancha
    select lancha into lch from public.bloqueios where id = rid;
    if lch is null then raise exception 'Passeio não encontrado'; end if;
    if not atend and not exists (select 1 from public.donos d where d.lancha = lch and d.user_id = auth.uid()) then
      raise exception 'Sem acesso';
    end if;
    if tipo = 'cobranca' then update public.anotacoes set wa_cobranca_em = agora where bloqueio_id = rid;
    elsif tipo = 'convite' then update public.anotacoes set wa_convite_em = agora where bloqueio_id = rid;
    elsif tipo = 'aviso' then update public.anotacoes set wa_aviso_em = agora where bloqueio_id = rid;
    else update public.anotacoes set wa_embarque_em = agora where bloqueio_id = rid;
    end if;
  else
    raise exception 'Tipo inválido';
  end if;
  return agora;
end $$;
revoke all on function public.marcar_wa(text, bigint) from public, anon;
grant execute on function public.marcar_wa(text, bigint) to authenticated;

-- conferência: as duas contas com o papel certo (se aparecer 0 linhas, falta o convite)
select u.email, p.papel, exists (select 1 from public.admins a where a.user_id = u.id) as e_admin
  from public.papeis_painel p join auth.users u on u.id = p.user_id;

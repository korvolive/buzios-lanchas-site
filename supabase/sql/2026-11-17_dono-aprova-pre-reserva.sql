-- publicar: auto
-- Dono aprova a pré-reserva pelo WhatsApp (Rodrigo 2026-11-17).
-- Embarcação sem "Reserva automática": quando a equipe lança o pedido, o dono recebe no WhatsApp oficial um aviso com botão
-- que abre /aprovar/?t=<token> (sem login). Lá ele aprova (o cliente segue para o pagamento, igual à aprovação do administrador)
-- ou diz que não está disponível (o cliente é avisado e recebe as opções livres no mesmo horário).
-- O administrador continua aprovando pelo app; quem responder primeiro resolve. Idempotente.
-- Tudo aqui só roda pelo servidor (função dono-aprovacao, chave service_role); o token é a única coisa que a página conhece.

create table if not exists public.aprovacoes_dono (
  id bigserial primary key,
  token uuid not null unique default gen_random_uuid(),
  consulta_id bigint not null,
  dono uuid not null,
  lancha text not null,
  data date not null,
  horario text not null,
  tel_fim text,                      -- últimos 8 dígitos do cliente, para saber depois se a reserva aprovada é a dele
  enviado_em timestamptz,
  envio text,                        -- 'enviado' | 'falhou' | 'sem_modelo'
  resposta text check (resposta in ('aprovou', 'recusou')),
  respondido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (consulta_id, dono)
);
alter table public.aprovacoes_dono enable row level security;
revoke all on public.aprovacoes_dono from anon, authenticated;
grant select on public.aprovacoes_dono to authenticated;
drop policy if exists "aprovacoes_dono: admin le" on public.aprovacoes_dono;
create policy "aprovacoes_dono: admin le" on public.aprovacoes_dono for select to authenticated using (public.e_admin());
grant all on public.aprovacoes_dono to service_role;
grant usage, select on sequence public.aprovacoes_dono_id_seq to service_role;

alter table public.consultas add column if not exists recusa_dono boolean;
alter table public.resgate_config add column if not exists dono_aprov_ativo boolean not null default true;
alter table public.resgate_config add column if not exists dono_modelo_em timestamptz;
alter table public.resgate_config add column if not exists indisp_modelo_em timestamptz;

-- embarcações livres no mesmo dia e horário, do mesmo tipo e cidade, que cabem o grupo; a Miss Bardot primeiro, depois as de preço mais perto
create or replace function public.alternativas_livres(p_lancha text, p_data date, p_horario text, p_pessoas int, p_hi text default null, p_hf text default null, p_max int default 2)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.lanchas%rowtype; s record; base numeric; pr numeric; out jsonb := '[]'::jsonb; lista jsonb := '[]'::jsonb;
begin
  select * into o from public.lanchas where slug = p_lancha;
  begin base := public.preco_tabela(p_lancha, p_data, p_horario); exception when others then base := null; end;
  for s in select l.* from public.lanchas l
            where l.slug <> p_lancha and coalesce(l.ativa, true) and not coalesce(l.oculta, false) and not public.e_exemplo(l.slug)
              and coalesce(l.dados->>'cidade', 'buzios') = coalesce(o.dados->>'cidade', 'buzios')
              and coalesce(l.dados->>'tipo', 'lancha') = coalesce(o.dados->>'tipo', 'lancha')
              and public._capacidade(l.slug) >= coalesce(p_pessoas, 1)
              and not exists (select 1 from public.bloqueios x where x.lancha = l.slug and x.data = p_data and public.choca_horario(x.horario, p_horario))
              and not exists (select 1 from public.manutencoes m where m.lancha = l.slug and m.de <= p_data and p_data <= m.ate)
  loop
    begin pr := public.preco_tabela(s.slug, p_data, p_horario); exception when others then pr := null; end;
    if not (pr > 0) then continue; end if;
    if p_hi is not null and public._choca_horas_reais(s.slug, p_data, p_hi, p_hf) then continue; end if;
    lista := lista || jsonb_build_object('slug', s.slug, 'nome', s.nome, 'cap', public._capacidade(s.slug), 'preco', pr,
      'ord', case when s.slug = 'miss-bardot' then -1 else abs(pr - coalesce(base, pr)) end);
  end loop;
  select coalesce(jsonb_agg(x - 'ord' order by (x->>'ord')::numeric), '[]'::jsonb) into out
    from (select x from jsonb_array_elements(lista) x order by (x->>'ord')::numeric limit greatest(coalesce(p_max, 2), 1)) t;
  return out;
end $$;

-- situação do pedido para a página do dono
create or replace function public.dono_aprovacao_ver(tok uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.aprovacoes_dono%rowtype; c public.consultas%rowtype; hoje date := (now() at time zone 'America/Sao_Paulo')::date; est text; nm text; neto numeric;
begin
  select * into a from public.aprovacoes_dono where token = tok;
  if a.id is null then return jsonb_build_object('estado', 'invalido'); end if;
  select nome into nm from public.lanchas where slug = a.lancha;
  select * into c from public.consultas where id = a.consulta_id;
  if c.id is null then
    -- a consulta some quando é aprovada: a reserva desse cliente no mesmo dia e horário mostra que foi aprovada
    est := case when exists (select 1 from public.bloqueios b join public.anotacoes n on n.bloqueio_id = b.id
                              where b.lancha = a.lancha and b.data = a.data and public.choca_horario(b.horario, a.horario)
                                and right(regexp_replace(coalesce(n.telefone, ''), '\D', '', 'g'), 8) = a.tel_fim)
                then 'aprovada' else 'resolvida' end;
  elsif c.recusada_em is not null then est := 'recusada';
  elsif c.data < hoje then est := 'vencida';
  else est := 'pendente';
  end if;
  if c.id is not null then
    neto := c.neto_garantido;
    if neto is null then begin neto := public.preco_neto_tabela(c.lancha, c.data, c.horario); exception when others then neto := null; end; end if;
  end if;
  return jsonb_build_object('estado', est, 'resposta', a.resposta, 'lancha', coalesce(nm, a.lancha), 'data', a.data, 'horario', a.horario,
    'hora_ini', c.hora_ini, 'hora_fim', c.hora_fim, 'pessoas', c.pessoas, 'cliente', nullif(split_part(coalesce(c.nome, ''), ' ', 1), ''), 'neto', neto);
end $$;

-- o dono aprovou: mesma aprovação do administrador (o servidor confere data livre, manutenção, capacidade e valor)
create or replace function public.dono_aprovar(tok uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.aprovacoes_dono%rowtype; c public.consultas%rowtype; r jsonb;
begin
  select * into a from public.aprovacoes_dono where token = tok for update;
  if a.id is null then return jsonb_build_object('estado', 'invalido'); end if;
  if not exists (select 1 from public.donos d where d.user_id = a.dono and d.lancha = a.lancha) then return jsonb_build_object('estado', 'invalido'); end if;
  select * into c from public.consultas where id = a.consulta_id for update;
  if c.id is null or c.recusada_em is not null or c.data < (now() at time zone 'America/Sao_Paulo')::date then
    return public.dono_aprovacao_ver(tok);
  end if;
  begin
    perform set_config('app.auto_op', '1', true);
    r := public._aprovar_consulta(c.id, false);
    perform set_config('app.auto_op', '', true);
  exception when others then
    return jsonb_build_object('estado', 'erro', 'msg', sqlerrm);
  end;
  -- igual à reserva automática: a pré-reserva fica no nome de quem lançou (Lucas ou vendedor)
  update public.bloqueios set criado_por = c.criado_por where id = (r->>'bid')::bigint and criado_por is null;
  update public.aprovacoes_dono set resposta = 'aprovou', respondido_em = now() where id = a.id;
  return r || jsonb_build_object('estado', 'aprovou', 'consulta', c.id, 'lancha', c.lancha, 'data', c.data, 'horario', c.horario,
    'cliente', c.nome, 'criado_por', c.criado_por, 'vendedor', c.vendedor);
end $$;

-- o dono disse que não está disponível: a consulta vai para Recusadas (o administrador ainda pode resgatar) e volta tudo o que o
-- servidor precisa para avisar o cliente com as opções livres
create or replace function public.dono_recusar(tok uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.aprovacoes_dono%rowtype; c public.consultas%rowtype;
begin
  select * into a from public.aprovacoes_dono where token = tok for update;
  if a.id is null then return jsonb_build_object('estado', 'invalido'); end if;
  if not exists (select 1 from public.donos d where d.user_id = a.dono and d.lancha = a.lancha) then return jsonb_build_object('estado', 'invalido'); end if;
  select * into c from public.consultas where id = a.consulta_id for update;
  if c.id is null or c.recusada_em is not null or c.data < (now() at time zone 'America/Sao_Paulo')::date then
    return public.dono_aprovacao_ver(tok);
  end if;
  update public.consultas set recusada_em = now(), recusa_auto = false, recusa_dono = true where id = c.id;
  update public.aprovacoes_dono set resposta = 'recusou', respondido_em = now() where id = a.id;
  return jsonb_build_object('estado', 'recusou', 'consulta', c.id, 'lancha', c.lancha, 'data', c.data, 'horario', c.horario,
    'hora_ini', c.hora_ini, 'hora_fim', c.hora_fim, 'pessoas', c.pessoas, 'nome', c.nome, 'telefone', c.telefone, 'lang', c.lang,
    'pais', c.pais, 'vendedor', c.vendedor, 'criado_por', c.criado_por,
    'opcoes', public.alternativas_livres(c.lancha, c.data, c.horario, c.pessoas, c.hora_ini, c.hora_fim, 2));
end $$;

revoke all on function public.alternativas_livres(text, date, text, int, text, text, int) from public, anon, authenticated;
revoke all on function public.dono_aprovacao_ver(uuid) from public, anon, authenticated;
revoke all on function public.dono_aprovar(uuid) from public, anon, authenticated;
revoke all on function public.dono_recusar(uuid) from public, anon, authenticated;
grant execute on function public.alternativas_livres(text, date, text, int, text, text, int) to service_role;
grant execute on function public.dono_aprovacao_ver(uuid) to service_role;
grant execute on function public.dono_aprovar(uuid) to service_role;
grant execute on function public.dono_recusar(uuid) to service_role;

-- a cada minuto, junto com o aviso-aprovacao: manda o aviso ao dono das pré-reservas novas
do $$
declare k text;
begin
  select chave into k from public.resgate_config where id = 1;
  if k is null then return; end if;
  if exists (select 1 from cron.job where jobname = 'dono-aprovacao') then perform cron.unschedule('dono-aprovacao'); end if;
  perform cron.schedule('dono-aprovacao', '* * * * *', format(
    $c$select net.http_post(url := 'https://sqoperylsqcbcjpcrlnp.supabase.co/functions/v1/dono-aprovacao', headers := jsonb_build_object('content-type', 'application/json', 'x-chave', %L), body := '{}'::jsonb, timeout_milliseconds := 20000)$c$, k));
end $$;

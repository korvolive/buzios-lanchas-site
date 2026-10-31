-- Desconto para grupo pequeno (Rodrigo 2026-10-31, só a Miss Bardot por enquanto)
-- O Rodrigo cria períodos (de/até) com "até N pessoas" (padrão 8, metade da lancha) e um desconto máximo em %.
-- Dentro do período, com o grupo até N pessoas, o mínimo que o Lucas pode lançar vira a tabela menos esse %,
-- passando por cima das outras regras da data (feriado, Réveillon, segunda a quinta). O preço do site não muda.
-- O pedido lançado com esse desconto é aceito pelo servidor e o Rodrigo aprova normalmente.

create table if not exists public.descontos_grupo (
  id bigserial primary key,
  lancha text not null references public.lanchas(slug) on delete cascade,
  de date not null,
  ate date not null,
  max_pessoas integer not null default 8 check (max_pessoas between 1 and 50),
  pct numeric not null check (pct > 0 and pct <= 50),
  criado_em timestamptz not null default now(),
  check (ate >= de)
);
alter table public.descontos_grupo enable row level security;
drop policy if exists descontos_grupo_admin on public.descontos_grupo;
create policy descontos_grupo_admin on public.descontos_grupo for all to authenticated using (public.e_admin()) with check (public.e_admin());
drop policy if exists descontos_grupo_painel on public.descontos_grupo;
create policy descontos_grupo_painel on public.descontos_grupo for select to authenticated using (public.papel_painel() is not null);
grant select, insert, update, delete on public.descontos_grupo to authenticated;
grant usage, select on sequence public.descontos_grupo_id_seq to authenticated;

-- mínimo do grupo pequeno para essa lancha, data e número de pessoas (null = não vale)
create or replace function public._piso_grupo(l text, d date, h text, pes integer)
returns numeric language plpgsql stable security definer set search_path to 'public' as $$
declare tab numeric := public.preco_tabela(l, d, h); p numeric;
begin
  if tab is null or pes is null then return null; end if;
  select max(g.pct) into p from public.descontos_grupo g where g.lancha = l and g.de <= d and d <= g.ate and pes <= g.max_pessoas;
  if p is null then return null; end if;
  return ceil(tab * (1 - p / 100));
end $$;
revoke all on function public._piso_grupo(text, date, text, integer) from public, anon, authenticated;

-- para o painel mostrar ao Lucas até onde ele pode descer com grupo pequeno
create or replace function public.piso_grupo(l text, d date, h text, pes integer)
returns numeric language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.e_admin() or public.papel_painel() = 'operador') then return null; end if;
  return public._piso_grupo(l, d, h, pes);
end $$;
revoke all on function public.piso_grupo(text, date, text, integer) from public, anon;
grant execute on function public.piso_grupo(text, date, text, integer) to authenticated;

-- conferência do valor do operador com o número de pessoas: o grupo pequeno passa por cima do mínimo normal
create or replace function public._confere_valor_op(l text, d date, h text, v numeric, pes integer)
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare tab numeric; g numeric;
begin
  g := public._piso_grupo(l, d, h, pes);
  if public.e_admin() or g is null or v is null then return public._confere_valor_op(l, d, h, v); end if;
  tab := public.preco_tabela(l, d, h);
  if not (v > 0) then raise exception 'Valor inválido'; end if;
  if v > tab then raise exception 'O valor (R$ %) passa da tabela (R$ %)', v, tab; end if;
  if v < least(g, coalesce(public._piso_operador(l, d, h), g)) then
    raise exception 'O valor (R$ %) fica abaixo do mínimo para grupo pequeno nessa data (R$ %). Fale com o Rodrigo', v, least(g, coalesce(public._piso_operador(l, d, h), g)); end if;
  return v;
end $$;
revoke all on function public._confere_valor_op(text, date, text, numeric, integer) from public, anon, authenticated;

create or replace function public.lancar_pedido_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer,
  p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null,
  p_valor numeric default null, p_sinal numeric default null, p_hora_ini text default null, p_hora_fim text default null, p_obs text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare nid bigint; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g'); v numeric; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'Escreva nome e sobrenome do cliente'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'WhatsApp do cliente inválido'; end if;
  if coalesce(p_email,'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'E-mail do cliente inválido'; end if;
  if p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario,''), p_data) then raise exception 'Horário inválido'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > public._capacidade(p_lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(p_lancha); end if;
  if length(coalesce(p_embarque,'')) > 120 or length(coalesce(p_obs,'')) > 300 then raise exception 'Texto longo demais'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim) and p_hora_fim > p_hora_ini)) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  v := public._confere_valor_op(p_lancha, p_data, p_horario, p_valor, p_pessoas);  -- grupo pequeno da Miss Bardot pode descer mais
  if p_sinal is not null and (p_sinal < 0 or (v is not null and p_sinal > v) or (p_sinal > 0 and v is not null and p_sinal < ceil(v * 0.1))) then
    raise exception 'Sinal inválido: zero (pré-reserva) ou de 10%% até o valor'; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 60 then raise exception 'Limite de pedidos do dia'; end if;
  -- mesmo cliente, lancha e dia: só atualiza a consulta que o próprio operador lançou; a do site fica como está
  update public.consultas set horario = p_horario, pessoas = p_pessoas, embarque = nullif(trim(coalesce(p_embarque,'')),''), nome = trim(p_nome),
         email = lower(trim(p_email)), chamou = true, wa_resposta_em = coalesce(wa_resposta_em, now()),
         valor = v, sinal = p_sinal, hora_ini = p_hora_ini, hora_fim = p_hora_fim, obs = nullif(trim(coalesce(p_obs,'')),'')
   where criado_por is not null and (criado_por = auth.uid() or public.e_admin()) and recusada_em is null and regexp_replace(telefone,'\D','','g') = dig and lancha = p_lancha and data = p_data returning id into nid;
  if nid is not null then return nid; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang, valor, sinal, hora_ini, hora_fim, obs)
    values (true, now(), auth.uid(), p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            lower(trim(p_email)), case when p_lang in ('pt','en','es') then p_lang else 'pt' end, v, p_sinal, p_hora_ini, p_hora_fim, nullif(trim(coalesce(p_obs,'')),''))
    returning id into nid;
  return nid;
end $$;

select (select count(*) from pg_tables where tablename = 'descontos_grupo') as tabela,
       (select count(*) from pg_proc where proname = 'piso_grupo') as piso,
       (select position('p_pessoas);' in prosrc) > 0 from pg_proc where proname = 'lancar_pedido_operador') as lancar;

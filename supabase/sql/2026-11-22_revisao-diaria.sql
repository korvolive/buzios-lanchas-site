-- publicar: auto
-- Revisão diária 22/11/2026. Idempotente.
-- 1) O painel salva o passeio com POST + merge-duplicates (INSERT ... ON CONFLICT DO UPDATE). No Postgres o gatilho
--    BEFORE INSERT roda também nesse caso, antes de achar o conflito, e o valor que ele muda vai para o UPDATE.
--    Por isso o marinheiro fixo voltava quando o dono tirava o marinheiro (ou depois de o fixo recusar) e o embarque
--    da Miss Bardot era trocado em silêncio a cada edição. Agora os dois gatilhos só agem quando o passeio é novo.
-- 2) salvar_pix: no máximo 5 trocas de chave por dia (Brasília) por pessoa. Cada troca manda um WhatsApp pago.
-- 3) salvar_lancha: "Editar informações" não apaga mais dados.confirma_dono (o formulário não tem esse campo).
-- 4) _tel_padrao / tg_tel_padrao com search_path fixo (aviso do Supabase).

create or replace function public.tg_marinheiro_fixo_padrao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare bl record; fixo uuid; n int;
begin
  if new.marinheiro is not null or new.bloqueio_id is null then return new; end if;
  -- edição de passeio que já existe (upsert do painel): fica como o dono deixou
  if exists (select 1 from public.anotacoes x where x.bloqueio_id = new.bloqueio_id) then return new; end if;
  select * into bl from public.bloqueios where id = new.bloqueio_id;
  if bl.id is null then return new; end if;
  select count(*), min(m.user_id::text)::uuid into n, fixo
    from public.marinheiros m where m.lancha = bl.lancha and m.fixo and m.user_id is not null;
  if n <> 1 then return new; end if;
  -- já está em outra lancha nesse horário: não marca (sem erro)
  if exists (select 1 from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
              where a.marinheiro = fixo and b.id <> bl.id and b.data = bl.data
                and public.choca_horario(b.horario, bl.horario)) then
    return new;
  end if;
  new.marinheiro := fixo;
  return new;
end $$;

create or replace function public.tg_embarque_periodo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare lch text; hr text;
begin
  if tg_table_name = 'anotacoes' then
    -- edição de passeio que já existe (upsert do painel): o local escolhido fica
    if exists (select 1 from public.anotacoes x where x.bloqueio_id = new.bloqueio_id) then return new; end if;
    select b.lancha, b.horario into lch, hr from public.bloqueios b where b.id = new.bloqueio_id;
  else
    if tg_table_name = 'pedidos' then
      if new.bloqueio_id is not null then return new; end if;
    end if;
    lch := new.lancha; hr := new.horario;
  end if;
  if lch is null then return new; end if;
  if hr in ('manha', 'tarde') then
    new.embarque := coalesce(public._embarque_periodo(lch, hr, new.embarque), new.embarque);
  end if;
  if nullif(btrim(coalesce(new.embarque, '')), '') is null then
    new.embarque := public._embarque_padrao(lch, hr);
  end if;
  return new;
end $$;

create or replace function public.salvar_pix(tipo text, chave text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare vend boolean := exists (select 1 from vendedores where user_id = auth.uid());
        dono boolean := exists (select 1 from donos where user_id = auth.uid());
        antes text;
begin
  if not vend and not dono then raise exception 'Só vendedores e donos'; end if;
  if not (
    (tipo = 'cpf' and chave ~ '^[0-9]{11}$') or
    (tipo = 'cnpj' and chave ~ '^[0-9]{14}$') or
    (tipo = 'email' and chave ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(chave) <= 77) or
    (tipo = 'telefone' and chave ~ '^\+55[0-9]{10,11}$') or
    (tipo = 'aleatoria' and chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then raise exception 'pix_invalida' using errcode = 'P0001'; end if;
  antes := coalesce((select pix_chave from vendedores where user_id = auth.uid() and pix_chave <> ''),
                    (select pix_chave from pix_donos where user_id = auth.uid() and pix_chave <> ''));
  if antes is not null and antes is distinct from chave then
    perform pg_advisory_xact_lock(hashtext('salvar_pix:' || auth.uid()::text));
    if (select count(*) from public.avisos_seguranca s
         where s.tipo = 'pix' and s.user_id = auth.uid()
           and s.criado_em >= ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo') >= 5 then
      raise exception 'pix_limite' using errcode = 'P0001';
    end if;
  end if;
  if vend then update vendedores set pix_tipo = tipo, pix_chave = chave where user_id = auth.uid(); end if;
  if dono then
    insert into pix_donos (user_id, pix_tipo, pix_chave) values (auth.uid(), tipo, chave)
    on conflict (user_id) do update set pix_tipo = excluded.pix_tipo, pix_chave = excluded.pix_chave, atualizado_em = now();
  end if;
  if antes is not null and antes is distinct from chave then
    insert into public.avisos_seguranca (tipo, user_id, chave, chave_tipo, chave_anterior) values ('pix', auth.uid(), chave, tipo, antes);
    perform public.aviso_seguranca_chamar();
  end if;
end $$;

create or replace function public.salvar_lancha(l text, nome text, d jsonb, ativa boolean default true)
returns text language plpgsql security definer set search_path to 'public' as $$
declare cap int := (d->>'capacidade')::int; pes numeric := (d->>'pes')::numeric; tipo text := coalesce(nullif(d->>'tipo',''),'lancha');
begin
  if not e_admin() then raise exception 'so_admin'; end if;
  if l !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(l) > 40 then raise exception 'slug_invalido'; end if;
  if length(trim(coalesce(nome,''))) < 2 then raise exception 'nome_invalido'; end if;
  if tipo not in ('lancha','escuna') then raise exception 'tipo_invalido'; end if;
  if cap is null or cap < 1 or cap > (case when tipo='escuna' then 200 else 80 end) then raise exception 'capacidade_invalida'; end if;
  if pes is null or pes < 10 or pes > 200 or pes * 2 <> trunc(pes * 2) then raise exception 'pes_invalido'; end if;  -- inteiro ou meio pé
  if exists (select 1 from lanchas x where x.slug = l and x.dados is null) then raise exception 'lancha_do_codigo'; end if;
  insert into lanchas (slug, nome, dados, ativa, oculta, atualizado_em) values (l, trim(nome), d, coalesce(ativa, true), true, now())
    on conflict (slug) do update set nome = excluded.nome,
      -- confirma_dono não está no formulário: mantém o que já estava
      dados = case when excluded.dados ? 'confirma_dono' or not (lanchas.dados ? 'confirma_dono') then excluded.dados
                   else excluded.dados || jsonb_build_object('confirma_dono', lanchas.dados->'confirma_dono') end,
      ativa = excluded.ativa, atualizado_em = now();
  return l;
end $$;

alter function public._tel_padrao(text) set search_path = public;
alter function public.tg_tel_padrao() set search_path = public;

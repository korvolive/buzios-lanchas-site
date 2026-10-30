-- Búzios Lanchas (Rodrigo 2026-10-30): comprovante que o cliente mandou no WhatsApp, anexado no passeio pelo administrador ou pelo Lucas (operador).
-- Vale para pré-reserva (passeio da Búzios Lanchas com sinal zero). Com o comprovante anexado, a pré-reserva não vence sozinha:
-- a data fica segura até o administrador conferir o Pix e preencher o sinal (ou apagar o passeio).

alter table public.anotacoes
  add column if not exists comprovante text,
  add column if not exists comprovante_em timestamptz,
  add column if not exists comprovante_por uuid;

create or replace function public.anexar_comprovante_passeio(p_bid bigint, p_caminho text)
returns text language plpgsql security definer set search_path = public as $$
declare a record; b record;
begin
  if not (public.e_admin() or public.papel_painel() = 'operador') then raise exception 'sem acesso'; end if;
  if p_caminho is null or p_caminho !~ ('^passeio/' || p_bid || '-[0-9]+\.(jpg|png|webp|heic|heif|gif|pdf)$') then raise exception 'arquivo inválido'; end if;
  select * into b from public.bloqueios where id = p_bid;
  if not found then raise exception 'passeio não encontrado'; end if;
  select * into a from public.anotacoes where bloqueio_id = p_bid;
  if not found or a.origem is distinct from 'buzios' then raise exception 'só passeio da Búzios Lanchas'; end if;
  if b.data < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'passeio já passou'; end if;
  update public.anotacoes set comprovante = p_caminho, comprovante_em = now(), comprovante_por = auth.uid() where bloqueio_id = p_bid;
  -- cliente que já tem conta: o pedido da pré-reserva também fica com o comprovante (vencer_pre_pedidos já pula quem tem comprovante)
  update public.pedidos set comprovante = p_caminho, comprovante_em = now(), atualizado_em = now() where bloqueio_id = p_bid and status = 'pendente';
  return 'ok';
end $$;
revoke all on function public.anexar_comprovante_passeio(bigint, text) from public, anon;
grant execute on function public.anexar_comprovante_passeio(bigint, text) to authenticated;

-- o servidor (prazo da pré-reserva) não apaga passeio com comprovante anexado e sinal ainda zero; o administrador continua podendo apagar.
-- o nome começa com "a_" para rodar antes dos outros gatilhos de apagar (cancela_pedido_do_passeio, pre_reserva_volta).
create or replace function public._comprovante_segura()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null and old.data >= (now() at time zone 'America/Sao_Paulo')::date
     and exists (select 1 from public.anotacoes a where a.bloqueio_id = old.id and a.comprovante_em is not null and coalesce(a.sinal, 0) = 0) then
    return null;
  end if;
  return old;
end $$;
drop trigger if exists a_comprovante_segura on public.bloqueios;
create trigger a_comprovante_segura before delete on public.bloqueios for each row execute function public._comprovante_segura();

-- arquivos: comprovantes/passeio/<passeio>-<hora>.<ext>; o operador envia e vê só essa pasta (o administrador já envia e vê tudo)
drop policy if exists "comprovantes: operador envia passeio" on storage.objects;
create policy "comprovantes: operador envia passeio" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = 'passeio' and public.papel_painel() = 'operador');
drop policy if exists "comprovantes: operador ve passeio" on storage.objects;
create policy "comprovantes: operador ve passeio" on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = 'passeio' and public.papel_painel() = 'operador');

-- conferência: deve voltar 3 | true | true | 2
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'anotacoes' and column_name like 'comprovante%') as colunas,
       exists (select 1 from pg_proc where proname = 'anexar_comprovante_passeio') as funcao,
       exists (select 1 from pg_trigger where tgname = 'a_comprovante_segura') as gatilho,
       (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'comprovantes: operador%') as regras;

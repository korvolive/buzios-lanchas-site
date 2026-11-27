-- publicar: auto
-- 2026-11-27: VPS grava 1 linha por dia em saude_checagens (origem 'vps-atualizacao'), às 22:00 BRT,
-- com o resultado de /root/buzios/warp/checar-atualizacao.sh (atualização automática do Ubuntu, túnel WARP, Gemini do OpenBot).
-- Motivo: em 27/11 a atualização automática das 06:50 reiniciou o pm2, travou o túnel e derrubou o Gemini por 14 min.
-- Reusa a chave que a VPS já tem (mesmo hash do gravar_gasto_google). Sem chave nova; o arquivo só tem o hash. Idempotente.
create or replace function public.gravar_saude_vps(p_chave text, p_ok boolean, p_itens jsonb)
returns text language plpgsql security definer set search_path to 'public' as $f$
declare v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_chave is null or length(p_chave) < 32 or length(p_chave) > 128
     or encode(extensions.digest(p_chave, 'sha256'), 'hex') <> 'db653a7df613613064851a7caf1a88b363ef747ac97d6bb6ba8aa33140ad71d3' then
    perform pg_sleep(0.5); raise exception 'chave';
  end if;
  if p_ok is null or p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 40 or length(p_itens::text) > 8000 then raise exception 'itens'; end if;
  delete from saude_checagens where origem = 'vps-atualizacao' and (em at time zone 'America/Sao_Paulo')::date = v_dia;
  insert into saude_checagens (origem, ok, itens) values ('vps-atualizacao', p_ok, p_itens);
  return 'ok';
end $f$;
revoke all on function public.gravar_saude_vps(text, boolean, jsonb) from public;
grant execute on function public.gravar_saude_vps(text, boolean, jsonb) to anon, authenticated;

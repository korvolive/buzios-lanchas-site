-- publicar: auto
-- Gasto diário do Google Ads na planilha de lucro (Rodrigo 2026-11-23 escolheu "Sozinho, todo dia").
-- O Diretor manda o gasto de ontem; a VPS chama esta função 1 vez por dia com uma chave própria (fica só na VPS;
-- aqui só o sha256 dela). A função só grava a linha "Google Ads" de um dia em lucro_gastos, nada mais.
-- Idempotente.
create extension if not exists pgcrypto with schema extensions;
create or replace function public.gravar_gasto_google(p_chave text, p_data date, p_valor numeric)
 returns text language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_chave is null or length(p_chave) < 32 or length(p_chave) > 128
     or encode(extensions.digest(p_chave, 'sha256'), 'hex') <> 'db653a7df613613064851a7caf1a88b363ef747ac97d6bb6ba8aa33140ad71d3' then
    perform pg_sleep(0.5); raise exception 'chave';
  end if;
  if p_data is null or p_data > (now() at time zone 'America/Sao_Paulo')::date or p_data < (now() at time zone 'America/Sao_Paulo')::date - 60 then raise exception 'data'; end if;
  if p_valor is null or p_valor < 0 or p_valor > 5000 then raise exception 'valor'; end if;
  insert into lucro_gastos (data, nome, grupo, valor, origem) values (p_data, 'Google Ads', 'geral', round(p_valor, 2), 'diretor')
  on conflict (data, nome) do update set valor = excluded.valor, origem = 'diretor', grupo = 'geral';
  return 'ok';
end $$;
revoke all on function public.gravar_gasto_google(text, date, numeric) from public;
grant execute on function public.gravar_gasto_google(text, date, numeric) to anon, authenticated;

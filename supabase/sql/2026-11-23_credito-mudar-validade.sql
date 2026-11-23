-- publicar: auto
-- Rodrigo 2026-11-23: mudar a validade de um crédito de cliente pelo painel (card "Créditos de clientes" > "mudar").
-- Só o administrador. Vale para crédito aberto (não usado nem removido), inclusive vencido. Data de amanhã até 3 anos.
-- Os avisos de vencimento recomeçam para a nova data. Não manda mensagem ao cliente. Idempotente.
create or replace function public.alterar_validade_credito(cid bigint, ate date)
returns void language plpgsql security definer set search_path to 'public' as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date; n int;
begin
  if not public.e_admin() then raise exception 'Só o administrador muda a validade do crédito'; end if;
  if ate is null or ate <= hoje or ate > hoje + interval '3 years' then raise exception 'Escolha uma data entre amanhã e 3 anos'; end if;
  update public.creditos set valido_ate = ate, aviso_vence_em = null, aviso_venceu_em = null
   where id = cid and usado_em is null and removido_em is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Este crédito já foi usado ou removido'; end if;
end $$;
revoke all on function public.alterar_validade_credito(bigint, date) from public, anon;
grant execute on function public.alterar_validade_credito(bigint, date) to authenticated;

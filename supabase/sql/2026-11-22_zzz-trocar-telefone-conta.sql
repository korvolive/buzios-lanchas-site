-- publicar: auto
-- Trocar o telefone da própria conta pelo app (Rodrigo 2026-11-22). Chamado só pela função cadastro-whatsapp depois
-- de conferir o código no WhatsApp do número novo. É a mesma conta: reservas, pagamentos, saldo e cupons ficam no user_id.
-- Os passeios de hoje em diante passam a usar o número novo (avisos do dia no telefone certo).
-- Registra o aviso de segurança (push + e-mail; sem modelo de WhatsApp) e, pelo gatilho de telefones_trocados,
-- o saque fica 24 h em espera. Idempotente.

alter table public.avisos_seguranca drop constraint if exists avisos_seguranca_tipo_check;
alter table public.avisos_seguranca add constraint avisos_seguranca_tipo_check check (tipo in ('saque', 'pix', 'telefone'));

create or replace function public._trocar_telefone_conta(u uuid, novo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare antes text; nc int := 0; np int := 0; na int := 0; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'service_role') then raise exception 'Sem acesso'; end if;
  if novo !~ '^\+\d{1,4} \d{6,14}$' then raise exception 'telefone_invalido' using errcode = 'P0001'; end if;
  antes := coalesce((select whatsapp from public.clientes where user_id = u), (select telefone from public.perfis where user_id = u));
  update public.clientes set whatsapp = novo, whatsapp_ok_em = now() where user_id = u; get diagnostics nc = row_count;
  update public.perfis set telefone = novo where user_id = u; get diagnostics np = row_count;
  if nc = 0 and np = 0 then raise exception 'sem_cadastro' using errcode = 'P0001'; end if;
  update public.anotacoes a set telefone = novo
    from public.bloqueios b where b.id = a.bloqueio_id and a.cliente_conta = u and b.data >= hoje
      and a.telefone is distinct from novo;
  get diagnostics na = row_count;
  if public._dig(antes) is distinct from public._dig(novo) then
    insert into public.avisos_seguranca (tipo, user_id, chave, chave_tipo, chave_anterior) values ('telefone', u, novo, 'telefone', antes);
    perform public.aviso_seguranca_chamar();
  end if;
  return jsonb_build_object('passeios', na);
end $$;
revoke all on function public._trocar_telefone_conta(uuid, text) from public, anon, authenticated;
grant execute on function public._trocar_telefone_conta(uuid, text) to service_role;

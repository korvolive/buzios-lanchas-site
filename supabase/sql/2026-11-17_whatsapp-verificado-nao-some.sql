-- publicar: auto
-- WhatsApp verificado não some mais quando o administrador edita nome/telefone (2026-11-17).
-- Causa: editar_usuario (security definer) grava clientes.whatsapp com outra formatação, ex. "+55 (22) 99988-8745".
-- No caminho do servidor, trava_whatsapp_ok comparava o TEXTO e zerava whatsapp_ok_em mesmo com os mesmos dígitos.
-- Agora compara só os dígitos, igual ao caminho do app. Idempotente.
create or replace function public.trava_whatsapp_ok()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if current_user not in ('authenticated','anon') then
    if tg_op = 'UPDATE' and public._dig(new.whatsapp) is distinct from public._dig(old.whatsapp)
       and new.whatsapp_ok_em is not distinct from old.whatsapp_ok_em then new.whatsapp_ok_em := null; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then new.whatsapp_ok_em := null;
  elsif public._dig(new.whatsapp) is distinct from public._dig(old.whatsapp) then new.whatsapp_ok_em := null;
  else new.whatsapp_ok_em := old.whatsapp_ok_em; end if;
  return new;
end $function$;

-- (devolução pontual da verificação de 2 clientes aplicada em 17/11; ids e nomes retirados do repositório público por LGPD)

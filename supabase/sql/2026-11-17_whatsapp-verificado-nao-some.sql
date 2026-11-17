-- publicar: auto
-- WhatsApp verificado não some mais quando o administrador edita nome/telefone (caso Alex, lancha Angela, 2026-11-17).
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

-- Devolve a verificação de quem confirmou o código e perdeu por causa disso: Alex (Angela) em 05/11 e Antonio Falck em 14/11.
-- Só se o número de hoje é o mesmo que recebeu o código (wa_codigos.tel_dig) e o código foi aceito (expira_em virou a hora da confirmação).
update public.clientes c set whatsapp_ok_em = w.expira_em
  from public.wa_codigos w
 where w.user_id = c.user_id
   and c.user_id in ('1f3b68a6-001a-4c18-abb9-7e4acabfd546', '9671b904-dca8-4eb6-979e-e377ed6f1fb5')
   and c.whatsapp_ok_em is null
   and w.tentativas >= 5
   and w.expira_em > w.ultimo_envio and w.expira_em < w.ultimo_envio + interval '5 minutes'
   and w.tel_dig = public._dig(c.whatsapp);

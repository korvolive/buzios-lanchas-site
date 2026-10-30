-- WhatsApp sem duplicar (Rodrigo 2026-10-30): quando alguém manda o convite pelo botão do app (marcar_wa 'convite' grava
-- anotacoes.wa_convite_em), o aviso automático do número oficial ("passeio registrado") não sai mais para o mesmo passeio.
-- O envio automático só manda quando aviso_wa_em está vazio; aqui o toque no botão preenche esse campo.
-- Pode rodar de novo sem problema.
create or replace function public._convite_manual_marca_aviso()
returns trigger language plpgsql as $$
begin
  if new.wa_convite_em is not null and old.wa_convite_em is null and new.aviso_wa_em is null then
    new.aviso_wa_em := new.wa_convite_em;
  end if;
  return new;
end $$;
revoke all on function public._convite_manual_marca_aviso() from public, anon, authenticated;

drop trigger if exists convite_manual_marca_aviso on public.anotacoes;
create trigger convite_manual_marca_aviso before update of wa_convite_em on public.anotacoes
  for each row execute function public._convite_manual_marca_aviso();

-- conferência: deve mostrar 1
select count(*) as gatilho_criado from pg_trigger where tgname = 'convite_manual_marca_aviso';

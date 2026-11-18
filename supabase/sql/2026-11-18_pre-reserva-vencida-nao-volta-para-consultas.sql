-- publicar: auto
-- Rodrigo 2026-11-18 (casos Paulo e Joaquin): pré-reserva aprovada que vence sem sinal simplesmente encerra.
-- Não volta mais para Consultas pedindo nova aprovação (confundia com consulta nova do mesmo cliente).
-- Se o cliente voltar a procurar, o pedido é resgatado a partir da conversa.
-- O trigger pre_reserva_volta continua existindo, mas a função não copia mais nada (idempotente, sem DROP).
create or replace function public._pre_reserva_volta() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  return old; -- desligado em 2026-11-18: a pré-reserva vencida não volta para Consultas
end $$;
revoke all on function public._pre_reserva_volta() from public, anon, authenticated;

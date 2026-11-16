-- 2026-11-16 (caso Elka): pré-reserva lançada pela equipe com prazo combinado (pedidos.pagar_ate, ex.: até 9h30) foi solta às 1h40
-- porque uma tentativa de pagamento de madrugada abriu uma cobrança nova, e o robô do Asaas (expirar) solta a data 2 horas depois
-- de cada cobrança. Regra: uma tentativa de pagamento nunca encurta o prazo da pré-reserva. Enquanto pagar_ate não passou,
-- o pedido com passeio na agenda (bloqueio_id) não fica com "prazo vencido" e o cliente não recebe o aviso de prazo acabado.
create or replace function public.tg_pre_reserva_prazo_vale()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.prazo_vencido_em is not null and old.prazo_vencido_em is null
     and new.bloqueio_id is not null and new.pagar_ate is not null and new.pagar_ate > now() then
    new.prazo_vencido_em := null;
  end if;
  return new;
end $$;
create or replace trigger a_pre_reserva_prazo_vale before update of prazo_vencido_em on public.pedidos
  for each row execute function public.tg_pre_reserva_prazo_vale();

create or replace function public.tg_msg_expirou_pre_reserva()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sistema = 'expirou:' and new.pedido is not null and exists (
       select 1 from public.pedidos p where p.id = new.pedido and p.bloqueio_id is not null
          and p.pagar_ate is not null and p.pagar_ate > now() and p.prazo_vencido_em is null) then
    return null; -- a pré-reserva continua valendo: sem aviso de prazo acabado
  end if;
  return new;
end $$;
create or replace trigger a_msg_expirou_pre_reserva before insert on public.mensagens
  for each row execute function public.tg_msg_expirou_pre_reserva();

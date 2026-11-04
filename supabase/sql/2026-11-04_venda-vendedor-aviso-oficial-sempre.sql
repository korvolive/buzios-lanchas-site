-- 2026-11-04 (Rodrigo: "não pode ter pegadinha"): em venda de vendedor, tocar no WhatsApp manual
-- (Mandar o link de pagamento) não cancela mais o aviso automático do número oficial, que confirma o WhatsApp do cliente.
create or replace function public._convite_manual_marca_aviso()
returns trigger language plpgsql as $$
begin
  if new.wa_convite_em is not null and old.wa_convite_em is null and new.aviso_wa_em is null
     and not exists (select 1 from public.vendas_manuais m where m.bloqueio_id = new.bloqueio_id) then
    new.aviso_wa_em := new.wa_convite_em;
  end if;
  return new;
end $$;
select 'ok' as aviso_oficial_sempre;

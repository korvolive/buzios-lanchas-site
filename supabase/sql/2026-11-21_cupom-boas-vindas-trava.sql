-- publicar: auto
-- Revisão diária 21/11: cupom de boas-vindas não pode ser pego de novo trocando a data da conta ou reaproveitando o WhatsApp.
-- 1) clientes.criado_em: site/app (anon/authenticated) não muda mais; na inclusão vale a hora do servidor.
-- 2) cupons de boas-vindas guardam os 8 últimos dígitos do WhatsApp na hora em que nascem; outro cupom de boas-vindas
--    com o mesmo número não entra (vale para o pop-up do site e para o link do vendedor), mesmo se a conta antiga trocar ou apagar o número.
-- Idempotente.

create or replace function public.trava_criado_em_cliente()
returns trigger language plpgsql set search_path to 'public' as $f$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then new.criado_em := now();
    else new.criado_em := old.criado_em; end if;
  end if;
  return new;
end $f$;
drop trigger if exists a1_trava_criado_em on public.clientes;
create trigger a1_trava_criado_em before insert or update on public.clientes
  for each row execute function public.trava_criado_em_cliente();

alter table public.cupons add column if not exists tel8 text;

update public.cupons k set tel8 = right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 8)
  from public.clientes c
 where c.user_id = k.cliente and k.origem = 'boas-vindas' and k.tel8 is null
   and length(right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 8)) = 8;

create or replace function public.cupom_bv_tel()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
declare t text;
begin
  select right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 8) into t from public.clientes c where c.user_id = new.cliente;
  if t is null or length(t) <> 8 then return null; end if; -- sem WhatsApp válido: não nasce cupom de boas-vindas
  if exists (select 1 from public.cupons q where q.origem = 'boas-vindas' and q.tel8 = t and q.cliente <> new.cliente) then
    return null; -- número já usou um cupom de boas-vindas em outra conta
  end if;
  new.tel8 := t;
  return new;
end $f$;
revoke all on function public.cupom_bv_tel() from public, anon, authenticated;
drop trigger if exists cupom_bv_tel on public.cupons;
create trigger cupom_bv_tel before insert on public.cupons
  for each row when (new.origem = 'boas-vindas') execute function public.cupom_bv_tel();

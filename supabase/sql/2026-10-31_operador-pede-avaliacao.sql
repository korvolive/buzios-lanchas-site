-- 2026-10-31 (Rodrigo): o Lucas (operador) pede a avaliação no WhatsApp e marca no app que já pediu.
-- Antes só o administrador (ou o dono, nos passeios de fora) podia marcar.
create or replace function public.marcar_wa_aval(bid bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare b record; og text;
begin
  select * into b from public.bloqueios where id = bid;
  if b is null then raise exception 'Passeio não encontrado'; end if;
  select a.origem into og from public.anotacoes a where a.bloqueio_id = bid;
  if not public.e_admin()
     and not (coalesce(public.papel_painel() = 'operador', false) and og = 'buzios')
     and not (coalesce(og,'fora') <> 'buzios' and exists (select 1 from public.donos d where d.lancha = b.lancha and d.user_id = auth.uid())) then
    raise exception 'Sem acesso';
  end if;
  update public.realizados set wa_aval = now() where bloqueio_id = bid;
end $function$;

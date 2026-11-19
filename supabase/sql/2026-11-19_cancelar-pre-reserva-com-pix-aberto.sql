-- publicar: auto
-- Caso pedido 77 (2026-11-19): o cliente trocou a Bubbles pela Miss Bardot, mas a pré-reserva da Bubbles não podia ser
-- cancelada porque ele tinha gerado um Pix (ainda não pago). Agora só trava o cancelamento quem já PAGOU (pago_em);
-- o Pix aberto é cancelado no Asaas pela rodada "expirar" (pedido não está mais pendente) ou pela ponte antes de cancelar.
-- Idempotente.
CREATE OR REPLACE FUNCTION public._cancelar_pre_reserva_base(bid bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; em text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem permissão'; end if;
  select * into b from public.bloqueios where id = bid for update;
  select * into a from public.anotacoes where bloqueio_id = bid;
  if b.id is null or a.bloqueio_id is null then raise exception 'Passeio não encontrado'; end if;
  if a.origem is distinct from 'buzios' or not (a.valor > 0) or coalesce(a.sinal, 0) <> 0 then raise exception 'Só dá para cancelar aqui uma pré-reserva sem sinal'; end if;
  if b.data < hoje then raise exception 'A data deste passeio já passou'; end if;
  if exists (select 1 from public.pedidos where bloqueio_id = bid and status = 'aprovado') then raise exception 'Este passeio já foi aprovado: fale com a Búzios Lanchas'; end if;
  if a.comprovante is not null then raise exception 'Este passeio já tem comprovante: fale com a Búzios Lanchas'; end if;
  -- cliente com conta (Rodrigo 2026-10-31): o Lucas também cancela, a não ser que o cliente já tenha pago ou mandado comprovante
  -- (2026-11-19: Pix gerado e não pago não impede mais; só cobrança paga)
  if exists (select 1 from public.pedidos p where p.bloqueio_id = bid and p.status = 'pendente' and (p.comprovante_em is not null
       or exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))
       or exists (select 1 from public.pagamentos_asaas x where x.pedido = p.id and x.pago_em is not null))) then
    raise exception 'O cliente já pagou ou mandou comprovante: fale com a Búzios Lanchas'; end if;
  update public.pedidos set status = 'cancelado', motivo = 'cliente', bloqueio_id = null, atualizado_em = now()
   where bloqueio_id = bid and status = 'pendente';
  select nullif(btrim(email), '') into em from public.convites where bloqueio_id = bid;
  begin
    insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang,
                                  valor, sinal, hora_ini, hora_fim, obs, recusada_em)
      values (true, now(), b.criado_por, b.lancha, b.data, b.horario, a.pessoas, a.embarque,
              coalesce(nullif(btrim(a.cliente), ''), 'Cliente'), coalesce(a.telefone, ''), lower(coalesce(em, '')), 'pt',
              a.valor, nullif(a.sinal_combinado, 0), a.hora_ini, a.hora_fim,
              concat_ws(' · ', '🚫 Cliente desistiu em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24"h"MI'), nullif(btrim(a.obs), '')),
              case when b.data >= hoje then now() end);
  exception when others then null; -- a cópia nunca impede o cancelamento
  end;
  delete from public.bloqueios where id = bid;
end $function$;
REVOKE ALL ON FUNCTION public._cancelar_pre_reserva_base(bigint) FROM PUBLIC, anon, authenticated;

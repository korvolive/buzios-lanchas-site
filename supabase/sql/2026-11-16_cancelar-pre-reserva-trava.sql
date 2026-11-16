-- 2026-11-16 (revisão): cancelar_pre_reserva passa a travar também a anotação e os pedidos do passeio antes de conferir
-- sinal/comprovante/pagamento, para um comprovante ou confirmação de pagamento que chegue no mesmo instante não passar.
-- Resto da função igual à versão no ar.
create or replace function public.cancelar_pre_reserva(bid bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; em text; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem permissão'; end if;
  select * into b from public.bloqueios where id = bid for update;
  select * into a from public.anotacoes where bloqueio_id = bid for update;
  perform 1 from public.pedidos where bloqueio_id = bid for update;
  if b.id is null or a.bloqueio_id is null then raise exception 'Passeio não encontrado'; end if;
  if a.origem is distinct from 'buzios' or not (a.valor > 0) or coalesce(a.sinal, 0) <> 0 then raise exception 'Só dá para cancelar aqui uma pré-reserva sem sinal'; end if;
  if b.data < hoje then raise exception 'A data deste passeio já passou'; end if;
  if exists (select 1 from public.pedidos where bloqueio_id = bid and status = 'aprovado') then raise exception 'Este passeio já foi aprovado: fale com a Búzios Lanchas'; end if;
  if a.comprovante is not null then raise exception 'Este passeio já tem comprovante: fale com a Búzios Lanchas'; end if;
  -- cliente com conta (Rodrigo 2026-10-31): o Lucas também cancela, a não ser que o cliente já tenha pago ou mandado comprovante
  if exists (select 1 from public.pedidos p where p.bloqueio_id = bid and p.status = 'pendente' and (p.comprovante_em is not null
       or exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))
       or exists (select 1 from public.pagamentos_asaas x where x.pedido = p.id))) then
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

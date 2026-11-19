-- publicar: auto
-- Regra do Rodrigo (2026-11-19 15h42, grupo do cliente argentino da Bubbles 20/11): o cliente não pode ter duas
-- pré-reservas sem sinal pago ao mesmo tempo. Exceção: mesma data (junta num pagamento só, /adicionar, ou troca
-- automática da anterior). Data diferente: ou paga o sinal da primeira antes de abrir outra, ou cancela a primeira.
-- Vale para qualquer caminho que cria pré-reserva (aprovação no app, botão do dono, ponte do Lucas, Miss Bardot automática),
-- porque todos inserem a anotação 'buzios' com valor > 0 e sinal 0. Idempotente.
create or replace function public._pre_reserva_pendente_outra_data(p_tel text, p_data date, p_ignorar bigint default null)
 returns table (bloqueio bigint, lancha text, data date, horario text)
 language sql stable security definer set search_path to 'public' as $$
  select xb.id, xb.lancha, xb.data, xb.horario
    from public.bloqueios xb join public.anotacoes xa on xa.bloqueio_id = xb.id
   where public._tel_chave(p_tel) is not null and length(public._tel_chave(p_tel)) >= 8
     and public._tel_chave(xa.telefone) = public._tel_chave(p_tel)
     and xb.id is distinct from p_ignorar
     and xb.data <> p_data
     and xb.data >= (now() at time zone 'America/Sao_Paulo')::date
     and xa.origem = 'buzios' and coalesce(xa.valor, 0) > 0
     and coalesce(xa.sinal, 0) = 0 and xa.comprovante is null
     and not exists (select 1 from public.pedidos p where p.bloqueio_id = xb.id
                      and (p.status = 'aprovado' or p.comprovante_em is not null
                           or exists (select 1 from public.pagamentos_asaas g where g.pedido = p.id and g.pago_em is not null)
                           or exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))))
   order by xb.data, xb.id
   limit 1
$$;
revoke all on function public._pre_reserva_pendente_outra_data(text, date, bigint) from public, anon, authenticated;

create or replace function public._trava_segunda_pre_reserva()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
declare d date; x record;
begin
  if new.origem is distinct from 'buzios' or coalesce(new.valor, 0) <= 0 or coalesce(new.sinal, 0) <> 0 then return new; end if;
  if current_setting('app.segunda_pre_ok', true) = '1' then return new; end if; -- escape manual, só pelo servidor
  select b.data into d from public.bloqueios b where b.id = new.bloqueio_id;
  if d is null then return new; end if;
  select * into x from public._pre_reserva_pendente_outra_data(new.telefone, d, new.bloqueio_id);
  if x.bloqueio is not null then
    raise exception 'PRE_RESERVA_PENDENTE: o cliente já tem pré-reserva sem sinal pago: % em % (%). Pergunte se ele mantém essa (paga o sinal e depois abre a nova) ou troca (cancele a anterior e lance a nova). Mesma data pode juntar num pagamento só.',
      x.lancha, to_char(x.data, 'DD/MM/YYYY'), x.horario
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public._trava_segunda_pre_reserva() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'a_trava_segunda_pre_reserva' and tgrelid = 'public.anotacoes'::regclass) then
    create trigger a_trava_segunda_pre_reserva before insert on public.anotacoes
      for each row execute function public._trava_segunda_pre_reserva();
  end if;
end $$;

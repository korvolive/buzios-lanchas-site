-- publicar: auto
-- Troca de lancha/horário (autorização do dono, 16/11 13:05Z): quando sai uma pré-reserva nova para o MESMO cliente
-- (telefone completo, com/sem 55 e com/sem nono dígito) na MESMA data, a pré-reserva anterior sem sinal, sem
-- comprovante, sem pagamento e não aprovada é solta sozinha, pelo mesmo caminho do cancelar_pre_reserva, sem mensagem.
-- Reservas do mesmo grupo (várias lanchas juntas) nunca se soltam. consultas.manter_anterior = true mantém as duas.

alter table public.consultas add column if not exists manter_anterior boolean not null default false;

create or replace function public._tel_chave(t text)
 returns text language sql immutable set search_path to 'public' as $$
  select case
    when d is null or d = '' then null
    when length(d2) = 11 and substr(d2, 3, 1) = '9' then substr(d2, 1, 2) || substr(d2, 4)
    else d2 end
  from (select d, case when d like '55%' and length(d) in (12, 13) then substr(d, 3) else d end d2
          from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') d) a) b
$$;
revoke all on function public._tel_chave(text) from public, anon, authenticated;

create or replace function public._soltar_anterior_mesmo_cliente(novo bigint)
 returns int language plpgsql security definer set search_path to 'public' as $$
declare b public.bloqueios%rowtype; a public.anotacoes%rowtype; k text; x record; n int := 0;
begin
  select * into b from public.bloqueios where id = novo;
  select * into a from public.anotacoes where bloqueio_id = novo;
  k := public._tel_chave(a.telefone);
  if b.id is null or k is null or length(k) < 8 then return 0; end if;
  for x in select xb.id from public.bloqueios xb join public.anotacoes xa on xa.bloqueio_id = xb.id
            where xb.id <> novo and xb.data = b.data and xa.origem = 'buzios'
              and public._tel_chave(xa.telefone) = k
              and (a.grupo is null or xa.grupo is distinct from a.grupo)
              and coalesce(xa.sinal, 0) = 0 and xa.comprovante is null
              and not exists (select 1 from public.pedidos p where p.bloqueio_id = xb.id
                               and (p.status = 'aprovado' or coalesce(p.sinal_valor, 0) > 0 or p.comprovante_em is not null
                                    or exists (select 1 from public.pagamentos_asaas g where g.pedido = p.id)
                                    or exists (select 1 from public.pagamentos_pp g where g.pedido = p.id and (g.pago_em is not null or g.captura is not null))))
  loop
    begin
      perform public._cancelar_pre_reserva_base(x.id);
      n := n + 1;
    exception when others then null; -- soltar a anterior nunca impede a nova
    end;
  end loop;
  return n;
end $$;
revoke all on function public._soltar_anterior_mesmo_cliente(bigint) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._aprovar_consulta(cid bigint, p_recebido boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.consultas%rowtype; bid bigint; v numeric; s numeric; sc numeric; res text; pid bigint; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into c from public.consultas where id = cid for update;
  if c.id is null then raise exception 'Consulta não encontrada'; end if;
  if c.data < hoje then raise exception 'A data já passou'; end if;
  if not public._horario_ok(c.horario, c.data) then raise exception 'Horário inválido'; end if;
  v := coalesce(c.valor, public.preco_tabela(c.lancha, c.data, c.horario));
  if not (v > 0) then raise exception 'Sem valor combinado nem preço de tabela: use o Aprovar normal e preencha o valor'; end if;
  s := coalesce(c.sinal, 0);
  if s < 0 or s > v then raise exception 'Sinal inválido'; end if;
  if c.pessoas is not null and c.pessoas > public._capacidade(c.lancha) then raise exception 'Pessoas acima da capacidade da lancha (%)', public._capacidade(c.lancha); end if;
  if s > 0 and not coalesce(p_recebido, false) then
    c.obs := concat_ws(' · ', nullif(c.obs, ''), 'Sinal combinado R$ ' || s || ', ainda não recebido');
    sc := s;
    s := 0;
  end if;
  if exists (select 1 from public.bloqueios x where x.lancha = c.lancha and x.data = c.data and public.choca_horario(x.horario, c.horario)) then
    raise exception 'Esse horário já está ocupado na lancha %', c.lancha; end if;
  if public._choca_horas_reais(c.lancha, c.data, c.hora_ini, c.hora_fim) then
    raise exception 'O horário das % às % cruza outra reserva na lancha %', c.hora_ini, c.hora_fim, c.lancha; end if;
  if exists (select 1 from public.manutencoes m where m.lancha = c.lancha and m.de <= c.data and c.data <= m.ate) then
    raise exception 'A lancha % está em manutenção nesse dia', c.lancha; end if;
  insert into public.bloqueios (lancha, data, horario, criado_por) values (c.lancha, c.data, c.horario, auth.uid()) returning id into bid;
  insert into public.anotacoes (bloqueio_id, origem, cliente, telefone, pessoas, valor, sinal, sinal_combinado, embarque, hora_ini, hora_fim, obs, grupo)
    values (bid, 'buzios', c.nome, c.telefone, c.pessoas, v, s, sc, c.embarque, c.hora_ini, c.hora_fim, c.obs, c.grupo);
  if c.vendedor is not null then
    insert into public.vendas_manuais (bloqueio_id, vendedor, comissao) values (bid, c.vendedor, round(coalesce(c.comissao_vend, 0), 2))
      on conflict (bloqueio_id) do nothing;
  end if;
  if current_setting('app.grupo_aprov', true) = '1' then res := null;
  else res := public.convidar_cliente(bid, c.email, c.nome, c.telefone); end if;
  select id into pid from public.pedidos where bloqueio_id = bid;
  delete from public.consultas where id = cid;
  if not coalesce(c.manter_anterior, false) then perform public._soltar_anterior_mesmo_cliente(bid); end if;
  return jsonb_build_object('bid', bid, 'convite', res, 'pendente', s = 0, 'email', c.email, 'valor', v, 'sinal', s, 'pedido', pid);
end $function$;

-- publicar: auto
-- Neto combinado com o dono (Rodrigo 2026-11-23): quando o Rodrigo liga pro dono e ele aceita receber menos
-- ("dá pra fazer por tanto?"), o Lucas, por ordem do Rodrigo ou do Diretor, grava esse neto. Assim:
--   * o lançamento do Lucas aceita valor do cliente a partir do neto combinado (antes recusava abaixo do neto da tabela);
--   * a parte do dono do passeio passa a ser o neto combinado (anotacoes.neto_dono), e o repasse sai certo sozinho;
--   * o dono vê esse neto na tela de aprovação (/aprovar), que já mostra consultas.neto_garantido.
-- Sem isso o desconto saía todo da comissão da Búzios e o dono recebia o neto cheio.
-- Só operador (Lucas) ou administrador. Nunca na Miss Bardot. Neto combinado entre 50% e menos que 100% do neto da tabela.
-- Passeio já pago não muda (o administrador corrige na ficha). Idempotente.

alter table public.cotacoes_garantidas add column if not exists combinado boolean not null default false;

create or replace function public.combinar_neto_dono(p_tel text, p_lancha text, p_data date, p_horario text, p_neto numeric,
  p_valor numeric default null, p_hora_ini text default null, p_hora_fim text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare dig text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'); k record; v numeric; nid bigint; ate timestamptz;
        hoje date := (now() at time zone 'America/Sao_Paulo')::date; nc int := 0; na int := 0; npago int := 0;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'Telefone inválido'; end if;
  if p_data is null or p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if p_lancha = 'miss-bardot' then raise exception 'A Miss Bardot não tem neto de dono'; end if;
  if not public._horario_ok(coalesce(p_horario, ''), p_data) then raise exception 'Horário inválido'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim))) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  k := public._precos_lanc(p_lancha, p_data, p_horario, p_hora_ini, p_hora_fim);
  if k.neto is null or k.tab is null then raise exception 'Essa lancha não tem preço de tabela nessa data'; end if;
  if p_neto is null or not (p_neto > 0) or p_neto >= k.neto then
    raise exception 'O neto combinado precisa ser menor que o neto da tabela (R$ %)', k.neto; end if;
  if p_neto < round(k.neto * 0.5) then
    raise exception 'O neto combinado (R$ %) parece errado: é menos da metade do neto da tabela (R$ %)', p_neto, k.neto; end if;
  -- valor do cliente: o informado, ou a tabela menos o que o dono abriu mão
  v := coalesce(p_valor, k.tab - (k.neto - p_neto));
  if not (v >= p_neto) then raise exception 'O valor do cliente (R$ %) fica abaixo do neto combinado (R$ %)', v, p_neto; end if;
  if v > greatest(k.tab, coalesce(public._teto_cheio(p_lancha, p_data, p_horario), k.tab)) * 3 then
    raise exception 'O valor (R$ %) parece errado: passa de 3 vezes a tabela (R$ %)', v, k.tab; end if;
  if (select count(*) from public.cotacoes_garantidas where criado_por = auth.uid() and combinado and criado_em > now() - interval '1 day') >= 50 then
    raise exception 'Limite de netos combinados do dia'; end if;

  ate := public._prazo_pre_fim(now(), p_data);
  insert into public.cotacoes_garantidas (tel, lancha, data, horario, hora_ini, hora_fim, valor, tabela, neto, valido_ate, combinado)
    values (dig, p_lancha, p_data, p_horario, p_hora_ini, p_hora_fim, v, k.tab, p_neto, ate, true) returning id into nid;

  -- consulta do Lucas já lançada para esse cliente/lancha/data: passa a levar o neto combinado
  update public.consultas c set neto_garantido = p_neto
   where c.criado_por is not null and c.recusada_em is null and c.lancha = p_lancha and c.data = p_data and c.horario = p_horario
     and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = dig;
  get diagnostics nc = row_count;

  -- passeio já aprovado e ainda sem pagamento: a parte do dono vira o neto combinado
  perform set_config('app.auto_op', '1', true);
  update public.anotacoes a set neto_dono = p_neto
    from public.bloqueios b
   where a.bloqueio_id = b.id and b.lancha = p_lancha and b.data = p_data and b.horario = p_horario
     and b.revenda is null and a.origem = 'buzios' and coalesce(a.sinal, 0) = 0
     and regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') = dig
     and not exists (select 1 from public.pedidos x where x.bloqueio_id = b.id
                      and (x.repasse_dono is not null or coalesce(x.sinal_valor, 0) > 0 or x.comprovante is not null));
  get diagnostics na = row_count;
  perform set_config('app.auto_op', '', true);

  select count(*) into npago from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
   where b.lancha = p_lancha and b.data = p_data and b.horario = p_horario and b.revenda is null and a.origem = 'buzios'
     and regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g') = dig
     and coalesce(a.neto_dono, -1) <> p_neto;

  return jsonb_build_object('ok', true, 'id', nid, 'neto_combinado', p_neto, 'neto_tabela', k.neto, 'tabela', k.tab, 'valor', v,
    'valido_ate', ate, 'consultas', nc, 'reservas', na, 'ja_pago', npago > 0);
end $$;
revoke all on function public.combinar_neto_dono(text, text, date, text, numeric, numeric, text, text) from public, anon;
grant execute on function public.combinar_neto_dono(text, text, date, text, numeric, numeric, text, text) to authenticated;

-- nova cotação do Lucas para o mesmo cliente/lancha/data não apaga o neto combinado que ainda vale
create or replace function public.registrar_cotacao(p_tel text, p_lancha text, p_data date, p_horario text, p_valor numeric, p_hora_ini text default null, p_hora_fim text default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare dig text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'); k record; ate timestamptz; nid bigint;
        hoje date := (now() at time zone 'America/Sao_Paulo')::date; ncb numeric; v_neto numeric; cmb boolean := false;
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'Telefone inválido'; end if;
  if p_data is null or p_data < hoje or p_data > hoje + 730 then raise exception 'Data inválida'; end if;
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'Lancha não existe'; end if;
  if not public._horario_ok(coalesce(p_horario, ''), p_data) then raise exception 'Horário inválido'; end if;
  if (p_hora_ini is null) <> (p_hora_fim is null) or (p_hora_ini is not null and not (public._hora_ok(p_hora_ini) and public._hora_ok(p_hora_fim))) then
    raise exception 'Confira a hora de entrada e de saída'; end if;
  if p_valor is null or not (p_valor > 0) or p_valor > 1000000 then raise exception 'Valor inválido'; end if;
  if (select count(*) from public.cotacoes_garantidas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 2000 then
    raise exception 'Limite de cotações do dia'; end if;
  k := public._precos_lanc(p_lancha, p_data, p_horario, p_hora_ini, p_hora_fim);
  if k.neto is null then return jsonb_build_object('ok', false, 'motivo', 'sem tabela'); end if;
  v_neto := k.neto;
  select min(g.neto) into ncb from public.cotacoes_garantidas g
   where g.combinado and g.tel = dig and g.lancha = p_lancha and g.data = p_data and g.horario = p_horario and g.valido_ate > now();
  if ncb is not null and ncb < v_neto then v_neto := ncb; cmb := true; end if;
  ate := public._prazo_pre_fim(now(), p_data);
  select id into nid from public.cotacoes_garantidas
   where tel = dig and lancha = p_lancha and data = p_data and horario = p_horario and valor = p_valor and cotacoes_garantidas.neto = v_neto
     and coalesce(hora_ini, '') = coalesce(p_hora_ini, '') and coalesce(hora_fim, '') = coalesce(p_hora_fim, '')
     and valido_ate > now()
   order by id desc limit 1;
  if nid is not null then
    return jsonb_build_object('ok', true, 'id', nid, 'repetida', true,
      'valido_ate', (select valido_ate from public.cotacoes_garantidas where id = nid));
  end if;
  insert into public.cotacoes_garantidas (tel, lancha, data, horario, hora_ini, hora_fim, valor, tabela, neto, valido_ate, combinado)
    values (dig, p_lancha, p_data, p_horario, p_hora_ini, p_hora_fim, p_valor, k.tab, v_neto, ate, cmb) returning id into nid;
  return jsonb_build_object('ok', true, 'id', nid, 'valido_ate', ate, 'neto', v_neto, 'tabela', k.tab, 'combinado', cmb);
end $function$;

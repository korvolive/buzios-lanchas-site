-- publicar: auto
-- Búzios Lanchas (Rodrigo 2026-11-25): com cupom, o desconto sai do total e o que sobra divide 50/50 entre sinal e embarque.
-- Antes: sinal = 50% do valor cheio e o cupom saía inteiro do saldo no embarque (ex.: R$ 2.500, cupom R$ 50 -> 1.250 + 1.200).
-- Agora: (2.500 - 50) / 2 -> 1.225 + 1.225. Só para pedidos novos (os já criados ficam como estão).
-- Quem banca o cupom não muda: cupom do site/Búzios sai da comissão da Búzios; cupom do dono (cupom_dono) sai do neto dele.
-- A parte do dono no sinal (tg_repasse_auto) já é neto - cupom_dono - (total com desconto - sinal), então acompanha sozinha.
-- O painel (pedCalc), a troca de horário (cliente_opcoes_pedido, alterar_pedido) e o PayPal já usavam o total com o cupom descontado;
-- faltavam: pré-reserva ligada pelo convite (_ligar_passeio), aprovação do dono no pedido do site (dono_aprovar) e a tela do dono
-- (dono_aprovacao_ver, que mostrava o embarque sem o cupom).
-- Idempotente: cada troca só é feita se o texto antigo ainda estiver na função; se nem o antigo nem o novo existirem, para com erro.

do $mig$
declare
  d text; f regprocedure;
  trocas jsonb := jsonb_build_array(
    -- 1) _ligar_passeio: depois de gravar o pedido (os gatilhos já calcularam o cupom), o sinal passa a ser a metade do valor com desconto
    jsonb_build_object('fn', '_ligar_passeio', 'novo', '-- sinal com o cupom descontado (2026-11-25)', 'velho',
'      -- a mensagem do chat sai uma vez só, na reserva principal, com o sinal de todas as lanchas
      if pid is not null and (n.grupo is null or bid = princ) then
        if n.grupo is not null then
          select sum(coalesce(nullif(a.sinal_combinado, 0), round(a.valor / 2))) into tg from public.anotacoes a
           where a.grupo = n.grupo and a.valor > 0 and coalesce(a.sinal, 0) = 0;
        end if;',
     'nova',
'      -- sinal com o cupom descontado (2026-11-25): o cupom sai do total e o resto divide 50/50 (sinal combinado à mão não muda)
      if pid is not null and coalesce(n.sinal_combinado, 0) = 0 then
        select coalesce(cupom_valor, 0) into tg from public.pedidos where id = pid;
        if tg > 0 and n.valor > tg then
          sv := round((n.valor - tg) / 2);
          update public.pedidos set sinal_valor = sv where id = pid;
        end if;
        tg := null;
      end if;
      -- a mensagem do chat sai uma vez só, na reserva principal, com o sinal de todas as lanchas
      if pid is not null and (n.grupo is null or bid = princ) then
        if n.grupo is not null then
          select sum(coalesce(nullif(a.sinal_combinado, 0), round((a.valor - coalesce(x.cupom_valor, 0)) / 2))) into tg
            from public.anotacoes a left join public.pedidos x on x.bloqueio_id = a.bloqueio_id
           where a.grupo = n.grupo and a.valor > 0 and coalesce(a.sinal, 0) = 0;
        end if;'),
    -- 2) dono_aprovar (pedido do site): sinal = metade do valor menos o cupom
    jsonb_build_object('fn', 'dono_aprovar', 'novo', 'coalesce(p.cupom_valor, 0), 0) / 2, 2)',
     'velho', '    v := round(coalesce(v, 0) / 2, 2);',
     'nova',  '    v := round(greatest(coalesce(v, 0) - coalesce(p.cupom_valor, 0), 0) / 2, 2); -- cupom sai do total (2026-11-25)'),
    -- 3) dono_aprovacao_ver (pedido do site): total com o cupom descontado e neto menos o cupom do dono
    jsonb_build_object('fn', 'dono_aprovacao_ver', 'novo', 'tot := tot - coalesce(p.cupom_valor, 0);',
     'velho',
'      if tot > 0 and neto > 0 then
        sin := coalesce(nullif(p.sinal_valor, 0), round(tot / 2));',
     'nova',
'      tot := tot - coalesce(p.cupom_valor, 0);
      neto := neto - least(greatest(coalesce(p.cupom_dono, 0), 0), greatest(coalesce(p.cupom_valor, 0), 0));
      if tot > 0 and neto > 0 then
        sin := coalesce(nullif(p.sinal_valor, 0), round(tot / 2));')
  );
  t jsonb;
begin
  for t in select * from jsonb_array_elements(trocas) loop
    select p.oid::regprocedure into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = t->>'fn';
    if f is null then raise exception 'função % não encontrada', t->>'fn'; end if;
    d := pg_get_functiondef(f);
    if position(t->>'novo' in d) > 0 then continue; end if;          -- já trocada
    if position(t->>'velho' in d) = 0 then raise exception 'texto antigo não encontrado em %', t->>'fn'; end if;
    execute replace(d, t->>'velho', t->>'nova');
  end loop;
end $mig$;

-- Conferir (as três devem dar true):
-- select position('-- sinal com o cupom descontado' in pg_get_functiondef('public._ligar_passeio'::regproc)) > 0,
--        position('coalesce(p.cupom_valor, 0), 0) / 2, 2)' in pg_get_functiondef('public.dono_aprovar'::regproc)) > 0,
--        position('tot := tot - coalesce(p.cupom_valor, 0);' in pg_get_functiondef('public.dono_aprovacao_ver'::regproc)) > 0;

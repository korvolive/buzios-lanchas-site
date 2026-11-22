-- publicar: auto
-- Revisão minuciosa 22/11 (pedidos do site). Idempotente, sem dado de cliente.
-- 1) Preço do pedido vem do servidor: cliente logado podia mandar preco_base/preco_cliente no POST de pedidos e, na reserva
--    automática, esse valor virava o total do passeio (saldo do embarque zerado). O site só manda preço com oferta ou link de
--    vendedor (que os gatilhos a_pedido_oferta e pedido_vendedor conferem); sem isso, o valor do navegador é apagado.
create or replace function public._preco_base_servidor() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.e_admin() then return new; end if;
  if new.oferta is not null or nullif(btrim(coalesce(new.vendedor_cod, '')), '') is not null then return new; end if;
  new.preco_base := null;
  new.preco_cliente := null;
  return new;
end $$;
revoke all on function public._preco_base_servidor() from public, anon, authenticated;
drop trigger if exists a1_preco_base_servidor on public.pedidos;
create trigger a1_preco_base_servidor before insert on public.pedidos
  for each row execute function public._preco_base_servidor();

-- 2) Liberação automática do sinal (Miss Bardot e lanchas com reserva automática): confere o horário real, como o resto do site
--    (antes só o turno; uma manhã fora do padrão deixava liberar a tarde e o cliente pagava uma data ocupada).
-- 3) datas_seguradas(): "hoje" no horário de Brasília (current_date é UTC; das 21h à meia-noite sumiam os pedidos do dia).
do $do$
declare f text;
begin
  f := pg_get_functiondef('public.mb_libera_sinal_sozinho()'::regprocedure);
  if position('_choca_janela' in f) = 0 then
    f := replace(f, $a$                  and (b.horario = new.horario or b.horario = 'dia' or new.horario = 'dia')) into ocupado;$a$,
                    $a$                  and b.revenda is null and (b.horario = new.horario or b.horario = 'dia' or new.horario = 'dia')) into ocupado;
  ocupado := ocupado or public._choca_janela(new.lancha, new.data, new.horario, new.hora_ini, new.hora_fim, null);$a$);
    if position('_choca_janela' in f) = 0 then raise exception 'mb_libera_sinal_sozinho: trecho não encontrado'; end if;
    execute f;
  end if;
  f := pg_get_functiondef('public.datas_seguradas()'::regprocedure);
  if position('current_date' in f) > 0 then
    execute replace(f, 'current_date', $a$(now() at time zone 'America/Sao_Paulo')::date$a$);
  end if;
end $do$;

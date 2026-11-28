-- publicar: auto
-- Rodrigo 27/11 recebeu "Atenção no sistema / gratidao R$ 525.00" (pedido 100, PayPal pago 24/11, passeio 12/12).
-- Alarme falso: o item repasse_dono_parado ainda usava a regra antiga (3 dias depois do pagamento), mas desde 22/11 a parte do
-- dono só sai no 8º dia depois do pagamento (arrependimento do cliente) ou 7 dias antes do passeio, o que vier primeiro
-- (donoLiberaEm na função asaas). Agora só acusa quando essa data já passou há mais de 2 dias, e o texto explica o que é.
-- Idempotente.
do $do$
declare f text;
begin
  f := pg_get_functiondef('public.revisao_dados()'::regprocedure);
  if position('repasse_dono_parado'', p.id::text, p.lancha||'' R$ ''||p.repasse_dono' in f) > 0 then
    f := replace(f, $a$select 'alta', 'repasse_dono_parado', p.id::text, p.lancha||' R$ '||p.repasse_dono
  from pedidos p join pago x on x.pedido = p.id
 where p.status = 'aprovado' and p.repasse_dono > 0 and p.lancha <> 'miss-bardot' and not x.com_split
   and x.pago_em < now() - interval '3 days'$a$,
      $a$select 'alta', 'repasse_dono_parado', p.id::text,
       coalesce((select l.nome from lanchas l where l.slug = p.lancha), p.lancha)||', pedido '||p.id
       ||': parte do dono R$ '||replace(to_char(p.repasse_dono, 'FM999990.00'), '.', ',')
       ||' devia ter saído em '||to_char(least((x.pago_em at time zone 'America/Sao_Paulo')::date + 7, p.data - 7), 'DD/MM')
  from pedidos p join pago x on x.pedido = p.id
 where p.status = 'aprovado' and p.repasse_dono > 0 and p.lancha <> 'miss-bardot' and not x.com_split
   and least((x.pago_em at time zone 'America/Sao_Paulo')::date + 7, p.data - 7) < (now() at time zone 'America/Sao_Paulo')::date - 2$a$);
    if position(': parte do dono R$ ' in f) = 0 then raise exception 'revisao_dados: trecho repasse_dono_parado não encontrado'; end if;
    execute f;
  end if;
end $do$;

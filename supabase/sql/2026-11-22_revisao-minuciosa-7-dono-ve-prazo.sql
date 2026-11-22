-- publicar: auto
-- Rodrigo 22/11: na reserva que o dono está aprovando, mostrar quanto tempo a lancha fica segura para o cliente pagar o sinal.
-- O prazo conta da aprovação (o bloqueio nasce nela) e segue _prazo_pre_fim (7+ dias 12 h, 2-6 dias 6 h, véspera 2-3 h,
-- mesmo dia 1 h, nunca acaba de madrugada). dono_aprovacao_ver passa a devolver segura_h e segura_ate (se aprovar agora).
-- Idempotente, sem dado de cliente.
do $do$
declare f text;
begin
  f := pg_get_functiondef('public.dono_aprovacao_ver(uuid)'::regprocedure);
  if position('segura_ate' in f) = 0 then
    f := replace(f, $a$'neto', neto, 'antecipado', ant, 'embarque', emb);$a$,
      $a$'neto', neto, 'antecipado', ant, 'embarque', emb)
    || case when est = 'pendente' then jsonb_build_object(
         'segura_h', round(extract(epoch from public._prazo_pre(c.data)) / 3600.0, 1),
         'segura_ate', public._prazo_pre_fim(now(), c.data)) else '{}'::jsonb end;$a$);
    if position('segura_ate' in f) = 0 then raise exception 'dono_aprovacao_ver: trecho não encontrado'; end if;
    execute f;
  end if;
end $do$;

-- publicar: auto
-- Rodrigo 27/11: a revisão diária tem que conferir se uma nova atualização automática da VPS não vai derrubar de novo o túnel e o Gemini.
-- revisao_dados() (que a revisão diária e a asaas-saude já rodam) passa a mostrar:
--   media vps_sem_checagem  -> a VPS não gravou a checagem 'vps-atualizacao' nas últimas 26 h
--   media vps_atualizacao   -> item com PROBLEMA na última checagem (baixa para reboot pendente de kernel, que não é urgente)
-- Só 'media'/'baixa': não dispara push (a asaas-saude só avisa 'alta'). Idempotente.
do $do$
declare f text;
begin
  f := pg_get_functiondef('public.revisao_dados()'::regprocedure);
  if position('vps_atualizacao' in f) = 0 then
    f := replace(f, $a$  from pedidos p where p.status in ('aprovado','pendente') and p.preco_cliente > 0 and p.sinal_valor > p.preco_cliente
)$a$,
      $a$  from pedidos p where p.status in ('aprovado','pendente') and p.preco_cliente > 0 and p.sinal_valor > p.preco_cliente
union all
select 'media', 'vps_sem_checagem', null::text, 'a VPS não gravou a checagem diária (atualização automática, túnel, Gemini) nas últimas 26 h'
 where not exists (select 1 from saude_checagens s where s.origem = 'vps-atualizacao' and s.em > now() - interval '26 hours')
union all
select case when coalesce(i->>'t','') ~* 'reboot' then 'baixa' else 'media' end, 'vps_atualizacao', i->>'t', left(coalesce(i->>'d',''), 200)
  from (select itens from saude_checagens s where s.origem = 'vps-atualizacao' and s.em > now() - interval '26 hours' order by s.em desc limit 1) u,
       jsonb_array_elements(u.itens) i
 where jsonb_typeof(u.itens) = 'array' and coalesce(i->>'ok','true') in ('false','f','0')
)$a$);
    if position('vps_atualizacao' in f) = 0 then raise exception 'revisao_dados: trecho não encontrado'; end if;
    execute f;
  end if;
end $do$;

-- publicar: auto
-- Rodrigo 23/11: alerta "sinal pago e pedido cancelado" disparou para o pedido 96 (Felipe), já estornado inteiro.
-- Pedido cancelado cujo pagamento do Asaas foi estornado (REFUNDED/CHARGEBACK) não é problema: sai do alerta. Idempotente.
do $do$
declare f text;
begin
  f := pg_get_functiondef('public.revisao_dados()'::regprocedure);
  if position('estornado_ok' in f) = 0 then
    f := replace(f, $a$   and not exists (select 1 from creditos c where c.origem_bloqueio = p.bloqueio_id)$a$,
      $a$   and not exists (select 1 from creditos c where c.origem_bloqueio = p.bloqueio_id)
   and not exists (select 1 from pagamentos_asaas e where e.pedido = p.id and (e.status ~ '(REFUND|CHARGEBACK)' or e.parcelas::text ~ '(REFUND|CHARGEBACK)')) /* estornado_ok */$a$);
    if position('estornado_ok' in f) = 0 then raise exception 'revisao_dados: trecho não encontrado'; end if;
    execute f;
  end if;
end $do$;

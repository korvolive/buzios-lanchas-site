-- publicar: auto
-- Caso pedido 77/78 (2026-11-19): ao lançar a Miss Bardot para o mesmo cliente no mesmo dia, a Bubbles anterior não foi
-- solta porque (1) o sinal estava LIBERADO (sinal_valor > 0, que é só o valor a pagar, não pagamento) e (2) havia um Pix
-- gerado e não pago. Agora só segura a anterior o que é dinheiro de verdade: aprovada, comprovante, Asaas pago ou PayPal pago/em análise.
-- Mesma data em qualquer horário (regra do Rodrigo 2026-11-19); grupo e manter_anterior continuam protegidos. Idempotente.
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
                               and (p.status = 'aprovado' or p.comprovante_em is not null
                                    or exists (select 1 from public.pagamentos_asaas g where g.pedido = p.id and g.pago_em is not null)
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

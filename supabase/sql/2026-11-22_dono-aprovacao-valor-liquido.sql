-- publicar: auto
-- Aviso ao dono saía "Valor para você: a combinar" porque a edge dono-aprovacao (service_role)
-- não tinha permissão para preco_neto_tabela. Idempotente. Aplicado à mão em 22/11 e registrado aqui.
grant execute on function public.preco_neto_tabela(text, date, text) to service_role;

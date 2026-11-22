-- publicar: auto
-- Revisão minuciosa 22/11: as rodadas agendadas de notificar (fim dos passeios), chat-inativo e clima-alertas passam a mandar
-- a chave interna (resgate_config), como já fazem asaas-expirar e asaas-docs. As funções novas recusam chamada sem ela.
-- Aplicado ANTES das funções pelo workflow (o cabeçalho a mais não atrapalha a versão antiga). Idempotente, sem dado de cliente.
do $do$
declare j record; c text;
begin
  for j in select jobid, jobname, command from cron.job where jobname in ('fim-dos-passeios', 'chat-inativo', 'clima-alertas') and command not ilike '%x-chave%' loop
    c := j.command;
    if j.jobname = 'fim-dos-passeios' then
      c := replace(c, $a$'Authorization',$a$, $a$'x-chave', (select chave from public.resgate_config where id = 1), 'Authorization',$a$);
    else
      c := replace(c, $a$'Content-Type','application/json')$a$, $a$'Content-Type','application/json','x-chave',(select chave from public.resgate_config where id = 1))$a$);
    end if;
    if c not ilike '%x-chave%' then raise exception 'cron %: trecho não encontrado', j.jobname; end if;
    perform cron.alter_job(j.jobid, command := c);
  end loop;
end $do$;

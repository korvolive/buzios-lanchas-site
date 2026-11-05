-- Revisão diária 2026-11-05. Rodar tudo de uma vez no Supabase (já inclui o SQL de 04/11, que ainda não tinha rodado).

-- ===== Parte de 04/11 =====
-- 1) Vendedor novo começa com 3% (regra nova); o administrador sobe até 10% pela tela.
--    Reativar um vendedor não mexe mais na % que ele já tinha.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'cadastrar_vendedor' and p.pronamespace = 'public'::regnamespace;
  if position('teto numeric DEFAULT 10' in d) = 0 then raise notice 'cadastrar_vendedor já estava diferente: nada mudou'; return; end if;
  d := replace(d, 'teto numeric DEFAULT 10', 'teto numeric DEFAULT 3');
  d := replace(d, 'teto := least(coalesce(teto, 10), 10);', 'teto := greatest(least(coalesce(teto, 3), 10), 1);');
  d := replace(d, 'update vendedores set ativo = true, teto_pct = teto where user_id = uid;', 'update vendedores set ativo = true where user_id = uid;');
  if position('teto_pct = teto where' in d) > 0 then raise exception 'não consegui aplicar a correção: nada mudou'; end if;
  execute d;
end $$;

-- 2) O aviso ao cliente da meia diária condicional é marcado só pelo robô (notificar, com a chave de serviço).
--    Dono ou app não conseguem mais apagar ou mudar essa marca (antes dava para fazer o aviso sair de novo).
create or replace function public.trava_cond_aviso()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.cond_aviso_em := case when tg_op = 'UPDATE' then old.cond_aviso_em else null end;
  end if;
  return new;
end $$;
revoke all on function public.trava_cond_aviso() from public, anon, authenticated;
drop trigger if exists trava_cond_aviso on public.anotacoes;
create trigger trava_cond_aviso before insert or update on public.anotacoes
  for each row execute function public.trava_cond_aviso();

-- ===== Parte de 05/11 =====

-- 3) Só o sistema (funções do administrador/Lucas) mexe no grupo de um passeio.
--    Antes um dono podia copiar o código do grupo para um passeio dele, ou tirar a lancha da Búzios do grupo.
create or replace function public.trava_grupo()
returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if current_user not in ('authenticated','anon') or public.e_admin() then return new; end if;
  new.grupo := case when tg_op = 'UPDATE' then old.grupo else null end;
  return new;
end $$;
revoke all on function public.trava_grupo() from public, anon, authenticated;
drop trigger if exists trava_grupo on public.anotacoes;
create trigger trava_grupo before insert or update on public.anotacoes
  for each row execute function public.trava_grupo();

-- 4) Em passeio da Búzios ou de grupo, o dono só reenvia o convite que já existe; não troca o e-mail/WhatsApp do cliente.
--    E só passeios da Búzios do mesmo grupo entram juntos na conta do cliente.
do $$
declare d text; a text := 'raise exception ''Só o administrador ou o dono da lancha''; end if;';
begin
  select pg_get_functiondef('public.convidar_cliente(bigint,text,text,text)'::regprocedure) into d;
  if position('Só o administrador convida o cliente deste passeio' in d) > 0 then raise notice 'convidar_cliente já corrigido'; return; end if;
  if position(a in d) = 0 then raise exception 'convidar_cliente diferente do esperado: nada mudou'; end if;
  d := replace(d, a, a || chr(10) ||
    '  if not adm and exists (select 1 from public.anotacoes x where x.bloqueio_id = bid and (x.origem = ''buzios'' or x.grupo is not null)) then' || chr(10) ||
    '    if exists (select 1 from public.convites c where c.bloqueio_id = bid) then return ''convite''; end if;' || chr(10) ||
    '    raise exception ''Só o administrador convida o cliente deste passeio'';' || chr(10) ||
    '  end if;');
  execute d;
end $$;

do $$
declare d text; a text := 'where a.grupo = n.grupo and a.bloqueio_id <> bid and a.cliente_conta is null';
begin
  select pg_get_functiondef('public._ligar_passeio(bigint,uuid)'::regprocedure) into d;
  if position(a || ' and a.origem' in d) > 0 then raise notice '_ligar_passeio já corrigido'; return; end if;
  if position(a in d) = 0 then raise exception '_ligar_passeio diferente do esperado: nada mudou'; end if;
  d := replace(d, a, a || ' and a.origem = ''buzios'' and n.origem = ''buzios''');
  execute d;
end $$;

-- 5) Só o administrador apaga avaliação do Google (a Analista continua podendo lançar).
create or replace function public.apagar_avaliacao_google(aid bigint)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.e_admin() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  delete from public.avaliacoes_google where id = aid;
end $$;

-- 6) Nome da empresa: só vendedor ativo (não parceiro) muda o próprio; não pode usar "Búzios Lanchas".
create or replace function public.minha_empresa(nome text default null)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare r text;
begin
  if nome is not null then
    if lower(translate(nome, 'úÚ', 'uU')) ~ 'buzios\s*lanchas' then raise exception 'Use o nome da sua empresa' using errcode = 'P0001'; end if;
    update vendedores set empresa = nullif(left(btrim(nome), 60), '') where user_id = auth.uid() and ativo and not coalesce(parceiro, false);
  end if;
  select empresa into r from vendedores where user_id = auth.uid();
  return r;
end $$;

-- 7) Grupo aprovado com sinal menor que o combinado: divide o sinal na proporção de cada lancha (antes as últimas ficavam com R$ 0,01).
do $$
declare d text; nl text := chr(13) || chr(10);
begin
  select pg_get_functiondef('public.aprovar_pre_pedido(bigint)'::regprocedure) into d;
  if position('tot numeric' in d) > 0 then raise notice 'aprovar_pre_pedido já corrigido'; return; end if;
  if position('k int := 0; nk int;' in d) = 0 or position('where a.grupo = g;' || nl || '  for q in' in d) = 0
     or position('else least(coalesce(nullif(q.sinal_combinado, 0), round(q.valor / 2)), v - soma) end;' in d) = 0 then
    raise exception 'aprovar_pre_pedido diferente do esperado: nada mudou';
  end if;
  d := replace(d, 'k int := 0; nk int;', 'k int := 0; nk int; tot numeric;');
  d := replace(d, 'where a.grupo = g;' || nl || '  for q in', 'where a.grupo = g;' || nl ||
    '  select sum(coalesce(nullif(a.sinal_combinado, 0), round(a.valor / 2))) into tot from public.anotacoes a join public.pedidos x on x.bloqueio_id = a.bloqueio_id and x.status = ''pendente'' where a.grupo = g;' || nl || '  for q in');
  d := replace(d, 'else least(coalesce(nullif(q.sinal_combinado, 0), round(q.valor / 2)), v - soma) end;',
    'else least(round(coalesce(nullif(q.sinal_combinado, 0), round(q.valor / 2)) * least(1, v / nullif(tot, 0)), 2), v - soma) end;');
  execute d;
end $$;

-- 8) Funções que visitante sem login não precisa chamar.
revoke execute on function public.vendas_manuais_lista() from public, anon;
grant execute on function public.vendas_manuais_lista() to authenticated;
revoke execute on function public.pode_avaliacao_google() from public, anon;
grant execute on function public.pode_avaliacao_google() to authenticated;
alter function public.tg_precos_cheios() set search_path to 'public';

-- Revisão diária 2026-11-04. Rodar tudo de uma vez no Supabase.

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

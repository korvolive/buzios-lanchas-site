-- publicar: auto
-- Termo de aceite no pagamento (Rodrigo 2026-11-22). Quando o cliente marca "Li e aceito os termos do passeio" na
-- página /pagar/, a função paypal-checkout (acao "aceite") grava aqui o registro do aceite eletrônico: data e hora,
-- IP, aparelho, idioma, nome e CPF de quem pagou e a versão do termo (/termos/). O CPF costuma chegar só na hora de
-- pagar: a função asaas completa o campo vazio. Serve de prova em caso de reclamação; aparece no
-- "Recibo e termo de aceite". Só inclusão (o único ajuste permitido é preencher o CPF vazio). Idempotente.

create table if not exists public.aceites_termo (
  id bigint generated always as identity primary key,
  pedido bigint not null,
  versao text not null,
  aceito_em timestamptz not null default now(),
  idioma text,
  ip text,
  aparelho text,
  nome text,
  cpf text
);
create index if not exists aceites_termo_pedido on public.aceites_termo (pedido, aceito_em desc);

alter table public.aceites_termo enable row level security;
revoke all on public.aceites_termo from anon;
revoke insert, update, delete on public.aceites_termo from authenticated;
grant select on public.aceites_termo to authenticated;

drop policy if exists aceites_termo_admin on public.aceites_termo;
create policy aceites_termo_admin on public.aceites_termo for select to authenticated using (public.e_admin());
drop policy if exists aceites_termo_cliente on public.aceites_termo;
create policy aceites_termo_cliente on public.aceites_termo for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = aceites_termo.pedido and p.cliente = auth.uid()));

-- registro de prova: não se apaga nem se muda (só o CPF vazio pode ser preenchido uma vez)
create or replace function public._aceites_termo_so_inclusao() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'aceites_termo: registro não pode ser apagado'; end if;
  if old.cpf is null and new.cpf is not null
     and (new.pedido, new.versao, new.aceito_em, new.idioma, new.ip, new.aparelho, new.nome)
         is not distinct from (old.pedido, old.versao, old.aceito_em, old.idioma, old.ip, old.aparelho, old.nome) then
    return new;
  end if;
  raise exception 'aceites_termo: registro não pode ser alterado';
end $$;
drop trigger if exists aceites_termo_so_inclusao on public.aceites_termo;
create trigger aceites_termo_so_inclusao before update or delete on public.aceites_termo
  for each row execute function public._aceites_termo_so_inclusao();

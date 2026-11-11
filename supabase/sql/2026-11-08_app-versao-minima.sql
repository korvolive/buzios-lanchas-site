-- Aviso "atualize o app": versão mínima do app por plataforma. O site lê esta tabela (só leitura pública)
-- e mostra a faixa se o app do iPhone (user agent BuziosLanchasIOS/x.y.z) for mais antigo.
-- Para avisar: update public.app_versao set minima='1.0.7', link='https://apps.apple.com/...' where plataforma='ios';
-- Sem linha ou minima vazia = nenhum aviso.
create table if not exists public.app_versao (
  plataforma text primary key check (plataforma in ('ios','android')),
  minima text not null default '',
  obrigatoria boolean not null default false,
  link text not null default ''
);
alter table public.app_versao enable row level security;
drop policy if exists app_versao_leitura on public.app_versao;
create policy app_versao_leitura on public.app_versao for select to anon, authenticated using (true);
grant select on public.app_versao to anon, authenticated; -- tabelas novas neste projeto não ganham permissão sozinhas
insert into public.app_versao (plataforma) values ('ios') on conflict do nothing;

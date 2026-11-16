-- publicar: auto
-- Búzios Lanchas, 2026-11-16 (Rodrigo escolheu "Convite automático e some"):
-- consulta do site cuja data/horário já passou recebe, no mesmo dia entre 18h e 21h, UM aviso do número principal
-- (modelo de Utilidade consulta_encerrada, PT/EN/ES, sem emoji) e sai do painel. A edge consulta-resgate faz o envio.
-- Idempotente.

alter table public.resgate_config add column if not exists convite_ativo boolean not null default true;
alter table public.resgate_config add column if not exists convite_simular boolean not null default false;
alter table public.resgate_config add column if not exists convite_modelo text not null default 'consulta_encerrada';
alter table public.resgate_config add column if not exists convite_modelo_em timestamptz;

-- registro dos convites (trava de duplicidade: no máximo 1 por número a cada 30 dias). Só o servidor lê e escreve.
create table if not exists public.consulta_convites (
  id bigserial primary key,
  tel_dig text not null,
  consulta_id bigint,
  lancha text,
  data date,
  status text not null default 'enviando',
  criado_em timestamptz not null default now()
);
create index if not exists consulta_convites_tel_idx on public.consulta_convites (tel_dig, criado_em desc);
alter table public.consulta_convites enable row level security;
revoke all on table public.consulta_convites from public, anon, authenticated;
revoke all on sequence public.consulta_convites_id_seq from public, anon, authenticated;

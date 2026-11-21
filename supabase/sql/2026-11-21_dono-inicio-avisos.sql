-- publicar: auto
-- Lembrete no app do dono ~2h antes do passeio (Rodrigo 2026-11-21): uma vez por passeio.
-- Só o servidor (notificar) lê e grava: RLS ligada e sem política.
create table if not exists public.dono_inicio_avisos (
  bloqueio_id bigint primary key references public.bloqueios(id) on delete cascade,
  em timestamptz not null default now()
);
alter table public.dono_inicio_avisos enable row level security;
revoke all on public.dono_inicio_avisos from anon, authenticated;

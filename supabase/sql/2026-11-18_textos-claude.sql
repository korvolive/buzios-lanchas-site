-- publicar: auto
-- Textos gerados pelo Claude (API da Anthropic) em segundo plano, toda noite (workflow claude-noturno.yml):
-- texto para o Google (SEO), resumo das avaliações e texto das fotos (alt) em pt/en/es.
-- O site só lê esta tabela; se estiver vazia ou não responder, mostra tudo como antes.
-- Idempotente.

create table if not exists public.lanchas_ia (
  slug text primary key,
  seo jsonb,          -- {"pt": "...", "en": "...", "es": "..."}  descrição para o Google e prévias de link
  resumo jsonb,       -- {"pt": "...", "en": "...", "es": "...", "n": 131}  resumo das avaliações
  alt jsonb,          -- {"<arquivo da foto>": {"pt": "...", "en": "...", "es": "..."}}
  atualizado_em timestamptz not null default now()
);
alter table public.lanchas_ia enable row level security;
drop policy if exists lanchas_ia_ler on public.lanchas_ia;
create policy lanchas_ia_ler on public.lanchas_ia for select to anon, authenticated using (true);
revoke insert, update, delete on public.lanchas_ia from anon, authenticated;
grant select on public.lanchas_ia to anon, authenticated;

-- controle interno (só o servidor): o que já foi processado, cópia do texto antigo antes de trocar e gasto do mês.
create table if not exists public.ia_controle (
  chave text primary key,   -- ex.: "trad:miss-bardot:descricao", "uso:2026-11", "copia:miss-bardot:descricao:2026-11-18T..."
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.ia_controle enable row level security;
revoke all on public.ia_controle from anon, authenticated;

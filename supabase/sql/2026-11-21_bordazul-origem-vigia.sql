-- publicar: auto
-- Bordazul (Rodrigo 2026-11-21: "dar ao vigia acesso à origem dos clientes no Supabase"): o vigia da VPS (login wa_ponte_box)
-- lê e grava a origem de cada cliente (Bordazul x Búzios Lanchas) para acordar o atendente certo.
-- marcar_origem só grava a origem do número (a primeira vale). Idempotente.
grant execute on function public.marcar_origem(text, text, text) to wa_ponte_box;
grant select on public.atendimento_origem to wa_ponte_box;
drop policy if exists atendimento_origem_ponte_le on public.atendimento_origem;
create policy atendimento_origem_ponte_le on public.atendimento_origem for select to wa_ponte_box using (true);

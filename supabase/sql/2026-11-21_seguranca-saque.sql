-- publicar: auto
-- Segurança no saque do app (Rodrigo 2026-11-21):
--  - no máximo 3 saques por dia (Brasília) por pessoa. O saque só vai para chave Pix do mesmo CPF/CNPJ da conta
--    (webhook asaas-saques), por isso fica sem código no WhatsApp (decisão do Rodrigo);
--  - todo saque pedido e toda troca de chave Pix geram um aviso de segurança (push + WhatsApp Utility) para a própria pessoa
--    e para o alerta do administrador. A troca de chave avisa porque a chave também é usada nos pagamentos feitos por fora
--    (comissão e repasse copiados à mão), onde não há conferência de CPF/CNPJ.
-- Fila public.avisos_seguranca, enviada pela função aviso-seguranca (pg_net na hora; cron de 15 em 15 min só se sobrou algo).
-- Idempotente.

create table if not exists public.avisos_seguranca (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('saque','pix')),
  user_id uuid not null,
  valor numeric,
  chave text,
  chave_tipo text,
  chave_anterior text,
  ref bigint,                         -- saques.id (saque)
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  tentativas int not null default 0,
  resultado jsonb
);
create unique index if not exists avisos_seguranca_saque on public.avisos_seguranca (ref) where tipo = 'saque';
create index if not exists avisos_seguranca_pend on public.avisos_seguranca (criado_em) where enviado_em is null;
alter table public.avisos_seguranca enable row level security;
-- sem políticas: só o servidor lê e grava; o administrador vê
drop policy if exists avisos_seguranca_admin on public.avisos_seguranca;
create policy avisos_seguranca_admin on public.avisos_seguranca for select using (public.e_admin());
revoke all on public.avisos_seguranca from anon, authenticated;
grant select on public.avisos_seguranca to authenticated;

alter table public.resgate_config add column if not exists seg_modelo_em timestamptz;

-- chama a função na hora (pg_net manda depois do commit); falha aqui nunca atrapalha o saque nem a troca de chave
create or replace function public.aviso_seguranca_chamar() returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(url := 'https://sqoperylsqcbcjpcrlnp.supabase.co/functions/v1/aviso-seguranca',
    headers := jsonb_build_object('content-type','application/json','x-chave',chave),
    body := '{"acao":"enviar"}'::jsonb, timeout_milliseconds := 30000)
  from public.resgate_config where id = 1 and chave is not null;
exception when others then null;
end $$;
revoke all on function public.aviso_seguranca_chamar() from public, anon, authenticated;

-- limite de 3 saques por dia (backstop da função asaas, que já confere antes e responde "limite_dia")
create or replace function public.tg_saque_limite_dia() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('saque_dia:' || new.user_id::text));
  if (select count(*) from public.saques
       where user_id = new.user_id and status <> 'falhou'
         and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date) >= 3 then
    raise exception 'limite_dia' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.tg_saque_limite_dia() from public, anon, authenticated;
drop trigger if exists a0_limite_dia on public.saques;
create trigger a0_limite_dia before insert on public.saques for each row execute function public.tg_saque_limite_dia();

-- saque pedido ao Asaas (ganhou o id da transferência): entra na fila de avisos, uma vez por saque
create or replace function public.tg_saque_aviso() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.asaas_id is not null and old.asaas_id is null then
    insert into public.avisos_seguranca (tipo, user_id, valor, chave, chave_tipo, ref)
    values ('saque', new.user_id, new.valor, new.chave, new.tipo, new.id)
    on conflict do nothing;
    perform public.aviso_seguranca_chamar();
  end if;
  return new;
end $$;
revoke all on function public.tg_saque_aviso() from public, anon, authenticated;
drop trigger if exists zz_aviso_seguranca on public.saques;
create trigger zz_aviso_seguranca after update of asaas_id on public.saques for each row execute function public.tg_saque_aviso();

-- troca de chave Pix: mesma validação de antes; se já havia outra chave, avisa
create or replace function public.salvar_pix(tipo text, chave text) returns void language plpgsql security definer set search_path = public as $function$
declare vend boolean := exists (select 1 from vendedores where user_id = auth.uid());
        dono boolean := exists (select 1 from donos where user_id = auth.uid());
        antes text;
begin
  if not vend and not dono then raise exception 'Só vendedores e donos'; end if;
  if not (
    (tipo = 'cpf' and chave ~ '^[0-9]{11}$') or
    (tipo = 'cnpj' and chave ~ '^[0-9]{14}$') or
    (tipo = 'email' and chave ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(chave) <= 77) or
    (tipo = 'telefone' and chave ~ '^\+55[0-9]{10,11}$') or
    (tipo = 'aleatoria' and chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then raise exception 'pix_invalida' using errcode = 'P0001'; end if;
  antes := coalesce((select pix_chave from vendedores where user_id = auth.uid() and pix_chave <> ''),
                    (select pix_chave from pix_donos where user_id = auth.uid() and pix_chave <> ''));
  if vend then update vendedores set pix_tipo = tipo, pix_chave = chave where user_id = auth.uid(); end if;
  if dono then
    insert into pix_donos (user_id, pix_tipo, pix_chave) values (auth.uid(), tipo, chave)
    on conflict (user_id) do update set pix_tipo = excluded.pix_tipo, pix_chave = excluded.pix_chave, atualizado_em = now();
  end if;
  if antes is not null and antes is distinct from chave then
    insert into public.avisos_seguranca (tipo, user_id, chave, chave_tipo, chave_anterior) values ('pix', auth.uid(), chave, tipo, antes);
    perform public.aviso_seguranca_chamar();
  end if;
end $function$;
revoke all on function public.salvar_pix(text, text) from public, anon;
grant execute on function public.salvar_pix(text, text) to authenticated;

-- rede de segurança: de 15 em 15 minutos, só chama se ficou aviso sem enviar (consulta barata, sem custo quando a fila está vazia)
do $$ begin
  perform cron.unschedule('aviso-seguranca') where exists (select 1 from cron.job where jobname = 'aviso-seguranca');
  perform cron.schedule('aviso-seguranca', '*/15 * * * *',
    $c$select public.aviso_seguranca_chamar() where exists (select 1 from public.avisos_seguranca where enviado_em is null and tentativas < 5 and criado_em > now() - interval '2 days')$c$);
end $$;

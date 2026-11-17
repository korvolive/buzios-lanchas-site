-- publicar: auto
-- Sistema de jet ski (Rodrigo 2026-11-17):
-- 1) todo jet ski é com chave de aprendiz (padrão, não é opção);
-- 2) o administrador pode pôr qualquer pessoa como dono de jet ski (busca pelo e-mail), mesmo sem lancha;
-- 3) o dono vê os aluguéis dele com "garantido, cai às HH:MM" (repasse 2 h antes da saída da lancha) e depois "recebido".
-- Idempotente, sem DROP/DELETE.

alter table public.jetskis alter column chave_aprendiz set default true;
update public.jetskis set chave_aprendiz = true where chave_aprendiz is distinct from true;
create or replace function public.tg_jetski_aprendiz()
returns trigger language plpgsql set search_path = public as $$
begin new.chave_aprendiz := true; return new; end $$;
create or replace trigger jetski_sempre_aprendiz before insert or update on public.jetskis
  for each row execute function public.tg_jetski_aprendiz();

-- administrador acha a pessoa pelo e-mail da conta (para pôr como dono do jet ski)
create or replace function public.usuario_por_email(p_email text)
returns table(user_id uuid, nome text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, coalesce(nullif(btrim(c.nome), ''), nullif(btrim(p.nome), ''), u.email::text)
  from auth.users u
  left join public.clientes c on c.user_id = u.id
  left join public.perfis p on p.user_id = u.id
  where public.e_admin() and lower(u.email) = lower(btrim(coalesce(p_email, '')))
  limit 1
$$;
revoke all on function public.usuario_por_email(text) from public, anon;
grant execute on function public.usuario_por_email(text) to authenticated;

-- aluguéis do dono do jet ski (o administrador vê todos): valor líquido e quando cai
create or replace function public.meus_jetski_alugueis()
returns table(jetski uuid, nome text, data date, ini time, fim time, lancha text, minutos int, cortesia_min int,
              neto numeric, situacao text, cai_em timestamp, recebido_em timestamptz)
language sql stable security definer set search_path = public as $$
  select u.jetski, j.nome, u.data, u.ini, u.fim, u.lancha, u.minutos, u.cortesia_min,
    nullif(coalesce(p.jetski_neto, u.neto), 0),
    case when p.jetski_repasse is not null and p.jetski_repasse <> 'asaas:enviando' then 'recebido'
         when p.jetski_repasse = 'asaas:enviando' then 'enviando'
         when coalesce(p.jetski_neto, u.neto, 0) = 0 then 'cortesia'
         when p.status = 'aprovado' then 'garantido'
         else 'aguardando' end,
    case when p.id is not null then public.inicio_combinado(p.data, p.horario, p.hora_ini, p.bloqueio_id) - interval '2 hours' end,
    p.jetski_repasse_em
  from public.jetski_usos u
  join public.jetskis j on j.id = u.jetski
  left join public.pedidos p on p.id = u.pedido_id
  where u.removido_em is null and u.tipo = 'uso'
    and u.data >= (now() at time zone 'America/Sao_Paulo')::date - 30
    and (j.dono = auth.uid() or public.e_admin())
  order by u.data, u.ini
$$;
revoke all on function public.meus_jetski_alugueis() from public, anon;
grant execute on function public.meus_jetski_alugueis() to authenticated;

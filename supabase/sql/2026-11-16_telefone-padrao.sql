-- (substituído por 2026-11-16_telefone-padrao-v2.sql: o banco recusou esta versão e nada mudou)
-- Telefone num padrão só (Rodrigo 2026-11-16, caso Antonio Falck): "+" e os dígitos, sem espaço, traço ou parênteses.
-- Ex.: "+55 (22) 98849-9888" e "+55 22-988499888" viram "+5522988499888".
-- Vale para as colunas de telefone com formato livre. As que já guardam só dígitos (vendedor_leads, cotacoes_garantidas,
-- ref_vendedor_tel, bz_cadastros e as tel_dig) ficam como estão, porque o banco compara esses dígitos direto.
create or replace function public._tel_padrao(t text)
returns text language sql immutable as $f$
  select case when regexp_replace(coalesce(t, ''), '\D', '', 'g') = '' then null
              else '+' || regexp_replace(t, '\D', '', 'g') end
$f$;

create or replace function public.tg_tel_padrao()
returns trigger language plpgsql as $f$
declare c text := tg_argv[0];
begin
  new := jsonb_populate_record(new, jsonb_build_object(c, public._tel_padrao(to_jsonb(new) ->> c)));
  return new;
end $f$;

-- daqui pra frente: todo cadastro e edição grava no padrão (nome com "a0_" para rodar antes das outras travas)
do $$
declare r record;
begin
  for r in select * from (values ('anotacoes','telefone'), ('clientes','whatsapp'), ('consultas','telefone'), ('convites','telefone'),
                                 ('creditos','telefone'), ('freelancers','telefone'), ('marinheiros','telefone'), ('perfis','telefone')) v(t, c)
  loop
    if to_regclass('public.' || r.t) is null then continue; end if;
    execute format('drop trigger if exists a0_tel_padrao on public.%I', r.t);
    execute format('create trigger a0_tel_padrao before insert or update of %I on public.%I for each row execute function public.tg_tel_padrao(%L)', r.c, r.t, r.c);
  end loop;
end $$;

-- os que já estão gravados: corrige sem disparar avisos, vínculos de vendedor nem fechamento de consultas
-- (desliga as regras da tabela só durante a correção; a auditoria continua registrando)
do $$
declare r record; n int; tot int := 0; tem_aud boolean;
begin
  for r in select * from (values ('anotacoes','telefone'), ('clientes','whatsapp'), ('consultas','telefone'), ('convites','telefone'),
                                 ('creditos','telefone'), ('freelancers','telefone'), ('marinheiros','telefone'), ('perfis','telefone')) v(t, c)
  loop
    if to_regclass('public.' || r.t) is null then continue; end if;
    select exists (select 1 from pg_trigger where tgrelid = ('public.' || r.t)::regclass and tgname = 'zz_auditar') into tem_aud;
    execute format('alter table public.%I disable trigger user', r.t);
    if tem_aud then execute format('alter table public.%I enable trigger zz_auditar', r.t); end if;
    execute format('update public.%I set %I = public._tel_padrao(%I) where %I is distinct from public._tel_padrao(%I)', r.t, r.c, r.c, r.c, r.c);
    get diagnostics n = row_count; tot := tot + n;
    raise notice 'telefone padrao: % -> % corrigidos', r.t, n;
    execute format('alter table public.%I enable trigger user', r.t);
  end loop;
  raise notice 'telefone padrao: total % corrigidos', tot;
end $$;

-- número com o país errado na varredura: convite de cliente dos EUA gravado com +55 na frente do +1 (o passeio dela tem +1)
update public.convites set telefone = '+17169086949', tel_dig = '17169086949'
 where regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = '5517169086949';

-- Comissão do link do vendedor = a do parceiro: 3% fixo (Rodrigo 2026-11-02). Sempre que uma mudar, a outra muda junto.
-- Os vendedores já foram passados para 3% (update feito por Claude em 2026-11-02); aqui ficam o padrão de quem vira vendedor e o salvar_pcts.
update public.vendedores set pcts = '{"baixa": 3, "media": 3, "alta": 3}'::jsonb where not coalesce(parceiro, false);
alter table public.vendedores alter column pcts set default '{"baixa": 3, "media": 3, "alta": 3}'::jsonb;

create or replace function public.salvar_pcts(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare pa boolean; out jsonb := '{"baixa": 3, "media": 3, "alta": 3}'::jsonb;
begin
  select parceiro into pa from vendedores where user_id = auth.uid() and ativo;
  if not found then raise exception 'Você não é vendedor'; end if;
  if pa then raise exception 'parceiro' using errcode = 'P0001'; end if;
  update vendedores set pcts = out where user_id = auth.uid(); -- a % do link é fixa em 3%, igual à do parceiro (Rodrigo 2026-11-02)
  return out;
end $function$;

notify pgrst, 'reload schema';

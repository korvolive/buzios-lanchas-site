-- Búzios Lanchas, 2026-11-16: consulta do site fecha sozinha quando vira pedido.
-- Quando nasce (ou muda o telefone de) um passeio com cliente (anotacoes.telefone) ou o Lucas/operador
-- lança uma consulta (criado_por), as consultas do site abertas do MESMO telefone (últimos 8 dígitos)
-- saem da lista: recusada_em + virou_pedido_em. Resgatar continua funcionando (limpa virou_pedido_em).
-- Não bloqueia nada: qualquer erro aqui é engolido e o passeio é salvo normalmente.

alter table public.consultas add column if not exists virou_pedido_em timestamptz;

create or replace function public._fechar_consultas_site(p_tel text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare d text := right(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), 8);
begin
  if length(d) < 8 then return; end if;
  update public.consultas
     set recusada_em = now(), recusa_auto = true, virou_pedido_em = now()
   where criado_por is null and recusada_em is null
     and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8) = d;
end $$;
revoke all on function public._fechar_consultas_site(text) from public, anon, authenticated;

create or replace function public.tg_fecha_consultas_site()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  begin
    if tg_table_name = 'anotacoes' then
      if new.telefone is not null and (tg_op = 'INSERT' or new.telefone is distinct from old.telefone) then
        perform public._fechar_consultas_site(new.telefone);
      end if;
    elsif new.criado_por is not null then
      perform public._fechar_consultas_site(new.telefone);
    end if;
  exception when others then null; -- nunca impede o lançamento
  end;
  return null;
end $$;
revoke all on function public.tg_fecha_consultas_site() from public, anon, authenticated;

create or replace trigger zz_anotacao_fecha_consultas after insert or update of telefone on public.anotacoes
  for each row execute function public.tg_fecha_consultas_site();

create or replace trigger zz_consulta_lancada_fecha_site after insert on public.consultas
  for each row when (new.criado_por is not null) execute function public.tg_fecha_consultas_site();

-- Resgatar (recusada_em volta a null) tira a marca de "virou pedido".
create or replace function public.tg_consulta_resgate_limpa_pedido()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.recusada_em is null then new.virou_pedido_em := null; end if;
  return new;
end $$;
create or replace trigger a_consulta_resgate_limpa_pedido before update of recusada_em on public.consultas
  for each row execute function public.tg_consulta_resgate_limpa_pedido();

-- Uma vez: consultas abertas de clientes que já têm passeio lançado depois da consulta.
update public.consultas c
   set recusada_em = now(), recusa_auto = true, virou_pedido_em = now()
 where c.criado_por is null and c.recusada_em is null
   and exists (select 1 from public.anotacoes a join public.bloqueios b on b.id = a.bloqueio_id
                where length(regexp_replace(coalesce(a.telefone, ''), '\D', '', 'g')) >= 8
                  and right(regexp_replace(a.telefone, '\D', '', 'g'), 8) = right(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), 8)
                  and b.criado_em > c.criado_em);

-- Revisão de segurança do PR #1007 (jetski no pedido do Lucas), 2026-11-16.
-- Achado: o gatilho zz_anotacao_jetski_segura pegava a consulta mais recente COM jetski do mesmo
-- telefone/lancha/dia/horário. Se o Lucas relançar o mesmo passeio sem jetski (ou a consulta com jetski
-- tiver sido recusada), a aprovação seguraria o jetski da consulta antiga e o cliente seria cobrado por ele.
-- Correção: decide a consulta mais recente NÃO recusada do cliente nesse passeio; se ela não tem jetski, nada.
-- Só troca a função (sem trava de tabela). Roda pelo conector.
create or replace function public.tg_anotacao_jetski_segura()
returns trigger language plpgsql set search_path = public as $$
declare b public.bloqueios; c public.consultas;
begin
  if new.origem is distinct from 'buzios' or current_user in ('authenticated', 'anon') then return null; end if;
  if length(regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g')) < 8 then return null; end if;
  select * into b from public.bloqueios where id = new.bloqueio_id;
  if b.id is null then return null; end if;
  select * into c from public.consultas x
   where x.lancha = b.lancha and x.data = b.data and x.horario = b.horario and x.recusada_em is null
     and regexp_replace(coalesce(x.telefone, ''), '\D', '', 'g') = regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g')
   order by x.id desc limit 1;
  if c.id is null or c.jetski is null then return null; end if;
  if exists (select 1 from public.jetski_usos u where u.bloqueio_id = b.id and u.removido_em is null) then return null; end if;
  perform public._jetski_segura(b.id, c);
  return null;
end $$;

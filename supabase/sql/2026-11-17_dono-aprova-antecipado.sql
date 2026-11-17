-- publicar: auto
-- Página do dono (/aprovar/): além do total que ele recebe, mostra quanto vem antecipado (do sinal pago pelo cliente)
-- e quanto ele recebe do cliente no dia do passeio (Rodrigo 2026-11-17). Mesma conta do repasse (definir_repasse):
-- no embarque = total do passeio - sinal; antecipado = líquido do dono - no embarque. Sinal combinado ou 50% do total.
create or replace function public.dono_aprovacao_ver(tok uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.aprovacoes_dono%rowtype; c public.consultas%rowtype; hoje date := (now() at time zone 'America/Sao_Paulo')::date; est text; nm text;
        neto numeric; tot numeric; sin numeric; emb numeric; ant numeric;
begin
  select * into a from public.aprovacoes_dono where token = tok;
  if a.id is null then return jsonb_build_object('estado', 'invalido'); end if;
  select nome into nm from public.lanchas where slug = a.lancha;
  select * into c from public.consultas where id = a.consulta_id;
  if c.id is null then
    est := case when exists (select 1 from public.bloqueios b join public.anotacoes n on n.bloqueio_id = b.id
                              where b.lancha = a.lancha and b.data = a.data and public.choca_horario(b.horario, a.horario)
                                and right(regexp_replace(coalesce(n.telefone, ''), '\D', '', 'g'), 8) = a.tel_fim)
                then 'aprovada' else 'resolvida' end;
  elsif c.recusada_em is not null then est := 'recusada';
  elsif c.data < hoje then est := 'vencida';
  else est := 'pendente';
  end if;
  if c.id is not null then
    neto := c.neto_garantido;
    if neto is null then begin neto := public.preco_neto_tabela(c.lancha, c.data, c.horario); exception when others then neto := null; end; end if;
    tot := c.valor;
    if tot is null then begin tot := public.preco_tabela(c.lancha, c.data, c.horario); exception when others then tot := null; end; end if;
    if tot > 0 and neto > 0 then
      sin := coalesce(nullif(c.sinal, 0), round(tot / 2));
      emb := greatest(tot - sin, 0);
      ant := neto - emb;
    end if;
  end if;
  return jsonb_build_object('estado', est, 'resposta', a.resposta, 'lancha', coalesce(nm, a.lancha), 'data', a.data, 'horario', a.horario,
    'hora_ini', c.hora_ini, 'hora_fim', c.hora_fim, 'pessoas', c.pessoas, 'cliente', nullif(split_part(coalesce(c.nome, ''), ' ', 1), ''),
    'neto', neto, 'antecipado', ant, 'embarque', emb);
end $$;
revoke all on function public.dono_aprovacao_ver(uuid) from public, anon, authenticated;
grant execute on function public.dono_aprovacao_ver(uuid) to service_role;

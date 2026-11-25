-- publicar: auto
-- 25/11/2026 (Rodrigo): o aviso ao dono de pré-reserva vencida (VPS, painel-worker/actions/aviso-dono-vencida.mjs)
-- só manda para o dono que tinha sido consultado. O painel entra como operador e não lê aprovacoes_dono (só admin):
-- esta leitura é só para admin/operador, sem o token do botão. Idempotente.
create or replace function public.aprovacoes_dono_por_datas(p_datas date[])
returns table(id bigint, consulta_id bigint, pedido_id bigint, dono uuid, lancha text, data date, horario text, slot text,
              tel_fim text, enviado_em timestamptz, envio text, resposta text, respondido_em timestamptz,
              fim_avisado_em timestamptz, fim_estado text, criado_em timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.consulta_id, a.pedido_id, a.dono, a.lancha, a.data, a.horario, a.slot,
         a.tel_fim, a.enviado_em, a.envio, a.resposta, a.respondido_em, a.fim_avisado_em, a.fim_estado, a.criado_em
    from public.aprovacoes_dono a
   where (public.e_admin() or coalesce(public.papel_painel() = 'operador', false))
     and a.data = any(coalesce(p_datas, '{}'::date[]))
     and cardinality(coalesce(p_datas, '{}'::date[])) <= 60
   order by a.id desc limit 500
$$;
revoke all on function public.aprovacoes_dono_por_datas(date[]) from public, anon;
grant execute on function public.aprovacoes_dono_por_datas(date[]) to authenticated;

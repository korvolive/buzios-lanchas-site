-- publicar: auto
-- Revisão minuciosa 22/11: horário real em edições e ao mover passeio. Idempotente, sem dado de cliente.
-- 1) O painel salva a anotação com upsert (POST merge-duplicates). No upsert o Postgres roda o gatilho BEFORE INSERT
--    antes do de UPDATE, então a exceção "passeio que já começou (atraso) continua livre" nunca valia e reserva antiga
--    sobreposta não podia ser editada. Agora linha que já existe passa direto pelo ramo INSERT e é conferida no UPDATE.
-- 2) Mover passeio conferia só o turno: agora confere também o horário real (antes de mexer em bloqueios).

create or replace function public.tg_anotacao_horario_real()
returns trigger language plpgsql security definer set search_path = public as $$
declare b public.bloqueios%rowtype; j int4range; hoje date := (now() at time zone 'America/Sao_Paulo')::date; agora int;
begin
  select * into b from public.bloqueios where id = new.bloqueio_id;
  if b.id is null or b.revenda is not null or b.data < hoje then return new; end if;
  -- upsert de edição do painel (POST merge-duplicates) roda primeiro o ramo INSERT: quem confere é o gatilho de UPDATE que vem em seguida
  if tg_op = 'INSERT' and exists (select 1 from public.anotacoes x where x.bloqueio_id = new.bloqueio_id) then return new; end if;
  if tg_op = 'INSERT' and b.horario = 'tarde' and (public._hm_min(new.hora_ini) is null or public._hm_min(new.hora_fim) is null) then
    j := public._janela_pedida(b.lancha, b.data, 'tarde', null, null, b.id);
    if j is not null and j <> int4range(840, 1080) then
      new.hora_ini := to_char(make_time(lower(j) / 60, lower(j) % 60, 0), 'HH24:MI');
      new.hora_fim := to_char(make_time((upper(j) / 60) % 24, upper(j) % 60, 0), 'HH24:MI');
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.hora_ini is not distinct from old.hora_ini and new.hora_fim is not distinct from old.hora_fim then return new; end if;
    agora := extract(hour from now() at time zone 'America/Sao_Paulo')::int * 60 + extract(minute from now() at time zone 'America/Sao_Paulo')::int;
    if b.data = hoje and lower(public._janela_pedida(b.lancha, b.data, b.horario, old.hora_ini, old.hora_fim, b.id)) <= agora then
      return new;
    end if;
  end if;
  if public._choca_janela(b.lancha, b.data, b.horario, new.hora_ini, new.hora_fim, b.id) then
    j := public._janela_pedida(b.lancha, b.data, b.horario, new.hora_ini, new.hora_fim, b.id);
    raise exception 'O horário das % às % cruza outra reserva da lancha % nesse dia',
      to_char(make_time((lower(j) / 60) % 24, lower(j) % 60, 0), 'HH24:MI'),
      to_char(make_time((upper(j) / 60) % 24, upper(j) % 60, 0), 'HH24:MI'), b.lancha
      using errcode = '23P01';
  end if;
  return new;
end $$;

-- mover passeio: mesma conferência do horário real (mesmo turno mantém o horário anotado; turno novo usa o padrão)
do $do$
declare f text; sig text;
begin
  foreach sig in array array['public.mover_passeio(bigint,text,date,text)', 'public.mover_passeio_v2(bigint,text,date,text,uuid)'] loop
    f := pg_get_functiondef(sig::regprocedure);
    if position('_choca_janela' in f) = 0 then
      f := replace(f, $a$    raise exception 'Esse horário já está ocupado nessa lancha';
  end if;
$a$, $a$    raise exception 'Esse horário já está ocupado nessa lancha';
  end if;
  if public._choca_janela(nova_lancha, nova_data, novo_horario,
       case when novo_horario = b.horario then a.hora_ini end,
       case when novo_horario = b.horario then a.hora_fim end, bid) then
    raise exception 'Esse horário cruza outra reserva da lancha nesse dia';
  end if;
$a$);
      if position('_choca_janela' in f) = 0 then raise exception 'mover: trecho não encontrado em %', sig; end if;
      execute f;
    end if;
  end loop;
end $do$;

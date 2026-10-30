-- Operador (Lucas) lança pedido pendente para o Rodrigo aprovar (Rodrigo 2026-10-30)
-- O pedido entra como uma consulta já respondida no WhatsApp (chamou = true), marcada com quem lançou (criado_por).
-- Aparece em Reservas › Pendentes › Consultas, com o botão Aprovar do administrador, que cria o passeio e manda o convite por e-mail.
-- O operador não aprova, não libera pagamento e não mexe em valores nem na agenda.
-- Pode rodar de novo sem problema.

alter table public.consultas add column if not exists criado_por uuid references auth.users(id) on delete set null;
-- a tabela usa permissão por coluna: sem isto a lista de consultas do painel pararia de abrir
grant select (criado_por) on public.consultas to authenticated;

create or replace function public.lancar_pedido_operador(p_lancha text, p_data date, p_horario text, p_pessoas integer,
  p_nome text, p_tel text, p_email text, p_lang text, p_embarque text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare nid bigint; dig text := regexp_replace(coalesce(p_tel,''), '\D', '', 'g');
begin
  if not (public.e_admin() or coalesce(public.papel_painel() = 'operador', false)) then raise exception 'Sem acesso'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 or position(' ' in trim(p_nome)) = 0 or length(p_nome) > 120 then raise exception 'nome'; end if;
  if length(dig) < 10 or length(dig) > 16 then raise exception 'telefone'; end if;
  if coalesce(p_email,'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'email'; end if;
  if p_data < current_date or p_data > current_date + 800 then raise exception 'data'; end if;
  -- a lancha tem que existir na tabela lanchas
  if not exists (select 1 from public.lanchas where slug = p_lancha) then raise exception 'lancha'; end if;
  -- só manhã, tarde ou dia todo
  if coalesce(p_horario,'') not in ('manha','tarde','dia') then raise exception 'horario'; end if;
  if p_pessoas is null or p_pessoas < 1 or p_pessoas > 100 or length(coalesce(p_embarque,'')) > 120 then raise exception 'dados'; end if;
  if (select count(*) from public.consultas where criado_por = auth.uid() and criado_em > now() - interval '1 day') >= 60 then raise exception 'limite'; end if;
  -- mesmo cliente, mesma lancha e mesmo dia: só atualiza a consulta que o próprio operador lançou;
  -- a que o cliente mandou pelo site (criado_por vazio) fica como está, e o pedido do operador entra como uma nova
  update public.consultas set horario = p_horario, pessoas = p_pessoas, embarque = nullif(trim(coalesce(p_embarque,'')),''), nome = trim(p_nome),
         email = lower(trim(p_email)), chamou = true, wa_resposta_em = coalesce(wa_resposta_em, now())
   where criado_por is not null and regexp_replace(telefone,'\D','','g') = dig and lancha = p_lancha and data = p_data returning id into nid;
  if nid is not null then return nid; end if;
  insert into public.consultas (chamou, wa_resposta_em, criado_por, lancha, data, horario, pessoas, embarque, nome, telefone, email, lang)
    values (true, now(), auth.uid(), p_lancha, p_data, p_horario, p_pessoas, nullif(trim(coalesce(p_embarque,'')),''), trim(p_nome), trim(p_tel),
            lower(trim(p_email)), case when p_lang in ('pt','en','es') then p_lang else 'pt' end)
    returning id into nid;
  return nid;
end $$;
revoke all on function public.lancar_pedido_operador(text, date, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.lancar_pedido_operador(text, date, text, integer, text, text, text, text, text) to authenticated;

-- conferência
select 'coluna criado_por: ' || count(*) from information_schema.columns where table_name = 'consultas' and column_name = 'criado_por'
union all
select 'função: ' || count(*) from pg_proc where proname = 'lancar_pedido_operador';

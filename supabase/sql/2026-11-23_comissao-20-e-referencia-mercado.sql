-- publicar: auto
-- Rodrigo 2026-11-23:
-- 1) Comissão padrão da Búzios para embarcações NOVAS: de 15% para 20% do líquido do dono, com mínimo de R$ 300.
--    As 11 lanchas que já estavam no site em 19/11 continuam no padrão antigo de 10% (e quem tem % própria mantém a sua).
--    Miss Bardot continua 0%. Hoje não existe nenhuma lancha nova com % padrão, então nenhum preço muda agora.
--    O painel (login/index.html: TAXA_BUZIOS, TAXA_MIN) e a Bordazul /anunciar usam a mesma regra. Jetski não muda (15%).
-- 2) Tabela de referência de mercado (preços que os concorrentes anunciam), só o administrador lê e grava.
--    O card "Valores da lancha" mostra as lanchas parecidas (pés e pessoas) para não ficar mais caro que a concorrência.
-- Idempotente.

create or replace function public.taxa_buzios(l text, neto numeric)
 returns integer
 language sql
 immutable
 set search_path to 'public'
as $function$ select case
  when neto is null or neto <= 0 then null
  when l = 'miss-bardot' then 0
  -- lanchas cadastradas até 19/11/2026: padrão antigo de 10%
  when l in ('angela','bubbles','chefe','compostela','gratidao','jc-pescador-buzios','les-zuzu','midas','pura-vida','spartana','vem-verao')
    then (round(neto * 0.10 / 10) * 10)::int
  -- novas (desde 23/11/2026): 20%, mínimo de R$ 300
  else greatest((round(neto * 0.20 / 10) * 10)::int, 300) end $function$;

create table if not exists public.referencia_mercado (
  id bigint generated always as identity primary key,
  operador text not null check (length(operador) between 1 and 80),
  descricao text not null check (length(descricao) between 1 and 120),
  pes numeric(4,1) check (pes is null or pes between 10 and 150),
  pessoas int check (pessoas is null or pessoas between 1 and 200),
  preco4 int check (preco4 is null or preco4 between 100 and 100000),
  preco7 int check (preco7 is null or preco7 between 100 and 100000),
  a_partir_de boolean not null default true,
  obs text check (obs is null or length(obs) <= 300),
  fonte text check (fonte is null or (fonte ~ '^https://' and length(fonte) <= 300)),
  visto_em date not null default current_date,
  atualizado_em timestamptz not null default now(),
  unique (operador, descricao)
);
alter table public.referencia_mercado enable row level security;
revoke all on public.referencia_mercado from anon;
grant select, insert, update, delete on public.referencia_mercado to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='referencia_mercado' and policyname='referencia_mercado: admin') then
    create policy "referencia_mercado: admin" on public.referencia_mercado for all to authenticated using (public.e_admin()) with check (public.e_admin());
  end if;
end $$;

-- preços anunciados vistos em 23/11/2026 (páginas indexadas no Google; concorrentes mostram "a partir de", sem temporada)
insert into public.referencia_mercado (operador, descricao, pes, pessoas, preco4, preco7, a_partir_de, obs, fonte, visto_em) values
 ('Búzios Trip Tour','Lancha 22 pés até 6 pessoas',22,6,1700,null,true,'Feriados, Réveillon e Carnaval sob consulta','https://buziostriptour.com/lancha/aluguel-de-lancha-6-pessoas/','2026-11-23'),
 ('Búzios Trip Tour','Lancha 26 pés até 9 pessoas',26,9,1700,null,true,null,'https://buziostriptour.com/lancha/lancha-de-26-pes-ate-9-pessoas-a-partir-de-r-1-700','2026-11-23'),
 ('Búzios Trip Tour','Lancha 26 pés até 11 pessoas',26,11,2300,3000,true,null,'https://buziostriptour.com/lancha/lancha-de-26-pes-ate-11-pessoas-a-partir-de-rs1600/','2026-11-23'),
 ('Búzios Trip Tour','Lancha luxo 28 pés até 9 pessoas',28,9,2500,4200,true,null,'https://buziostriptour.com/lancha/aluguel-lancha-26-pes-ate-10-passageiros-a-partir-de-1-750','2026-11-23'),
 ('Búzios Trip Tour','Lancha 30 pés até 10 pessoas',30,10,2000,2700,true,null,'https://buziostriptour.com/lancha/lancha-de-30-pes-ate-10-pessoas-a-partir-de-r-1900/','2026-11-23'),
 ('Búzios Trip Tour','Lancha 30 pés até 15 pessoas',30,15,2600,3300,true,null,'https://buziostriptour.com/lancha/lancha-de-30-pes-ate-15-pessoas','2026-11-23'),
 ('Búzios Trip Tour','Lancha 32 pés até 12 pessoas',32,12,2500,3500,true,'Listagem geral diz a partir de 2.700','https://buziostriptour.com/lancha/alugue-lancha-2-andares/','2026-11-23'),
 ('Búzios Trip Tour','Lancha 38 pés até 16 pessoas',38,16,2400,3400,true,'Outra página do mesmo barco: 2.700 / 3.900','https://buziostriptour.com/lancha/lancha-de-38-pes-ate-16-pessoas-a-partir-de-r-2-300/','2026-11-23'),
 ('Viva Lagos Tours','Coral 24 pés até 8 pessoas',24,8,1700,2600,true,null,'https://vivalagostours.com/lanchas-em-buzios/','2026-11-23'),
 ('Viva Lagos Tours','Nhoa 38 pés até 16 pessoas',38,16,2900,4900,false,null,'https://vivalagostours.com/aluguel-de-lancha-nhoa-38-pes-em-buzios-para-ate-16-pessoas/','2026-11-23'),
 ('Viva Lagos Tours','Marzulo 41 pés até 24 pessoas',41,24,2900,4900,false,'Marinheiro e churrasco incluídos','https://vivalagostours.com/aluguel-de-lancha-marzulo-41-pes-em-buzios-ate-24-pessoas/','2026-11-23'),
 ('Viva Lagos Tours','Lancha 45 pés dois andares até 24 pessoas',45,24,3400,4200,false,null,'https://vivalagostours.com/aluguel-de-lancha-em-buzios-45-pes-com-dois-andares-para-ate-24-pessoas/','2026-11-23'),
 ('Navegue Temporada','Coral 24 Be Happy II até 8 pessoas',24,8,1600,null,true,'Taxa de embarque R$ 5 por pessoa','https://naveguetemporada.com/tour/lancha-coral-24-0213/','2026-11-23'),
 ('Navegue Temporada','Focker 240 Open Hórus até 10 pessoas',24,10,1700,null,false,'Hora adicional R$ 315','https://naveguetemporada.com/tour/lancha-focker-240-open-0288/','2026-11-23'),
 ('Navegue Temporada','Tecnoboat 26 Fun Sea até 7 pessoas',26,7,1700,null,true,null,'https://naveguetemporada.com/tour/lancha-tecnoboat-26-0216/','2026-11-23'),
 ('Navegue Temporada','Coral 26 Bubbles até 11 pessoas',26,11,2250,null,false,'Mesma lancha do nosso site. Réveillon 2.500','https://naveguetemporada.com/tour/lancha-coral-26-0338/','2026-11-23'),
 ('Navegue Temporada','Focker 21.5 Compostela até 6 pessoas',21.5,6,2000,null,true,'Mesma lancha do nosso site','https://naveguetemporada.com/tour/lancha-focker-21-5-0261/','2026-11-23'),
 ('Navegue Temporada','CF 34 Golden Fish V até 16 pessoas',34,16,1800,3000,true,null,'https://naveguetemporada.com/tour/lancha-cf-34','2026-11-23'),
 ('Navegue Temporada','Coral 32 Santhiago',32,null,3250,null,false,'Manhã','https://naveguetemporada.com/tour/lancha-coral-32-0219/','2026-11-23'),
 ('Tropical Búzios','Coral 23 pés até 8 pessoas',23,8,1490,null,false,null,'https://www.tropicalbuzios.com/lanchas-privativas','2026-11-23'),
 ('Tropical Búzios','Coral 24 pés até 8 pessoas',24,8,1590,null,false,null,'https://www.tropicalbuzios.com/lanchas-privativas','2026-11-23'),
 ('Tropical Búzios','Focker 26 pés até 11 pessoas',26,11,2100,null,false,null,'https://www.tropicalbuzios.com/lanchas-privativas','2026-11-23'),
 ('Tropical Búzios','CF 34 pés até 16 pessoas',34,16,1890,null,false,'Página também mostra 2.790 por 6h','https://www.tropicalbuzios.com/cf34pes','2026-11-23'),
 ('Conexão Búzios','Lancha privativa até 11 pessoas',null,11,2590,3400,false,null,'https://www.conexaobuzios.com/pt/experiencias/passeio-lancha','2026-11-23'),
 ('RL Trips','Lancha 36 pés até 15 pessoas',36,15,2700,null,true,null,'https://rltrips.com/lanchas-buzios','2026-11-23'),
 ('RL Trips','Lancha 40 pés até 16 pessoas',40,16,null,3000,true,null,'https://rltrips.com/lanchas-buzios','2026-11-23')
on conflict (operador, descricao) do nothing;

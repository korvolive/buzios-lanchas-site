-- publicar: auto
-- Referência de mercado (2026-11-23): o Diretor abriu os sites dos concorrentes hoje.
-- Tropical Búzios: domínio estacionado, os preços vinham de páginas antigas do Google -> sai da referência.
-- Acrescenta os preços que o Diretor viu e completa o 7h de duas lanchas da Navegue. Idempotente.

delete from public.referencia_mercado where operador = 'Tropical Búzios';

insert into public.referencia_mercado (operador, descricao, pes, pessoas, preco4, preco7, a_partir_de, obs, fonte, visto_em) values
 ('Búzios Trip Tour','Lancha 27,5 pés até 10 pessoas',27.5,10,2100,2700,true,'Visto pelo Diretor no site','https://buziostriptour.com/lanchas/','2026-11-23'),
 ('Búzios Trip Tour','Lancha 34 pés até 16 pessoas',34,16,2000,3000,true,'Visto pelo Diretor no site','https://buziostriptour.com/lanchas/','2026-11-23'),
 ('Viva Lagos Tours','Coral 21 pés até 7 pessoas',21,7,1500,null,true,'Visto pelo Diretor no site','https://vivalagostours.com/lanchas-em-buzios/','2026-11-23'),
 ('Viva Lagos Tours','CF 34 pés até 16 pessoas',34,16,1800,null,true,'Visto pelo Diretor no site','https://vivalagostours.com/lanchas-em-buzios/','2026-11-23'),
 ('Viva Lagos Tours','26 pés com piscina inflável (Bubbles) até 11 pessoas',26,11,2300,null,true,'Mesma lancha do nosso site. Visto pelo Diretor','https://vivalagostours.com/lanchas-em-buzios/','2026-11-23'),
 ('RL Trips','Real 25 pés até 7 pessoas',25,7,null,2700,true,'Exceto feriados e alta. Visto pelo Diretor','https://rltrips.com/lanchas-buzios','2026-11-23'),
 ('RL Trips','Giroleia 32 pés até 11 pessoas',32,11,null,3800,true,'Exceto feriados e alta. Visto pelo Diretor','https://rltrips.com/lanchas-buzios','2026-11-23')
on conflict (operador, descricao) do nothing;

update public.referencia_mercado set preco7 = 3500, obs = 'Mesma lancha do nosso site. 7h visto pelo Diretor', atualizado_em = now()
 where operador = 'Navegue Temporada' and descricao = 'Focker 21.5 Compostela até 6 pessoas' and preco7 is distinct from 3500;
update public.referencia_mercado set preco7 = 4400, obs = 'Manhã. 7h visto pelo Diretor', atualizado_em = now()
 where operador = 'Navegue Temporada' and descricao = 'Coral 32 Santhiago' and preco7 is distinct from 4400;

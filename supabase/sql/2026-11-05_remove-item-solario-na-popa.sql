-- Rodrigo 2026-11-05: o item "Solário na popa" sai de todas as lanchas (não precisa informar). JÁ APLICADO por Claude.
update itens set opcionais = array_remove(opcionais,'Solário na popa'), atualizado_em = now() where 'Solário na popa' = any(opcionais);
-- e a menção nas frases/descrições de les-zuzu, gratidao, jc-pescador-buzios e angela (PT/EN/ES) foi retirada (replace no texto de lanchas.dados).
-- Parte 2 (Rodrigo 2026-11-05 "pode alterar"), JÁ APLICADA: descrição da Compostela sem "solário na proa"; legenda da foto lz-03 da Les Zuzu passou de "Solário na popa" para "Popa da lancha".

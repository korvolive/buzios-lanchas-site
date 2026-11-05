-- Rodrigo 2026-11-05: o item "Solário na popa" sai de todas as lanchas (não precisa informar). JÁ APLICADO por Claude.
update itens set opcionais = array_remove(opcionais,'Solário na popa'), atualizado_em = now() where 'Solário na popa' = any(opcionais);
-- e a menção nas frases/descrições de les-zuzu, gratidao, jc-pescador-buzios e angela (PT/EN/ES) foi retirada (replace no texto de lanchas.dados).

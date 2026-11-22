-- publicar: auto
-- Revisão minuciosa 22/11 (Rodrigo: "pode apagar o grok sim"): conta antiga do Grok (papel auditor, nunca entrou) ainda podia ler
-- CPF, WhatsApp e chaves Pix. Apaga só ela, só se nunca entrou. Se algo ainda apontar para ela, não derruba o resto do envio.
do $$
begin
  delete from auth.users where id = '41f1cb91-305c-43cd-9c42-21ffdcfd5320' and email like '%@mail.grokbot.com' and last_sign_in_at is null;
exception when others then
  raise notice 'conta do Grok não apagada: %', sqlerrm;
end $$;

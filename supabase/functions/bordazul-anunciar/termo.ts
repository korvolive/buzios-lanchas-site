// Termo de parceria do dono (Bordazul). Rodrigo aprovou em 2026-11-16 ("pode subir esse termo").
// Mudou o texto? Troque VERSAO: o dono assina de novo (o hash da versão assinada fica gravado no cadastro).
export const VERSAO = "2026-11-16";

export type Dados = Record<string, any>;
const v = (x: unknown, alt = "[a preencher]") => (x === undefined || x === null || String(x).trim() === "" ? alt : String(x).trim());

export function termo(d: Dados, tel: string): { h: string; ps: string[] }[] {
  const doc = v(d.doc_dono);
  return [
    { h: "1. Partes e objeto", ps: [
      `1.1. De um lado, BORDAZUL, marca da BÚZIOS LANCHAS, que opera o site bordazul.com.br e seus aplicativos ("Bordazul"). De outro, ${v(d.nome_dono)}, CPF ou CNPJ ${doc}, WhatsApp ${v(tel)}, e-mail ${v(d.email, "não informado")} ("Dono").`,
      `1.2. Este termo regula o anúncio da embarcação ${v(d.nome_lancha)}, inscrição na Marinha (TIE) nº ${v(d.tie)}, ${v(d.pes)} pés, capacidade de ${v(d.cap)} pessoas, com embarque em ${v(d.embarque)}, ${v(d.cidade_nome)} ("Lancha"), para passeios privativos com marinheiro vendidos pelo Bordazul.`,
      "1.3. O Bordazul é um intermediário: divulga a Lancha, recebe as reservas e o sinal e conecta o cliente ao Dono. Quem presta o passeio é o Dono, com a Lancha e a tripulação dele. O Bordazul não é dono, locador, armador nem operador da Lancha.",
      "1.4. Este termo não cria vínculo de emprego, sociedade ou representação entre as partes. O Dono pode anunciar a Lancha em outros lugares, desde que mantenha a agenda do Bordazul em dia.",
    ] },
    { h: "2. Declarações e obrigações do Dono", ps: [
      "2.1. O Dono declara que é proprietário da Lancha ou tem autorização por escrito do proprietário para anunciá-la e explorá-la em passeios.",
      "2.2. O Dono garante, em todos os passeios: (a) Lancha em perfeito estado de funcionamento, com motores, casco, parte elétrica e equipamentos revisados; (b) todos os itens de segurança exigidos pela Marinha do Brasil (NORMAM) para a categoria da Lancha, em quantidade suficiente para o número de pessoas a bordo, incluindo coletes salva-vidas para todos, extintores e demais itens obrigatórios; (c) documentação da Lancha regular e válida e seguro obrigatório DPEM em dia; (d) condução sempre por marinheiro habilitado na categoria exigida (Arrais-Amador, Mestre-Amador ou superior, conforme a Lancha e a navegação), sóbrio e em condições de conduzir; (e) respeito à capacidade máxima de pessoas, às regras da Capitania dos Portos e às regras locais de cada praia, ilha ou área protegida; (f) cancelamento ou remarcação sempre que o mar ou o tempo não permitirem navegar com segurança, avisando o Bordazul na hora.",
      "2.3. O Dono envia ao Bordazul os documentos da Lancha, o seguro e a habilitação do marinheiro, e os envia de novo sempre que vencerem ou mudarem. Documento vencido tira a Lancha do ar até a regularização.",
      "2.4. As fotos, os itens a bordo e as informações do anúncio são verdadeiros e mostram a Lancha como ela está hoje. O Dono mantém a agenda atualizada e não aceita outro passeio no mesmo horário de uma reserva do Bordazul.",
      "2.5. O Dono trata os clientes com respeito, cumpre o horário e o roteiro combinados e entrega o passeio com a mesma Lancha anunciada. Trocar de embarcação só com a concordância do cliente e do Bordazul.",
    ] },
    { h: "3. Preço, comissão, pagamentos e cancelamento", ps: [
      "3.1. O Dono define o valor neto de cada passeio no painel, dentro da faixa de preço mostrada para a cidade e o tamanho da Lancha. O valor neto é o que o Dono recebe.",
      "3.2. O Bordazul soma ao valor neto a sua comissão, no percentual mostrado no painel na data da reserva. O cliente vê e paga o valor final. Mudança no percentual só vale para reservas novas, com aviso no painel.",
      "3.3. O cliente paga 50% de sinal pelo Bordazul. Na hora do pagamento, o sistema de pagamentos divide o sinal automaticamente: a parte do Dono vai para a conta de recebimento dele e a comissão fica com o Bordazul. O restante é pago pelo cliente diretamente ao Dono no embarque.",
      "3.4. O Dono mantém a conta de recebimento ativa e com os dados corretos. O Bordazul não responde por atraso causado por dados errados ou conta bloqueada.",
      "3.5. Cancelamento pelo cliente: segue a política mostrada na página de pagamento. Hoje: crédito válido por 1 ano; devolução total com 7 dias ou mais de antecedência; com menos de 7 dias, ficam retidos 20% do sinal, salvo se a data for vendida para outro cliente. Os valores retidos são divididos entre Dono e Bordazul na mesma proporção do sinal.",
      "3.6. Mar ou tempo sem segurança: o passeio é remarcado sem custo. Se não houver nova data possível, o cliente recebe o sinal de volta e a parte do Dono é estornada.",
      "3.7. Cancelamento pelo Dono ou Lancha sem condições: o Bordazul oferece ao cliente outra embarcação equivalente ou devolve 100% do sinal. A parte do Dono é estornada e, se houver custo extra para recolocar o cliente, ele pode ser descontado de valores futuros do Dono. Cancelamentos repetidos levam à suspensão da Lancha.",
    ] },
    { h: "4. Responsabilidade, anúncio, suspensão e prazo", ps: [
      "4.1. O Dono é o único responsável pela Lancha, pela tripulação, pela navegação e pela segurança das pessoas a bordo, e responde por acidentes, danos, multas e autuações ligados ao passeio. Se o Bordazul for cobrado por algo que é responsabilidade do Dono, o Dono reembolsa o Bordazul, incluindo custos de defesa.",
      "4.2. O Bordazul pode recusar, pausar ou retirar o anúncio, sem multa, se: algum documento vencer ou for falso; a Lancha não corresponder ao anúncio; a nota média dos clientes ficar abaixo de 4; houver reclamação grave de segurança; o Dono cancelar passeios com frequência; ou o Dono tentar levar para fora do Bordazul um cliente que chegou por ele.",
      "4.3. O Dono autoriza o Bordazul a usar as fotos, os vídeos, o nome e os dados da Lancha no site, nos aplicativos, nas redes sociais e em anúncios, enquanto a Lancha estiver anunciada e por até 6 meses depois, apenas para divulgar o Bordazul.",
      "4.4. Os dados do Dono são usados só para o cadastro, os pagamentos, a análise e o contato sobre reservas, conforme a Lei Geral de Proteção de Dados (LGPD) e a política de privacidade do site. Os dados do cliente recebidos pelo Dono só podem ser usados para realizar o passeio.",
      "4.5. Este termo vale por 12 meses a partir da assinatura e se renova com nova assinatura no painel. Qualquer parte pode encerrá-lo a qualquer momento pelo painel ou por WhatsApp, mas as reservas já pagas devem ser cumpridas.",
      "4.6. Quando o texto deste termo mudar, o Dono é avisado e assina a nova versão no painel. Sem a nova assinatura, a Lancha sai do ar até ele assinar.",
      "4.7. Fica eleito o foro da comarca de Armação dos Búzios (RJ) para resolver qualquer questão deste termo.",
    ] },
  ];
}

export const ACEITES = [
  "Sou o proprietário da Lancha ou tenho autorização por escrito dele.",
  "A Lancha está em perfeito funcionamento e com todos os itens de segurança exigidos pela Marinha.",
  "Os documentos da Lancha e o seguro DPEM estão em dia, e vou mantê-los assim.",
  "Todo passeio será conduzido por marinheiro habilitado na categoria exigida.",
  "As fotos e as informações do anúncio são verdadeiras.",
  "Conheço a política de cancelamento e a comissão do Bordazul.",
  "Sou o único responsável pela Lancha, pela tripulação e pela segurança a bordo.",
];

export const ASSINATURA = "Ao digitar meu nome completo e CPF e confirmar o código enviado ao meu WhatsApp, assino este termo eletronicamente e concordo com todo o seu conteúdo, nos termos do art. 10, § 2º, da MP 2.200-2/2001 e da Lei 14.063/2020.";

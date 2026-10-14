// Textos iniciais dos documentos da entrega de chaves do Murano.
// A equipe edita depois em /admin/documentos; estes valores só entram na primeira vez.
// Variáveis entre {{ }} são preenchidas no dia da entrega.

export const TIPO_TERMO = 'termo_entrega_chaves';
export const TIPO_CHECKLIST = 'checklist';

/** Variáveis fixas do empreendimento (editáveis em /admin/documentos). */
export const VARIAVEIS_EMPREENDIMENTO = [
  { chave: 'dataConclusaoObras', rotulo: 'Data de conclusão das obras' },
  { chave: 'numeroCertidao', rotulo: 'Nº da certidão de habite-se' },
  { chave: 'dataAssembleia', rotulo: 'Data da Assembleia Geral de Instalação' },
  { chave: 'dataVistoriaInicio', rotulo: 'Início da vistoria (comissão)' },
  { chave: 'dataVistoriaFim', rotulo: 'Fim da vistoria (comissão)' }
];

export const TERMO_PADRAO = `TERMO DE ENTREGA DE CHAVES
CONDOMÍNIO MURANO RESIDENCIAL
ENDEREÇO: Est. dos Bandeirantes, 9235
BLOCO: {{bloco}}
UNIDADE: {{unidade}}
PROPRIETÁRIO(S): {{proprietarios}}

1. Por força da Escritura Pública de Contrato de Construção por Administração e Outros Pactos assinada, o(s) INVESTIDOR(ES), acima nominado(s), contratou(aram) a M1 EMPREENDIMENTOS IMOBILIÁRIOS SPE LTDA, inscrita no CNPJ/MF sob o n° 49.181.195/0001-02, doravante denominada apenas "construtora", conforme cláusulas e condições estipuladas.
2. Observadas as melhores normas técnicas construtivas, o Bloco {{bloco}} do MURANO RESIDENCIAL teve suas obras concluídas em {{dataConclusaoObras}} com a devida emissão da certidão de conclusão de obras ("habite-se") pela Secretaria Municipal de Desenvolvimento Urbano e Licenciamento, conforme Certidão nº {{numeroCertidao}}.
3. Diante da emissão do "habite-se" e da realização da Assembleia Geral de Instalação no dia {{dataAssembleia}}, que formalizou a entrega e instalação do bloco {{bloco}} do condomínio MURANO RESIDENCIAL, pelo presente termo, o(s) INVESTIDOR(ES) declara(m) receber, nesta data, as chaves do imóvel acima referido e as correspondentes áreas comuns devidamente vistoriadas pela comissão de representantes entre os dias {{dataVistoriaInicio}} e {{dataVistoriaFim}}.
4. Além das chaves do imóvel, o(s) INVESTIDOR(ES) declara(m) receber, nessa mesma data, o manual do proprietário através de QR Code fixado no quadro de energia da unidade, sendo certo que o acesso ao referido manual também poderá ser realizado pelo site: https://manual1.com.br/manuais/lot3/Calper/Murano/ utilizando o código de acesso nº 762051;
5. Considerando a realização da vistoria da unidade, o(s) INVESTIDOR(ES) declara(m) que todas as obrigações constantes do contrato firmado para a efetiva entrega das chaves foram cumpridas e a unidade encontra-se apta, segura e habitável;
6. O(s) INVESTIDOR(ES) declara(m) ciência de que, nos termos Escritura Pública de Promessa de Compra e Venda e legislação vigente, obriga(m)-se, na proporção do coeficiente de rateio à que corresponderá a sua unidade autônoma ao pagamento de todas e quaisquer despesas condominiais, tais como, exemplificativamente, mas não se limitando, aos salários e encargos sociais dos funcionários, contas de luz e água, manutenção dos elevadores, IPTU, limpeza, segurança e outras rubricas necessárias ao bom funcionamento do empreendimento, tudo em conformidade com a convenção de condomínio, regulamento interno e demais aprovações em assembleias, bem como se obriga(m), na proporção de seu coeficiente de rateio, nas despesas dos custos complementares decorrentes do contrato de construção, se ainda não quitadas;
7. O(s) INVESTIDOR(ES) tem ciência de que a partir da data constante na certidão de conclusão de obras ("habite-se") passam a correr os prazos de garantia da unidade e respectivas áreas comuns e que eventuais solicitações neste sentido deverão ser encaminhadas para a assistência técnica da construtora através do e-mail: crc@calper.com.br
8. O(s) INVESTIDOR(ES) tem ciência de que, em relação à sua unidade, todas as instalações foram executadas de acordo com projetos aprovados, normas vigentes e com as respectivas aprovações das concessionárias de serviços públicos.
9. O(s) INVESTIDOR(ES) tem ciência de que a instalação individual dos medidores de luz, força e gás é de sua exclusiva responsabilidade, devendo fazer as devidas solicitações diretamente às concessionárias públicas (Light e Naturgy).
10. O(s) INVESTIDOR(ES) tem ciência, ainda, de que todas e quaisquer alterações das condições físicas originais do imóvel que vierem a ser por ele(s) introduzidas serão de sua exclusiva responsabilidade, ficando a construtora totalmente isenta de quaisquer danos, aparentes ou não, ocasionados ao imóvel, ressaltando que obras e modificações no imóvel deverão seguir os procedimentos e regramentos contidos na convenção de condomínio e legislação vigente.
11. Com a ressalva constante das garantias legalmente conferidas ao imóvel, o(s) INVESTIDOR(ES) dá(ão) à construtora, plena, rasa, geral e irrevogável quitação, ratificando que foram cumpridas as obrigações contratuais assumidas, bem como qualquer obrigação decorrente de instrumentos relativos ao negócio em referência, declarando, ainda, que nada mais tem a reclamar ou pleitear, seja a que título for, agora ou no futuro, dando-se por plenamente satisfeito.

Diante de todo o exposto, o(s) INVESTIDOR(ES) declara(m) receber a posse direta e definitiva do imóvel em epígrafe. O presente é firmado em duas vias de um só teor.

Rio de Janeiro, {{dataAssinatura}}.

[ASSINATURA DO INVESTIDOR: {{assinante}}]

[ASSINATURA: M1 EMPREENDIMENTOS IMOBILIÁRIOS SPE LTDA]`;

// Itens do checklist: linhas "N. descrição — Qtde. valor". Linha sem "— Qtde." não tem quantidade.
// {{chavesInterior}} é calculada a partir de Unidade.quartos (2 → 4, 3 → 6; vazio se não informado).
export const CHECKLIST_PADRAO = `CHECKLIST — ENTREGA DE CHAVES
CONDOMÍNIO MURANO RESIDENCIAL
BLOCO: {{bloco}}
UNIDADE: {{unidade}}
PROPRIETÁRIO(S): {{proprietarios}}

Declaro ter recebido da M1 EMPREENDIMENTOS IMOBILIÁRIOS SPE LTDA. os itens e documentos relacionados abaixo:

1. Chave Porta Principal - Fechadura Biométrica Instalada (Kit com 02 chaves + 02 Cards de abertura + 01 manual) — Qtde. 1
2. Chave Porta Interior (quarto e suíte - 2 chaves cada) — Qtde. {{chavesInterior}}
3. Chave de emergência para banheiros — Qtde. 1
4. Arejador - Torneira da Cozinha — Qtde. 1
5. Arejador - Torneira dos Banheiros — Qtde. 2
6. Tampa Metálica - Cuba da Pia da Cozinha — Qtde. 1
7. Tampa Plástica - Tanque e Banheiros — Qtde. 3
8. Acesso ao Manual do Proprietário, Garantias e plantas (fixado no Quadro de energia da unidade): https://manual1.com.br/manuais/lot3/Calper/Murano/ - código de acesso nº 762051
9. Folheto com orientação para Instalação do APP do Condomínio — Qtde. 1
10. Termo de Entrega de Chaves — Qtde. 1

Rio de Janeiro, {{dataAssinatura}}.

[ASSINATURA DO INVESTIDOR: {{assinante}}]`;

export const PADROES = { [TIPO_TERMO]: TERMO_PADRAO, [TIPO_CHECKLIST]: CHECKLIST_PADRAO };

const SEPARADOR_QTDE = ' — Qtde. ';

/** Separa o checklist já preenchido em { cabecalho, itens, rodape } pra montar o formulário de marcação. */
export function parseChecklist(texto) {
  const linhas = texto.split(/\r?\n/);
  const ehItem = (l) => /^\d+\.\s/.test(l);
  const primeiro = linhas.findIndex(ehItem);
  let ultimo = -1;
  linhas.forEach((l, i) => {
    if (ehItem(l)) ultimo = i;
  });
  if (primeiro === -1) return { cabecalho: texto, itens: [], rodape: '' };

  const itens = linhas.slice(primeiro, ultimo + 1).filter(ehItem).map((linha) => {
    const numero = linha.match(/^(\d+)\./)[1];
    const corpo = linha.replace(/^\d+\.\s+/, '');
    const pos = corpo.lastIndexOf(SEPARADOR_QTDE);
    return pos === -1
      ? { numero, descricao: corpo, temQtde: false, qtde: '' }
      : {
          numero,
          descricao: corpo.slice(0, pos),
          temQtde: true,
          qtde: corpo.slice(pos + SEPARADOR_QTDE.length).trim()
        };
  });

  return {
    cabecalho: linhas.slice(0, primeiro).join('\n').trimEnd(),
    itens,
    rodape: linhas.slice(ultimo + 1).join('\n').trim()
  };
}

/** Monta o texto final do checklist com a marcação sim/não e as quantidades confirmadas. */
export function montarChecklist({ cabecalho, itens, rodape }) {
  const linhas = itens.map((i) => {
    const qtde = i.temQtde ? ` — Qtde. ${i.qtde || '___'}` : '';
    const marca = i.recebido ? '( X ) Sim   (   ) Não' : '(   ) Sim   ( X ) Não';
    return `${i.numero}. ${i.descricao}${qtde}  —  ${marca}`;
  });
  return [cabecalho, '', ...linhas, '', rodape].join('\n');
}

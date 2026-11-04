/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpdaReport, FixedTextsTemplate, CompanyProfile } from '../types/spda';

export const DEFAULT_COMPANY: CompanyProfile = {
  nome: 'SJC ENGENHARIA E SOLUÇÕES',
  cnpj: '18.472.071/0001-52',
  telefone: '(12) 98106-3344',
  endereco: 'RUA ISAAC NEWTON, 98 JD. ORIENTE',
  cidadeUf: 'SÃO JOSÉ DOS CAMPOS - SP',
  marcaDaguaTexto: 'SPDA 2026',
  marcaDaguaOpacidade: 0.08,
};

export const DEFAULT_FIXED_TEXTS: FixedTextsTemplate = {
  objetoInspecao:
    'SERVIÇOS DE INSPEÇÃO, MEDIÇÃO E ELABORAÇÃO DE LAUDO TÉCNICO QUANTO AO SISTEMA DE PROTEÇÃO CONTRA DESCARGAS ATMOSFÉRICAS SPDA, DE ACORDO COM A NBR 5419:2026.',
  introducao11:
    'Este LAUDO tem como objetivo fazer uma avaliação sucinta do SPDA existente na edificação do cliente, verificar o estado de conservação das peças e acessórios e checar a sua conformidade com a norma técnica NBR 5419:2026 da ABNT em vigência.',
  introducao12:
    'Serão apresentadas as sugestões técnicas necessárias para conformidade à norma e apresentados desenhos e/ou detalhes caso seja necessário.',
  introducao13:
    'A avaliação apresentada neste laudo teve como base as inspeções e medições efetuadas nas instalações e por informações obtidas junto a colaboradores e engenheiros da SJC Engenharia.',
  introducao14:
    'Segundo a ABNT NBR 5419-1:2026, Proteção contra descargas atmosféricas – Parte 1: Princípios Gerais, item 9.4.1.2, as funções do SPDA externo são:',
  funcoesSpda: [
    'Interceptar uma descarga atmosférica para a estrutura (com um subsistema de captação);',
    'Conduzir a corrente da descarga atmosférica seguramente para a terra (com um subsistema de descida);',
    'Dispersar esta corrente na terra (com um subsistema de aterramento).',
  ],
  etapasInspecao: [
    'Análise das informações fornecidas pelos ANEXOS (Projetos e relatórios fornecidos pelo cliente);',
    'Relatório de inspeção de SPDA e Caixas de Inspeção de Hastes de Aterramento;',
    'Relatório de Inspeção de Medição de Continuidade de Malha de Aterramento;',
    'Relatório de Inspeção de Pontos de aterramento e avaliação dos quadros de energia;',
    'Avaliação Geral do Sistema de Proteção contra Descargas Atmosféricas e Laudo Técnico Final.',
  ],
  referenciasNormativas: [
    'ABNT NBR 5410, Instalações elétricas de baixa tensão;',
    'ABNT NBR 5419-1:2026, Proteção contra descargas atmosféricas – Parte 1: Princípios Gerais;',
    'ABNT NBR 5419-2:2026, Proteção contra descargas atmosféricas – Parte 2: Gerenciamento de risco;',
    'ABNT NBR 5419-3:2026, Proteção contra descargas atmosféricas – Parte 3: Danos físicos a estruturas e perigos à vida;',
    'ABNT NBR 5419-4:2026, Proteção contra descargas atmosféricas – Parte 4: Sistemas elétricos e eletrônicos internos na estrutura;',
    'ABNT NBR 6323, Galvanização de produtos de aço ou ferro fundido – Especificação;',
    'ABNT NBR 13571, Haste de aterramento acobreado e acessórios;',
    'ABNT NBR IEC 60079-10-1, Atmosferas explosivas – Parte 10-1: Classificação de áreas – Atmosferas explosivas de gás;',
    'ABNT NBR IEC 60079-10-2, Atmosferas explosivas – Parte 10-2: Classificação de áreas – Atmosferas de poeiras combustíveis;',
    'ABNT NBR IEC 60079-14, Atmosferas explosivas – Parte 14: Projeto, seleção e montagem de instalações elétricas;',
  ],
  dicionario: [
    {
      termo: 'EXPOSIÇÃO EXTREMA',
      definicao:
        'Local com muita incidência de Raios e vulnerável aos efeitos secundários dos raios que caiem na vizinhança;',
    },
    {
      termo: 'BLINDAGEM ELETROSTÁTICA',
      definicao:
        'Proteção contra as ondas eletromagnéticas provocadas pelos raios que viajam pelo ar;',
    },
    {
      termo: 'NBR 5419:2026',
      definicao:
        'Norma Brasileira que regulamenta o projeto e instalação de Proteção contra Descargas Atmosféricas (SPDA);',
    },
    {
      termo: 'ABNT',
      definicao: 'Associação Brasileira de Normas Técnicas;',
    },
    {
      termo: 'SPDA',
      definicao:
        'Sistema de Proteção contra Descargas Atmosféricas (Para-raios);',
    },
    {
      termo: '“As Built”',
      definicao:
        'Projeto final da instalação com as modificações ocorridas durante a instalação (como executado; como construído);',
    },
    {
      termo: 'DPS',
      definicao: 'Dispositivo de proteção contra surto.',
    },
    {
      termo: 'ART',
      definicao:
        'Anotação de Responsabilidade Técnica emitida no CREA, (responsabilidade pela execução);',
    },
    {
      termo: 'CREA',
      definicao: 'Conselho Regional de Engenharia e Agronomia.',
    },
  ],
  notaCrea:
    'Inspeção realizada por engenheiro legalmente habilitado, com registro ativo e emissão da ART correspondente, assegurando o rigor técnico e legalidade das medições.',
  recomendacoesPrioritarias: [
    'Corrigir para que toda massa metálica da parte superior seja aterrada e equipotencializadas ao sistema.',
    'Manter a limpeza das caixas de inspeção, deixando livre de todo tipo de sujidade, evitando umidade.',
    'Realizar a instalação de DPS nos quadros de distribuição de forma coordenada, intensificando a proteção contra surtos de energias internos da estrutura.',
    'Realizar a troca dos conectores oxidados para maximizar a eficiência do sistema de proteção.',
    'Realizar a troca dos parafusos que fazem a fixação das fitas do sistema, para adequar ao que está definido pela norma.',
  ],
  conclusaoFinal:
    'Conforme descrito no decorrer deste relatório, excluindo-se as observações efetuadas neste documento, podemos concluir que as áreas inspecionadas na relação anexa, estão em condições técnicas adequadas e satisfatórias no que se refere ao Sistema de Proteção Contra Descargas Atmosféricas da norma NBR 5419:2026, quanto aos aspectos de instalação e segurança. Por fim, concluo que as malhas de aterramento e as malhas superiores do sistema de proteção contra descargas atmosféricas em análise atendem aos requisitos dos projetos executivos e normas vigentes citadas no item 01 deste relatório. Este é meu parecer sob a ART em anexo.',
  disposicoesFinais:
    'Este laudo possui validade técnica de 1 (um) ano a partir da data de emissão, ou conforme periodicidade de inspeção estipulada pela NBR 5419-3:2026 (Tabela 6). O responsável técnico declara que todas as medições foram efetuadas conforme os preceitos éticos e regulamentares do CREA.',
};

export function createInitialReport(): SpdaReport {
  return {
    id: 'laudo-ref-spda-001',
    titulo: 'Laudo Técnico Pericial de Engenharia Elétrica - SPDA',
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
    empresa: { ...DEFAULT_COMPANY },
    cliente: {
      cliente: 'Condomínio Residencial Max Clube',
      nomeEmpreendimento: 'Residencial Max Clube',
      local: 'No entorno das torres.',
      municipioUf: 'SÃO JOSÉ DOS CAMPOS - SP',
      cnpj: '—',
      ramoAtividade: 'RESIDENCIAL',
      periodoAvaliacao: '17/10/2026 – 23/10/2026',
      grauExposicao: 'baixa EXPOSIÇÃO',
      quantidadeTorres: 4,
      temAreaComum: true,
    },
    edificacao: {
      tipologiaConstrutiva:
        'Alvenaria Convencional / Estrutura em Concreto Armado',
      topografiaEntorno: 'Terreno Urbano Plano com Edificações Vizinhas',
      nivelProtecao:
        'Nível III / IV (NBR 5419-2:2026 - Gerenciamento de Risco)',
      metodosProtecao:
        'Ângulo de Proteção (Franklin) e Condutores em Malha (Faraday)',
      fotoAereaLegenda: 'Vista aérea do condomínio',
      fotoFachadaLegenda: 'Entrada do condomínio',
      descricaoEdificacao:
        'A edificação é de uso RESIDENCIAL com presença de moradores e equipamentos eletrônicos e está localizada numa área de baixa EXPOSIÇÃO a descargas atmosféricas e seus efeitos indiretos.',
      historicoOcorrencias:
        'Conforme informações obtidas durante a vistoria, 2 problemas de queima de equipamentos',
      historicoOcorrenciasComplemento:
        'A ocorrência de problemas com equipamentos se deve ao fato de descargas nas proximidades gerarem pulsos eletromagnéticos que viajam pela rede elétrica sem blindagem suficiente. Com isso, é indispensável a instalação de supressores de surtos (DPS) coordenados nos quadros de distribuição.',
    },
    instrumentacao: {
      equipamentoNome: 'Miliohmímetro HTM-01 - HI-TECH',
      equipamentoDescricao:
        'O miliohmímetro é um instrumento portátil, utiliza o método dos 4 terminais (método de Kelvin) para evitar erros na medição provocados pelos cabos de prova e suas resistências de contato.',
      localMedicao: 'Térreo',
      correnteEnsaio: '1,2 Amperes',
      tipoCorrente: 'Corrente DC',
      certCalibracaoAnexo: true,
      parametrosContinuidades: [
        {
          id: '1',
          item: 'Continuidade de Armaduras e Malhas',
          norma: 'NBR 5419-3:2026 (Item 5.3.5)',
          limite: '≤ 0,200 Ω (200 mΩ)',
          status: 'CONFORME',
        },
        {
          id: '2',
          item: 'Resistência de Equipotencialização',
          norma: 'NBR 5419-3:2026 (Item 6.2)',
          limite: '≤ 0,200 Ω (200 mΩ)',
          status: 'CONFORME',
        },
        {
          id: '3',
          item: 'Método de 4 Terminais (Kelvin)',
          norma: 'Injeção de corrente DC contínua',
          limite: 'Min. 1,0 A sob 4 fios',
          status: 'APLICADO',
        },
        {
          id: '4',
          item: 'Estado Físico das Caixas de Inspeção',
          norma: 'Aterramento & Equalização',
          limite: 'Desobstruídas e secas',
          status: 'LIMPEZA PENDENTE',
        },
      ],
      textoDps:
        'Todos os quadros de distribuição (QGBTs, parciais e de comando) devem possuir Dispositivos de Proteção contra Surtos (DPS) coordenados tipo 1 e tipo 2 em pleno funcionamento. A ausência de DPS deixa circuitos e edificações vulneráveis a danos catastróficos.',
    },
    torres: [
      {
        id: 't-1',
        nome: 'Torre 1',
        numeroOrdem: 1,
        fotosEnsaio: [],
        fotosSpda: [],
        fotosQuadros: [],
      },
      {
        id: 't-2',
        nome: 'Torre 2',
        numeroOrdem: 2,
        fotosEnsaio: [],
        fotosSpda: [],
        fotosQuadros: [],
      },
      {
        id: 't-3',
        nome: 'Torre 3',
        numeroOrdem: 3,
        fotosEnsaio: [],
        fotosSpda: [],
        fotosQuadros: [],
      },
      {
        id: 't-4',
        nome: 'Torre 4',
        numeroOrdem: 4,
        fotosEnsaio: [],
        fotosSpda: [],
        fotosQuadros: [],
      },
    ],
    areaComum: {
      habilitada: true,
      nome: 'ÁREA COMUM',
      fotosSpda: [],
      fotosQuadros: [],
    },
    recomendacoesPersonalizadas: [],
    responsavelTecnico: {
      responsavelTecnico: 'JÔNATAS PEREIRA PAVANELO',
      qualificacao: 'Engenheiro Eletricista',
      registroCrea: 'CREA-SP 5063896203',
      numeroArt: 'Anotação de Responsabilidade Técnica emitida no CR',
      cidadeEmissao: 'São José dos Campos',
      dataEmissao: '26 de Outubro de 2026',
      assinaturaUrl: undefined,
    },
    modeloTextos: { ...DEFAULT_FIXED_TEXTS },
  };
}

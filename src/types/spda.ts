/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CompanyProfile {
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidadeUf: string;
  logoUrl?: string; // custom base64 or URL
  cabecalhoLinha1?: string;
  cabecalhoLinha2?: string;
  rodapeLinha1?: string;
  rodapeLinha2?: string;
  marcaDaguaTexto: string;
  marcaDaguaOpacidade: number;
}

export interface ClientData {
  cliente: string;
  nomeEmpreendimento: string;
  local: string;
  municipioUf: string;
  cnpj: string;
  ramoAtividade: string;
  periodoAvaliacao: string;
  grauExposicao: string;
  quantidadeTorres: number;
  temAreaComum: boolean;
}

export interface BuildingParams {
  tipologiaConstrutiva: string;
  topografiaEntorno: string;
  nivelProtecao: string;
  metodosProtecao: string;
  fotoAereaUrl?: string;
  fotoAereaLegenda: string;
  fotoFachadaUrl?: string;
  fotoFachadaLegenda: string;
  descricaoEdificacao: string;
  historicoOcorrencias: string;
  historicoOcorrenciasComplemento: string;
}

export interface ContinuityParam {
  id: string;
  item: string;
  norma: string;
  limite: string;
  status: 'CONFORME' | 'APLICADO' | 'LIMPEZA PENDENTE' | 'NÃO CONFORME' | 'ATENÇÃO';
}

export interface InstrumentationData {
  textoIntroducao?: string;
  equipamentoNome: string;
  equipamentoDescricao: string;
  localMedicao: string;
  correnteEnsaio: string;
  tipoCorrente: string;
  certCalibracaoAnexo: boolean;
  tituloParametrosContinuidades?: string;
  parametrosContinuidades: ContinuityParam[];
  tituloDps?: string;
  textoDps: string;
}

export interface TechnicalResponsibility {
  responsavelTecnico: string;
  qualificacao: string;
  registroCrea: string;
  numeroArt: string;
  cidadeEmissao: string;
  dataEmissao: string;
  assinaturaUrl?: string;
  dataAssinatura?: string;
}

export type PhotoCategory =
  | 'ensaio_miliohmimetro'
  | 'spda_captores'
  | 'quadros_dps'
  | 'area_comum';

export interface PhotoItem {
  id: string;
  torreId: string; // ID da torre ou 'area_comum'
  categoria: PhotoCategory;
  legenda: string;
  destaqueAlerta?: boolean; // Se marcado, exibe o destaque em amarelo
  tipoDefeito?: string; // Defeito específico: ex: "FALTA DPS", "CONECTOR OXIDADO", "FALTA EQUIPOTENCIALIZAR", etc.
  leituraMiliohmimetro?: string; // Leitura captada automaticamente do visor (ex: "23.5 mΩ")
  observacao?: string;
  previewUrl: string; // Versão reduzida em qualidade de impressão carregada no laudo
  storageKey?: string; // Chave no IndexedDB para a imagem original em alta resolução
  nomeArquivoOriginal: string;
  tamanhoBytes: number; // Tamanho do arquivo original salvo nos arquivos
  tamanhoImpressaoBytes?: number; // Tamanho da imagem reduzida em qualidade de impressão para o laudo
  dimensaoImpressao?: string; // Ex: "675x900"
  salvaNoCelular?: boolean; // Indica se a cópia original já foi salva no dispositivo
  tipoMime: string;
  dataHora: number;
  ordem: number;
}

export interface Tower {
  id: string;
  nome: string; // ex: "Torre 1", "Torre A", etc.
  numeroOrdem: number;
  fotosEnsaio: PhotoItem[];
  fotosSpda: PhotoItem[];
  fotosQuadros: PhotoItem[];
  observacoes?: string;
}

export interface CommonAreaSection {
  habilitada: boolean;
  nome: string;
  fotosSpda: PhotoItem[];
  fotosQuadros: PhotoItem[];
  observacoes?: string;
}

export interface ReciboEntregaData {
  habilitado: boolean;
  titulo: string;
  declaracao: string;
  trechoDocumentos: string;
  trechoCiencia: string;
  recebedorNome: string;
  recebedorCargo: string;
  recebedorDocumento: string;
  dataRecebimento: string;
  observacoes?: string;
}

export interface FixedTextsTemplate {
  objetoInspecao: string;
  introducao11: string;
  introducao12: string;
  introducao13: string;
  introducao14: string;
  funcoesSpda: string[];
  etapasInspecao: string[];
  referenciasNormativas: string[];
  dicionario: Array<{ termo: string; definicao: string }>;
  notaCrea: string;
  tituloSecao4?: string;
  tituloSecao5?: string;
  tituloSecao6Prefixo?: string;
  subtituloSecao6Ensaio?: string;
  subtituloSecao6Spda?: string;
  subtituloSecao6Quadros?: string;
  tituloSecao7?: string;
  subtituloSecao7?: string;
  recomendacoesPrioritarias: string[];
  fechamentoRecomendacoes?: string;
  tituloSecao8?: string;
  conclusaoFinal: string;
  parecerArt?: string;
  tituloDisposicoesFinais?: string;
  disposicoesFinais: string;
}

export interface SpdaReport {
  id: string;
  titulo: string;
  criadoEm: number;
  atualizadoEm: number;
  empresa: CompanyProfile;
  cliente: ClientData;
  edificacao: BuildingParams;
  instrumentacao: InstrumentationData;
  torres: Tower[];
  areaComum: CommonAreaSection;
  recomendacoesPersonalizadas: string[];
  fechamentoRecomendacoesPersonalizado?: string;
  conclusaoPersonalizada?: string;
  parecerArtPersonalizado?: string;
  disposicoesFinaisPersonalizada?: string;
  recibo?: ReciboEntregaData;
  responsavelTecnico: TechnicalResponsibility;
  modeloTextos: FixedTextsTemplate;
}

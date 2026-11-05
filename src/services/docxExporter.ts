/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  HeadingLevel,
  ShadingType,
  convertInchesToTwip,
  convertMillimetersToTwip,
} from 'docx';
import { SpdaReport, PhotoItem } from '../types/spda';
import { getOriginalPhoto } from './storage';

/**
 * Helper to convert base64 or blob URL into Uint8Array for docx ImageRun
 */
async function urlToUint8Array(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.warn('Erro ao carregar imagem para Word:', err);
    return null;
  }
}

/**
 * Splits photos into chunks of 5 items
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Generates the complete SPDA Report as a Word (.docx) Blob
 */
export async function generateReportDocxBlob(
  report: SpdaReport,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (onProgress) onProgress('Preparando estrutura do documento Word (.docx)...');

  // Convert aerial and facade photos if available
  let fotoAereaBytes: Uint8Array | null = null;
  let fotoFachadaBytes: Uint8Array | null = null;
  if (report.edificacao.fotoAereaUrl) {
    fotoAereaBytes = await urlToUint8Array(report.edificacao.fotoAereaUrl);
  }
  if (report.edificacao.fotoFachadaUrl) {
    fotoFachadaBytes = await urlToUint8Array(report.edificacao.fotoFachadaUrl);
  }

  // Pre-load photo bytes for all towers
  const photoBytesMap = new Map<string, Uint8Array>();

  const allPhotos: PhotoItem[] = [];
  report.torres.forEach((t) => {
    allPhotos.push(...t.fotosEnsaio, ...t.fotosSpda, ...t.fotosQuadros);
  });
  if (report.areaComum.habilitada) {
    allPhotos.push(...report.areaComum.fotosSpda, ...report.areaComum.fotosQuadros);
  }

  const total = allPhotos.length;
  for (let i = 0; i < total; i++) {
    const photo = allPhotos[i];
    if (onProgress) onProgress(`Carregando imagens de alta resolução (${i + 1}/${total})...`);

    let bytes: Uint8Array | null = null;
    try {
      const orig = await getOriginalPhoto(photo.id);
      if (orig && orig.blob) {
        const ab = await orig.blob.arrayBuffer();
        bytes = new Uint8Array(ab);
      }
    } catch {
      // ignore
    }

    if (!bytes && photo.previewUrl) {
      bytes = await urlToUint8Array(photo.previewUrl);
    }

    if (bytes) {
      photoBytesMap.set(photo.id, bytes);
    }
  }

  if (onProgress) onProgress('Gerando seções, tabelas e diagramação no Word...');

  // Helper for Section Banner in Word (grey table cell)
  const createBanner = (title: string): Table => {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: 'EEF0F3' },
              margins: {
                top: convertMillimetersToTwip(1.5),
                bottom: convertMillimetersToTwip(1.5),
                left: convertMillimetersToTwip(3),
                right: convertMillimetersToTwip(3),
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: title.toUpperCase(),
                      bold: true,
                      size: 20, // 10pt
                      font: 'Arial',
                      color: '111827',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  // Helper to build 5-column photo grid table in docx
  const createPhotoGridTable = (photos: PhotoItem[]): Table[] => {
    const tables: Table[] = [];
    const rows = chunkArray(photos, 5);

    const tableRows: TableRow[] = [];

    rows.forEach((rowPhotos) => {
      // 5 cells per row
      const cells: TableCell[] = [];

      for (let col = 0; col < 5; col++) {
        const photo = rowPhotos[col];
        if (photo) {
          const imgBytes = photoBytesMap.get(photo.id);
          const cellParagraphs: Paragraph[] = [];

          if (imgBytes) {
            cellParagraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: imgBytes,
                    transformation: {
                      width: 125, // ~33mm
                      height: 125, // square or 4:3
                    },
                    type: 'png',
                  }),
                ],
              })
            );
          }

          // Caption or defect alert tag
          const defectText =
            photo.tipoDefeito ||
            (photo.destaqueAlerta
              ? photo.legenda.toUpperCase().includes('FALTA')
                ? photo.legenda
                : 'FALTA EQUIPOTENCIALIZAR'
              : '');
          const isAlert =
            !!defectText ||
            photo.destaqueAlerta ||
            photo.legenda.toUpperCase().includes('FALTA EQUIPOTENCIALIZAR');

          const isSpdaOrQuadros =
            photo.categoria === 'spda_captores' ||
            photo.categoria === 'quadros_dps' ||
            photo.categoria === 'area_comum';

          if (isAlert) {
            cellParagraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 80 },
                children: [
                  new TextRun({
                    text: `⚠ ${defectText || 'FALTA EQUIPOTENCIALIZAR'}`,
                    size: 15, // 7.5pt
                    bold: true,
                    color: '92400E',
                    font: 'Arial',
                  }),
                  ...(photo.observacao
                    ? [
                        new TextRun({
                          text: ` (${photo.observacao})`,
                          size: 13,
                          italics: true,
                          color: '78350F',
                          font: 'Arial',
                        }),
                      ]
                    : []),
                ],
              })
            );
          } else if (!isSpdaOrQuadros && photo.legenda) {
            // For Pontos de Inspeção (ensaio_miliohmimetro), display the meter reading / point caption
            cellParagraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 80 },
                children: [
                  new TextRun({
                    text: photo.legenda,
                    size: 15,
                    bold: false,
                    color: '1F2937',
                    font: 'Arial',
                  }),
                ],
              })
            );
          }

          cells.push(
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: cellParagraphs,
            })
          );
        } else {
          // Empty slot in 5-col grid to keep alignment
          cells.push(
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [new Paragraph({})],
            })
          );
        }
      }

      tableRows.push(new TableRow({ children: cells }));
    });

    if (tableRows.length > 0) {
      tables.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: tableRows,
        })
      );
    }

    return tables;
  };

  // Build Document Sections
  const docChildren: (Paragraph | Table)[] = [];

  // ==================== COVER PAGE ====================
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: 'LAUDO TÉCNICO PERICIAL DE ENGENHARIA ELÉTRICA',
          bold: true,
          size: 26, // 13pt
          color: '991B1B',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: 'SISTEMA DE PROTEÇÃO CONTRA\nDESCARGAS ATMOSFÉRICAS (SPDA)',
          bold: true,
          size: 36, // 18pt
          color: '111827',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: 'Inspeção Visual, Medições de Continuidade Ôhmica & Avaliação NBR 5419:2026',
          size: 22,
          color: '4B5563',
          font: 'Arial',
        }),
      ],
    }),

    // Objeto da Inspeção Box
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: {
                top: convertMillimetersToTwip(2.5),
                bottom: convertMillimetersToTwip(2.5),
                left: convertMillimetersToTwip(4),
                right: convertMillimetersToTwip(4),
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                left: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                right: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'OBJETO DA INSPEÇÃO:\n',
                      bold: true,
                      size: 22,
                      font: 'Arial',
                    }),
                    new TextRun({
                      text: report.modeloTextos.objetoInspecao,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 200 } }),
    createBanner('DADOS DA EDIFICAÇÃO / CLIENTE'),
    new Paragraph({
      spacing: { before: 100, after: 200 },
      children: [
        new TextRun({ text: 'CLIENTE: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.cliente.cliente}\n`, size: 20 }),
        new TextRun({ text: 'LOCAL: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.cliente.local}\n`, size: 20 }),
        new TextRun({ text: 'MUNICÍPIO / UF: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.cliente.municipioUf}\n`, size: 20 }),
        new TextRun({ text: 'CNPJ: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.cliente.cnpj}\n`, size: 20 }),
        new TextRun({ text: 'RAMO DE ATIVIDADE: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.cliente.ramoAtividade}\n`, size: 20 }),
        new TextRun({ text: 'PERÍODO DE AVALIAÇÃO: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.cliente.periodoAvaliacao}\n`, size: 20 }),
        new TextRun({ text: 'GRAU DE EXPOSIÇÃO: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.cliente.grauExposicao}`, size: 20 }),
      ],
    }),

    createBanner('RESPONSABILIDADE TÉCNICA & REGISTRO PROFISSIONAL'),
    new Paragraph({
      spacing: { before: 100, after: 200 },
      children: [
        new TextRun({ text: 'RESPONSÁVEL TÉCNICO: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.responsavelTecnico.responsavelTecnico}\n`, size: 20 }),
        new TextRun({ text: 'QUALIFICAÇÃO PROFISSIONAL: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.responsavelTecnico.qualificacao}\n`, size: 20 }),
        new TextRun({ text: 'REGISTRO CREA / CONFEA: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.responsavelTecnico.registroCrea}\n`, size: 20 }),
        new TextRun({ text: 'CIDADE & DATA DE EMISSÃO: ', bold: true, size: 20 }),
        new TextRun({
          text: `${report.responsavelTecnico.cidadeEmissao}, ${report.responsavelTecnico.dataEmissao}\n`,
          size: 20,
        }),
        new TextRun({ text: 'AUTENTICAÇÃO DIGITAL: ', bold: true, size: 20 }),
        new TextRun({ text: 'DOCUMENTO ASSINADO DIGITALMENTE (PÁGINA FINAL)', size: 20 }),
      ],
    }),

    // Page Break after cover
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true })
  );

  // ==================== PAGE 2: INTRODUÇÃO, NORMAS, DICIONÁRIO ====================
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: '1) INTRODUÇÃO', bold: true, size: 24, font: 'Arial' })],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: '1.1- ', bold: true, size: 20 }),
        new TextRun({ text: `${report.modeloTextos.introducao11}\n`, size: 20 }),
        new TextRun({ text: '1.2- ', bold: true, size: 20 }),
        new TextRun({ text: `${report.modeloTextos.introducao12}\n`, size: 20 }),
        new TextRun({ text: '1.3- ', bold: true, size: 20 }),
        new TextRun({ text: `${report.modeloTextos.introducao13}\n`, size: 20 }),
        new TextRun({ text: '1.4- ', bold: true, size: 20 }),
        new TextRun({ text: `${report.modeloTextos.introducao14}\n`, size: 20 }),
        ...report.modeloTextos.funcoesSpda.flatMap((f, idx) => [
          new TextRun({ text: `  ${String.fromCharCode(97 + idx)}) `, bold: true, size: 20 }),
          new TextRun({ text: `${f}\n`, size: 20 }),
        ]),
      ],
    }),

    createBanner('REFERÊNCIAS NORMATIVAS APLICÁVEIS'),
    new Paragraph({
      spacing: { before: 100, after: 150 },
      children: [
        new TextRun({
          text: 'Documentos indispensáveis à aplicação deste documento (edições mais recentes e emendas vigentes):\n',
          italics: true,
          size: 18,
        }),
        ...report.modeloTextos.referenciasNormativas.flatMap((norma) => [
          new TextRun({ text: `• ${norma}\n`, size: 18 }),
        ]),
      ],
    }),

    createBanner('2) DICIONÁRIO E ABREVIATURAS USADAS NESTE DOCUMENTO'),
    new Paragraph({
      spacing: { before: 100, after: 150 },
      children: report.modeloTextos.dicionario.flatMap((d) => [
        new TextRun({ text: `• ${d.termo}: `, bold: true, size: 18 }),
        new TextRun({ text: `${d.definicao}\n`, size: 18 }),
      ]),
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: 'F0F9FF' },
              borders: {
                left: { style: BorderStyle.SINGLE, size: 24, color: '0284C7' },
                top: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'CREA – CONSELHO REGIONAL DE ENGENHARIA E AGRONOMIA\n',
                      bold: true,
                      size: 20,
                    }),
                    new TextRun({ text: report.modeloTextos.notaCrea, size: 18 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ pageBreakBefore: true })
  );

  // ==================== PAGE 3: CARACTERÍSTICAS & HISTÓRICO ====================
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({ text: '3) CARACTERÍSTICAS DA EDIFICAÇÃO & LOCAL', bold: true, size: 24 }),
      ],
    }),
    createBanner('3.1) VISTA AÉREA DA EDIFICAÇÃO / IMAGEM SATÉLITE')
  );

  if (fotoAereaBytes) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 50 },
        children: [
          new ImageRun({
            data: fotoAereaBytes,
            transformation: { width: 380, height: 180 },
            type: 'png',
          }),
        ],
      })
    );
  }
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new TextRun({ text: report.edificacao.fotoAereaLegenda, italics: true, size: 18 }),
      ],
    }),
    createBanner('PARÂMETROS CONSTRUTIVOS & INFRAESTRUTURA DA EDIFICAÇÃO (NBR 5419:2026)'),
    new Paragraph({
      spacing: { before: 100, after: 150 },
      children: [
        new TextRun({ text: 'Tipologia Construtiva: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.edificacao.tipologiaConstrutiva}\n`, size: 20 }),
        new TextRun({ text: 'Topografia & Entorno: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.edificacao.topografiaEntorno}\n`, size: 20 }),
        new TextRun({ text: 'Nível de Proteção Dimensionado: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.edificacao.nivelProtecao}\n`, size: 20 }),
        new TextRun({ text: 'Métodos de Proteção Aplicáveis: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.edificacao.metodosProtecao}\n`, size: 20 }),
      ],
    }),
    createBanner('3.2) FACHADA PRINCIPAL DA EDIFICAÇÃO / CONDOMÍNIO')
  );

  if (fotoFachadaBytes) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 50 },
        children: [
          new ImageRun({
            data: fotoFachadaBytes,
            transformation: { width: 380, height: 180 },
            type: 'png',
          }),
        ],
      })
    );
  }
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new TextRun({ text: report.edificacao.fotoFachadaLegenda, italics: true, size: 18 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${report.edificacao.descricaoEdificacao}\n\n`,
          size: 20,
        }),
        new TextRun({
          text: '4) HISTÓRICO DE OCORRÊNCIAS & DESCARGAS ATMOSFÉRICAS\n',
          bold: true,
          size: 22,
        }),
        new TextRun({ text: '4.1- Histórico: ', bold: true, size: 20 }),
        new TextRun({ text: `${report.edificacao.historicoOcorrencias}\n`, size: 20 }),
        new TextRun({ text: '4.2- ', bold: true, size: 20 }),
        new TextRun({ text: `${report.edificacao.historicoOcorrenciasComplemento}\n`, size: 20 }),
      ],
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ==================== PAGE 4: INSTRUMENTAÇÃO & PARÂMETROS ====================
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: '5) INSTRUMENTAÇÃO TÉCNICA E CRITÉRIOS DE INSPEÇÃO',
          bold: true,
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: `Foram efetuadas medidas de continuidade elétrica e inspeção visual, com o uso do Miliohmímetro ${report.instrumentacao.equipamentoNome}. Os certificados de calibração estão em anexo.\n\n`,
          size: 20,
        }),
        new TextRun({ text: `${report.instrumentacao.equipamentoNome}\n`, bold: true, size: 20 }),
        new TextRun({ text: `${report.instrumentacao.equipamentoDescricao}\n`, size: 18 }),
        new TextRun({ text: `Local: ${report.instrumentacao.localMedicao}\n`, size: 18 }),
        new TextRun({
          text: `Corrente de Ensaio: ${report.instrumentacao.correnteEnsaio}\n`,
          size: 18,
        }),
        new TextRun({
          text: `Tipo de Corrente: ${report.instrumentacao.tipoCorrente}\n`,
          size: 18,
        }),
      ],
    }),
    createBanner('PARÂMETROS NORMATIVOS DE CONTINUIDADE (ABNT NBR 5419:2026)'),
    new Paragraph({
      spacing: { before: 100, after: 150 },
      children: report.instrumentacao.parametrosContinuidades.flatMap((param) => [
        new TextRun({ text: `• ${param.item} `, bold: true, size: 20 }),
        new TextRun({ text: `(${param.norma}) — Limite: ${param.limite} `, size: 19 }),
        new TextRun({ text: `[${param.status}]\n`, bold: true, size: 19, color: '047857' }),
      ]),
    }),
    createBanner('PROTEÇÃO CONTRA SURTOS EM QUADROS ELÉTRICOS (ABNT NBR 5410 / NBR 5419-4)'),
    new Paragraph({
      spacing: { before: 100, after: 150 },
      children: [new TextRun({ text: report.instrumentacao.textoDps, size: 20 })],
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ==================== CHAPTER 6: VISTORIAS E ENSAIOS POR TORRE ====================
  report.torres.forEach((torre, tIdx) => {
    const tIndexStr = `6.${tIdx + 1}`;
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: `${tIndexStr}) VISTORIA & ENSAIOS TÉCNICOS: ${torre.nome.toUpperCase()}`,
            bold: true,
            size: 24,
          }),
        ],
      })
    );

    // 6.X.1 Ensaio Miliohmímetro
    if (torre.fotosEnsaio.length > 0) {
      docChildren.push(
        createBanner(
          `${tIndexStr}.1) PONTOS DE ENSAIO DE CONTINUIDADE ÔHMICA (MILIOHMÍMETRO)`
        ),
        ...createPhotoGridTable(torre.fotosEnsaio)
      );
    }

    // 6.X.2 SPDA Captores & Descidas
    if (torre.fotosSpda.length > 0) {
      docChildren.push(
        createBanner(`${tIndexStr}.2) VISTORIA DO SPDA EXISTENTE, CAPTORES & DESCIDAS`),
        ...createPhotoGridTable(torre.fotosSpda)
      );
    }

    // 6.X.3 Quadros & DPS
    if (torre.fotosQuadros.length > 0) {
      docChildren.push(
        createBanner(`${tIndexStr}.3) ANÁLISE DOS QUADROS DE ENERGIA & DPS (ABNT NBR 5410)`),
        ...createPhotoGridTable(torre.fotosQuadros)
      );
    }

    docChildren.push(new Paragraph({ pageBreakBefore: true }));
  });

  // Common Area
  if (report.areaComum.habilitada) {
    const cIdxStr = `6.${report.torres.length + 1}`;
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: `${cIdxStr}) VISTORIA & ENSAIOS TÉCNICOS: ${report.areaComum.nome.toUpperCase()}`,
            bold: true,
            size: 24,
          }),
        ],
      })
    );

    if (report.areaComum.fotosSpda.length > 0) {
      docChildren.push(
        createBanner(`${cIdxStr}.2) VISTORIA DO SPDA EXISTENTE, CAPTORES & DESCIDAS`),
        ...createPhotoGridTable(report.areaComum.fotosSpda)
      );
    }

    if (report.areaComum.fotosQuadros.length > 0) {
      docChildren.push(
        createBanner(`${cIdxStr}.3) ANÁLISE DOS QUADROS DE ENERGIA & DPS (ABNT NBR 5410)`),
        ...createPhotoGridTable(report.areaComum.fotosQuadros)
      );
    }

    docChildren.push(new Paragraph({ pageBreakBefore: true }));
  }

  // ==================== FINAL CHAPTERS: RECOMENDAÇÕES & CONCLUSÃO ====================
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: '7) CORREÇÕES NECESSÁRIAS PARA PROTEÇÃO DAS EDIFICAÇÕES',
          bold: true,
          size: 24,
        }),
      ],
    }),
    createBanner('Recomendações Técnicas Prioritárias (NBR 5419:2026)'),
    new Paragraph({
      spacing: { before: 100, after: 150 },
      children: [
        ...report.modeloTextos.recomendacoesPrioritarias.flatMap((rec, idx) => [
          new TextRun({ text: `7.${idx + 1}- `, bold: true, color: 'B91C1C', size: 20 }),
          new TextRun({ text: `${rec}\n`, color: 'B91C1C', size: 20 }),
        ]),
        new TextRun({
          text: '\nFazer a correção de todos os itens apontados neste relatório, de forma ao sistema operar em sua perfeita harmonia.\n\n',
          bold: true,
          size: 20,
        }),
        new TextRun({
          text: '8) CONCLUSÃO FINAL DESTE RELATÓRIO TÉCNICO\n',
          bold: true,
          size: 24,
        }),
        new TextRun({
          text: `${report.conclusaoPersonalizada || report.modeloTextos.conclusaoFinal}\n\n`,
          size: 20,
        }),
      ],
    }),

    // Disposições finais
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                left: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                right: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'DISPOSIÇÕES FINAIS & VALIDADE DA INSPEÇÃO:\n',
                      bold: true,
                      size: 20,
                    }),
                    new TextRun({ text: report.modeloTextos.disposicoesFinais, size: 19 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 300, after: 200 },
      children: [
        new TextRun({
          text: `${report.responsavelTecnico.cidadeEmissao}, ${report.responsavelTecnico.dataEmissao}.\n\n`,
          bold: true,
          size: 20,
        }),
      ],
    })
  );

  // Digital Signature
  if (report.responsavelTecnico.assinaturaUrl) {
    const signBytes = await urlToUint8Array(report.responsavelTecnico.assinaturaUrl);
    if (signBytes) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: signBytes,
              transformation: { width: 180, height: 60 },
              type: 'png',
            }),
          ],
        })
      );
    }
  }

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: '________________________________________________\n', size: 20 }),
        new TextRun({
          text: `${report.responsavelTecnico.responsavelTecnico.toUpperCase()}\n`,
          bold: true,
          size: 22,
        }),
        new TextRun({ text: `${report.responsavelTecnico.qualificacao}\n`, size: 19 }),
        new TextRun({
          text: `${report.responsavelTecnico.registroCrea} | ART: ${report.responsavelTecnico.numeroArt}`,
          size: 18,
        }),
      ],
    })
  );

  // Create docx Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(12),
              bottom: convertMillimetersToTwip(12),
              left: convertMillimetersToTwip(12),
              right: convertMillimetersToTwip(12),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${report.empresa.nome} · LAUDO SPDA NBR 5419:2026`,
                    size: 16,
                    color: '6B7280',
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${report.empresa.nome} - CNPJ: ${report.empresa.cnpj} - FONE: ${report.empresa.telefone}\n`,
                    size: 15,
                    font: 'Arial',
                    bold: true,
                  }),
                  new TextRun({
                    text: `${report.empresa.endereco} – ${report.empresa.cidadeUf}  |  Página `,
                    size: 14,
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 14,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 14,
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  if (onProgress) onProgress('Empacotando arquivo Word (.docx)...');

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Generates and triggers download of the Word (.docx) file
 */
export async function exportReportToDocx(
  report: SpdaReport,
  onProgress?: (msg: string) => void
): Promise<void> {
  const blob = await generateReportDocxBlob(report, onProgress);

  // Trigger download
  const safeTitle = (report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Laudo_SPDA')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .trim();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laudo_Tecnico_SPDA_${safeTitle}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

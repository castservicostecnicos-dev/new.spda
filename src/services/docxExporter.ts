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
  ShadingType,
  VerticalAlignTable,
  convertMillimetersToTwip,
} from 'docx';
import { SpdaReport, PhotoItem } from '../types/spda';
import { getOriginalPhoto, downscaleBlobToPrintUint8Array } from './storage';
import { buildTowerPages } from '../utils/documentPaginator';
import { getReportFileName } from './pdfExporter';

/**
 * Helper to convert base64 or blob URL into Uint8Array for docx ImageRun.
 * If the image is SVG, it is rasterized onto a high-resolution 3:4 canvas (600x800)
 * so Microsoft Word can render it natively as PNG without errors.
 */
async function urlToUint8Array(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith('data:image/svg+xml') || url.includes('.svg')) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 600;
          canvas.height = 800;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 600, 800);
          ctx.drawImage(img, 0, 0, 600, 800);
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))).catch(() => resolve(null));
          }, 'image/png');
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    const res = await fetch(url);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.warn('Erro ao carregar imagem para Word:', err);
    return null;
  }
}

const DEFAULT_SJC_LOGO_SVG = `<svg viewBox="0 0 240 85" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sjcRedGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#991b1b"/><stop offset="50%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#7f1d1d"/></linearGradient><linearGradient id="sjcMetalGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#2c3038"/><stop offset="100%" stop-color="#181a1e"/></linearGradient><linearGradient id="silverLetters" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient></defs><rect x="2" y="2" width="236" height="81" rx="4" fill="url(#sjcMetalGrad)" stroke="#475569" stroke-width="1.5"/><path d="M 2 6 Q 2 2 6 2 L 234 2 Q 238 2 238 6 L 238 22 L 2 22 Z" fill="url(#sjcRedGrad)"/><text x="120" y="16" fill="#ffffff" font-family="Arial, sans-serif" font-size="9.5" font-weight="800" letter-spacing="1.8" text-anchor="middle">ENGENHARIA &amp; SOLUÇÕES</text><g transform="translate(18, 30)"><path d="M 50 10 C 45 4, 25 3, 15 12 C 5 21, 20 28, 35 32 C 55 36, 52 46, 38 48 C 22 49, 10 44, 5 36 L 15 36 C 18 41, 26 43, 38 42 C 45 41, 46 36, 34 32 C 16 26, 8 20, 18 8 C 28 -2, 50 -1, 58 8 Z" fill="url(#silverLetters)" stroke="#334155" stroke-width="0.8"/><path d="M 85 2 L 98 2 L 98 34 C 98 44, 90 48, 75 48 C 65 48, 58 43, 56 36 L 68 36 C 69 40, 72 42, 78 42 C 84 42, 86 39, 86 33 L 86 2 Z" fill="url(#silverLetters)" stroke="#334155" stroke-width="0.8"/><path d="M 155 12 L 145 16 C 142 8, 134 5, 122 5 C 105 5, 100 16, 100 25 C 100 34, 106 45, 124 45 C 135 45, 143 41, 147 34 L 157 37 C 151 47, 139 51, 122 51 C 94 51, 88 35, 88 25 C 88 15, 96 0, 123 0 C 141 0, 152 6, 155 12 Z" fill="url(#silverLetters)" stroke="#334155" stroke-width="0.8"/></g></svg>`;

interface DocxLogoData {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/**
 * Loads either the user-uploaded header logo or the default SJC SVG logo,
 * rasterizes to transparent high-res PNG, and returns proportional Word dimensions.
 */
async function loadLogoForDocx(customLogoUrl?: string): Promise<DocxLogoData | null> {
  const sourceUrl =
    customLogoUrl ||
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DEFAULT_SJC_LOGO_SVG)}`;

  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const natW = img.naturalWidth || 240;
          const natH = img.naturalHeight || 85;
          const maxDocW = 128;
          const maxDocH = 40;
          const docScale = Math.min(maxDocW / natW, maxDocH / natH);
          const displayW = Math.max(24, Math.round(natW * docScale));
          const displayH = Math.max(16, Math.round(natH * docScale));

          const canvas = document.createElement('canvas');
          canvas.width = displayW * 3;
          canvas.height = displayH * 3;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            blob
              .arrayBuffer()
              .then((ab) =>
                resolve({
                  bytes: new Uint8Array(ab),
                  width: displayW,
                  height: displayH,
                })
              )
              .catch(() => resolve(null));
          }, 'image/png');
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = sourceUrl;
    });
  } catch {
    return null;
  }
}

interface FullWidthDocxImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/**
 * Loads an image at its full original resolution (no downscaling) and computes
 * proportional dimensions spanning the full usable A4 page width (~696px).
 */
async function loadFullWidthImageForDocx(
  url: string,
  targetWidth = 696
): Promise<FullWidthDocxImage | null> {
  const bytes = await urlToUint8Array(url);
  if (!bytes) return null;

  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resolve({
        w: img.naturalWidth || targetWidth,
        h: img.naturalHeight || Math.round(targetWidth * 0.56),
      });
    };
    img.onerror = () => resolve({ w: targetWidth, h: Math.round(targetWidth * 0.56) });
    img.src = url;
  });

  const proportionalHeight = Math.max(1, Math.round(targetWidth * (dims.h / dims.w)));
  return {
    bytes,
    width: targetWidth,
    height: proportionalHeight,
  };
}

/**
 * Generates the complete SPDA Report as a Word (.docx) Blob
 * perfectly matching the visual structure, layout, typography,
 * and page-by-page distribution of the app.
 */
export async function generateReportDocxBlob(
  report: SpdaReport,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (onProgress) onProgress('Preparando estrutura do documento Word (.docx)...');

  // Convert aerial and facade photos at full page width keeping exact proportions
  let fotoAereaData: FullWidthDocxImage | null = null;
  let fotoFachadaData: FullWidthDocxImage | null = null;
  let assinaturaBytes: Uint8Array | null = null;

  if (report.edificacao.fotoAereaUrl) {
    fotoAereaData = await loadFullWidthImageForDocx(report.edificacao.fotoAereaUrl, 696);
  }
  if (report.edificacao.fotoFachadaUrl) {
    fotoFachadaData = await loadFullWidthImageForDocx(report.edificacao.fotoFachadaUrl, 696);
  }
  if (report.responsavelTecnico.assinaturaUrl) {
    assinaturaBytes = await urlToUint8Array(report.responsavelTecnico.assinaturaUrl);
  }
  const logoData = await loadLogoForDocx(report.empresa.logoUrl);

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
    if (onProgress) onProgress(`Carregando fotos em qualidade de impressão (${i + 1}/${total})...`);

    let bytes: Uint8Array | null = null;

    // 1. Prioritize the print-ready reduced image stored in the report
    if (photo.previewUrl) {
      bytes = await urlToUint8Array(photo.previewUrl);
    }

    // 2. Fallback: load original from IndexedDB and downscale to print-ready size
    if (!bytes) {
      try {
        const orig = await getOriginalPhoto(photo.id);
        if (orig && orig.blob) {
          bytes = await downscaleBlobToPrintUint8Array(orig.blob, 900, 0.9);
        }
      } catch {
        // ignore
      }
    }

    if (bytes) {
      photoBytesMap.set(photo.id, bytes);
    }
  }

  if (onProgress) onProgress('Diagramando textos normativos, parecer e seções fotográficas...');

  // Helper for Section Banner in Word (matches SectionBanner.tsx)
  const createBanner = (title: string): Table => {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: 'EEF0F3' },
              margins: {
                top: convertMillimetersToTwip(1.2),
                bottom: convertMillimetersToTwip(1.2),
                left: convertMillimetersToTwip(2.5),
                right: convertMillimetersToTwip(2.5),
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
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: title.toUpperCase(),
                      bold: true,
                      size: 19, // 9.5pt
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

  // Helper to build 2-column key-value tables with no awkward gaps
  const createKeyValueTable = (rows: Array<{ label: string; value: string; isBoldVal?: boolean }>): Table => {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: rows.map(
        (r) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 36, type: WidthType.PERCENTAGE },
                margins: { top: 30, bottom: 30, left: 40, right: 40 },
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [
                      new TextRun({
                        text: r.label,
                        bold: true,
                        size: 19,
                        font: 'Arial',
                        color: '111827',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 64, type: WidthType.PERCENTAGE },
                margins: { top: 30, bottom: 30, left: 40, right: 40 },
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [
                      new TextRun({
                        text: r.value,
                        bold: !!r.isBoldVal,
                        size: 19,
                        font: 'Arial',
                        color: '1F2937',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    });
  };

  // Helper to render a 5-column photo row with zero margins and compact cells
  const renderPhotoRowTable = (photos: (PhotoItem | null)[]): Table => {
    const cells: TableCell[] = [];

    for (let col = 0; col < 5; col++) {
      const photo = photos[col];
      if (photo) {
        const imgBytes = photoBytesMap.get(photo.id);
        const cellParagraphs: Paragraph[] = [];

        if (imgBytes) {
          cellParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 20 },
              children: [
                new ImageRun({
                  data: imgBytes,
                  transformation: {
                    width: 93, // ~24.6mm (Fits 5 columns with margins)
                    height: 124, // ~32.8mm (Exact 3:4 rectangular ratio: 93/124 = 3/4)
                  },
                  type: 'png',
                }),
              ],
            })
          );
        }

        // Indication below photo (no captions; plain text for normal ID, yellow highlight for defects)
        const rawIndication = photo.tipoDefeito?.trim() || '';
        const normalIds = new Set([
          'CAPTOR TIPO FRANKLIN',
          'MEDIÇÃO DO MILIOHMÍMETRO',
          'PONTO DE INSPEÇÃO',
          'PONTO DE ATERRAMENTO',
          'OK. QUADRO COM DPS',
          'CENTRO DE MEDIÇÃO',
        ]);
        const isNormalOnly =
          rawIndication.length > 0 &&
          rawIndication
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
            .every((item) => normalIds.has(item));
        const isDefectAlert = !isNormalOnly && (!!rawIndication || !!photo.destaqueAlerta);

        if (isNormalOnly) {
          cellParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 40 },
              children: [
                new TextRun({
                  text: rawIndication,
                  size: 14, // 7pt
                  bold: true,
                  color: '1F2937',
                  font: 'Arial',
                }),
              ],
            })
          );
        } else if (isDefectAlert) {
          cellParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 40 },
              shading: {
                fill: 'FEF3C7',
                type: ShadingType.CLEAR,
                color: 'auto',
              },
              children: [
                new TextRun({
                  text: `⚠ ${rawIndication || 'FALTA EQUIPOTENCIALIZAR'}`,
                  size: 13, // 6.5pt
                  bold: true,
                  color: '92400E',
                  font: 'Arial',
                }),
                ...(photo.observacao
                  ? [
                      new TextRun({
                        text: ` (${photo.observacao})`,
                        size: 12,
                        italics: true,
                        color: '78350F',
                        font: 'Arial',
                      }),
                    ]
                  : []),
              ],
            })
          );
        }

        cells.push(
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
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
        // Empty slot maintaining exact 20% column geometry
        cells.push(
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({ spacing: { before: 0, after: 0 } })],
          })
        );
      }
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [new TableRow({ children: cells })],
    });
  };

  const docChildren: (Paragraph | Table)[] = [];

  // ==================== PAGE 1: CAPA E IDENTIFICAÇÃO DO LAUDO ====================
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
      children: [
        new TextRun({
          text: 'LAUDO TÉCNICO PERICIAL DE ENGENHARIA ELÉTRICA',
          bold: true,
          size: 24, // 12pt
          color: '991B1B',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: 'SISTEMA DE PROTEÇÃO CONTRA\nDESCARGAS ATMOSFÉRICAS (SPDA)',
          bold: true,
          size: 34, // 17pt
          color: '111827',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 180 },
      children: [
        new TextRun({
          text: 'Inspeção Visual, Medições de Continuidade Ôhmica & Avaliação NBR 5419:2026',
          size: 20,
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
                left: convertMillimetersToTwip(3.5),
                right: convertMillimetersToTwip(3.5),
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                left: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                right: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
              },
              children: [
                new Paragraph({
                  spacing: { before: 30, after: 30 },
                  children: [
                    new TextRun({
                      text: 'OBJETO DA INSPEÇÃO:\n',
                      bold: true,
                      size: 21,
                      font: 'Arial',
                      color: '111827',
                    }),
                    new TextRun({
                      text: report.modeloTextos.objetoInspecao,
                      size: 19,
                      font: 'Arial',
                      color: '1F2937',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 120, after: 60 } }),
    createBanner('DADOS DA EDIFICAÇÃO / CLIENTE'),
    new Paragraph({ spacing: { before: 40, after: 40 } }),
    createKeyValueTable([
      { label: 'CLIENTE:', value: report.cliente.cliente },
      { label: 'ENDEREÇO:', value: report.cliente.local },
      { label: 'MUNICÍPIO / UF:', value: report.cliente.municipioUf },
      { label: 'CNPJ:', value: report.cliente.cnpj },
      { label: 'RAMO DE ATIVIDADE:', value: report.cliente.ramoAtividade },
      { label: 'PERÍODO DE AVALIAÇÃO:', value: report.cliente.periodoAvaliacao },
      { label: 'GRAU DE EXPOSIÇÃO:', value: report.cliente.grauExposicao },
    ]),

    new Paragraph({ spacing: { before: 120, after: 60 } }),
    createBanner('RESPONSABILIDADE TÉCNICA & REGISTRO PROFISSIONAL'),
    new Paragraph({ spacing: { before: 40, after: 40 } }),
    createKeyValueTable([
      {
        label: 'RESPONSÁVEL TÉCNICO:',
        value: report.responsavelTecnico.responsavelTecnico,
        isBoldVal: true,
      },
      {
        label: 'QUALIFICAÇÃO PROFISSIONAL:',
        value: report.responsavelTecnico.qualificacao,
      },
      {
        label: 'REGISTRO CREA / CONFEA:',
        value: report.responsavelTecnico.registroCrea,
      },
      {
        label: 'CIDADE & DATA DE EMISSÃO:',
        value: `${report.responsavelTecnico.cidadeEmissao}, ${report.responsavelTecnico.dataEmissao}`,
      },
      {
        label: 'AUTENTICAÇÃO DIGITAL:',
        value: 'DOCUMENTO ASSINADO DIGITALMENTE (PÁGINA FINAL)',
        isBoldVal: true,
      },
    ]),

    // Page break after cover
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true })
  );

  // ==================== PAGE 2: INTRODUÇÃO, NORMAS, DICIONÁRIO & CREA ====================
  docChildren.push(
    new Paragraph({
      spacing: { before: 60, after: 80 },
      children: [
        new TextRun({
          text: '1) INTRODUÇÃO',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '111827',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: '1.1- ', bold: true, size: 19 }),
        new TextRun({ text: `${report.modeloTextos.introducao11}\n`, size: 19 }),
        new TextRun({ text: '1.2- ', bold: true, size: 19 }),
        new TextRun({ text: `${report.modeloTextos.introducao12}\n`, size: 19 }),
        new TextRun({ text: '1.3- ', bold: true, size: 19 }),
        new TextRun({ text: `${report.modeloTextos.introducao13}\n`, size: 19 }),
        new TextRun({ text: '1.4- ', bold: true, size: 19 }),
        new TextRun({ text: `${report.modeloTextos.introducao14}\n`, size: 19 }),
        ...report.modeloTextos.funcoesSpda.flatMap((f, idx) => [
          new TextRun({ text: `  ${String.fromCharCode(97 + idx)}) `, bold: true, size: 19 }),
          new TextRun({ text: `${f}\n`, size: 19 }),
        ]),
        new TextRun({
          text: '\nAs inspeções e levantamentos de informações foram efetuados na seguinte ordem:\n',
          size: 19,
          bold: true,
        }),
        ...report.modeloTextos.etapasInspecao.flatMap((e, idx) => [
          new TextRun({ text: `  ${String.fromCharCode(97 + idx)}) `, bold: true, size: 19 }),
          new TextRun({ text: `${e}\n`, size: 19 }),
        ]),
      ],
    }),

    createBanner('REFERÊNCIAS NORMATIVAS APLICÁVEIS'),
    new Paragraph({
      spacing: { before: 60, after: 100 },
      children: [
        new TextRun({
          text: 'Documentos indispensáveis à aplicação deste documento (edições mais recentes e emendas vigentes):\n',
          italics: true,
          size: 17,
          color: '4B5563',
        }),
        ...report.modeloTextos.referenciasNormativas.flatMap((norma) => [
          new TextRun({ text: `• ${norma}\n`, size: 17, color: '1F2937' }),
        ]),
      ],
    }),

    createBanner('2) DICIONÁRIO E ABREVIATURAS USADAS NESTE DOCUMENTO'),
    new Paragraph({
      spacing: { before: 60, after: 100 },
      children: report.modeloTextos.dicionario.flatMap((d) => [
        new TextRun({ text: `• ${d.termo}: `, bold: true, size: 17, color: '111827' }),
        new TextRun({ text: `${d.definicao}\n`, size: 17, color: '1F2937' }),
      ]),
    }),

    // CREA Box with thick blue left border
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: 'F0F9FF' },
              margins: {
                top: convertMillimetersToTwip(2),
                bottom: convertMillimetersToTwip(2),
                left: convertMillimetersToTwip(3),
                right: convertMillimetersToTwip(3),
              },
              borders: {
                left: { style: BorderStyle.SINGLE, size: 24, color: '0284C7' },
                top: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: 'CREA – CONSELHO REGIONAL DE ENGENHARIA E AGRONOMIA\n',
                      bold: true,
                      size: 19,
                      color: '0F172A',
                    }),
                    new TextRun({
                      text: report.modeloTextos.notaCrea,
                      size: 17,
                      color: '334155',
                    }),
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

  // ==================== PAGE 3: CARACTERÍSTICAS DA EDIFICAÇÃO & HISTÓRICO ====================
  docChildren.push(
    new Paragraph({
      spacing: { before: 60, after: 80 },
      children: [
        new TextRun({
          text: '3) CARACTERÍSTICAS DA EDIFICAÇÃO & LOCAL',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '111827',
        }),
      ],
    }),
    createBanner('3.1) VISTA AÉREA DA EDIFICAÇÃO / IMAGEM SATÉLITE')
  );

  if (fotoAereaData) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 30 },
        children: [
          new ImageRun({
            data: fotoAereaData.bytes,
            transformation: {
              width: fotoAereaData.width,
              height: fotoAereaData.height,
            },
            type: 'png',
          }),
        ],
      })
    );
  }
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: report.edificacao.fotoAereaLegenda, italics: true, size: 17 }),
      ],
    }),
    createBanner('PARÂMETROS CONSTRUTIVOS & INFRAESTRUTURA DA EDIFICAÇÃO (NBR 5419:2026)'),
    new Paragraph({ spacing: { before: 30, after: 30 } }),
    createKeyValueTable([
      { label: 'Tipologia Construtiva:', value: report.edificacao.tipologiaConstrutiva },
      { label: 'Topografia & Entorno:', value: report.edificacao.topografiaEntorno },
      { label: 'Nível de Proteção Dimensionado:', value: report.edificacao.nivelProtecao },
      { label: 'Métodos de Proteção Aplicáveis:', value: report.edificacao.metodosProtecao },
    ]),
    new Paragraph({ spacing: { before: 60, after: 40 } }),
    createBanner('3.2) FACHADA PRINCIPAL DA EDIFICAÇÃO / CONDOMÍNIO')
  );

  if (fotoFachadaData) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 30 },
        children: [
          new ImageRun({
            data: fotoFachadaData.bytes,
            transformation: {
              width: fotoFachadaData.width,
              height: fotoFachadaData.height,
            },
            type: 'png',
          }),
        ],
      })
    );
  }
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: report.edificacao.fotoFachadaLegenda, italics: true, size: 17 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `${report.edificacao.descricaoEdificacao}\n\n`,
          size: 19,
        }),
        new TextRun({
          text: `${report.modeloTextos.tituloSecao4 || '4) HISTÓRICO DE OCORRÊNCIAS & DESCARGAS ATMOSFÉRICAS'}\n`,
          bold: true,
          size: 21,
          color: '111827',
        }),
        new TextRun({ text: '4.1- Histórico: ', bold: true, size: 19 }),
        new TextRun({ text: `${report.edificacao.historicoOcorrencias}\n`, size: 19 }),
        new TextRun({ text: '4.2- ', bold: true, size: 19 }),
        new TextRun({ text: `${report.edificacao.historicoOcorrenciasComplemento}`, size: 19 }),
      ],
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ==================== PAGE 4: INSTRUMENTAÇÃO TÉCNICA E CRITÉRIOS DE INSPEÇÃO ====================
  docChildren.push(
    new Paragraph({
      spacing: { before: 60, after: 80 },
      children: [
        new TextRun({
          text:
            report.modeloTextos.tituloSecao5 ||
            '5) INSTRUMENTAÇÃO TÉCNICA E CRITÉRIOS DE INSPEÇÃO',
          bold: true,
          size: 22,
          color: '111827',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `${
            report.instrumentacao.textoIntroducao ||
            `Foram efetuadas medidas de continuidade elétrica e inspeção visual, com o uso do equipamento ${report.instrumentacao.equipamentoNome}. Os certificados de calibração estão em anexo.`
          }\n\n`,
          size: 19,
        }),
      ],
    }),
    // Equipment Box
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: 'F9FAFB' },
              margins: {
                top: convertMillimetersToTwip(2),
                bottom: convertMillimetersToTwip(2),
                left: convertMillimetersToTwip(3),
                right: convertMillimetersToTwip(3),
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
              },
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: `${report.instrumentacao.equipamentoNome}\n`,
                      bold: true,
                      size: 19,
                      color: '111827',
                    }),
                    new TextRun({
                      text: `${report.instrumentacao.equipamentoDescricao}\n\n`,
                      size: 17,
                      color: '4B5563',
                    }),
                    new TextRun({ text: 'Local: ', bold: true, size: 17 }),
                    new TextRun({ text: `${report.instrumentacao.localMedicao}\n`, size: 17 }),
                    new TextRun({ text: 'Corrente de Ensaio: ', bold: true, size: 17 }),
                    new TextRun({ text: `${report.instrumentacao.correnteEnsaio}\n`, size: 17 }),
                    new TextRun({ text: 'Tipo de Corrente: ', bold: true, size: 17 }),
                    new TextRun({ text: `${report.instrumentacao.tipoCorrente}`, size: 17 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 100, after: 60 } }),
    createBanner(
      report.instrumentacao.tituloParametrosContinuidades ||
        'PARÂMETROS NORMATIVOS DE CONTINUIDADE (ABNT NBR 5419:2026)'
    ),
    new Paragraph({ spacing: { before: 40, after: 40 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'F3F4F6' },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: report.instrumentacao.parametrosContinuidades.map(
        (param) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                margins: { top: 30, bottom: 30, left: 30, right: 30 },
                children: [
                  new Paragraph({
                    spacing: { before: 10, after: 10 },
                    children: [
                      new TextRun({ text: `• ${param.item}`, bold: true, size: 18 }),
                      new TextRun({ text: ` (${param.norma})`, size: 16, color: '4B5563' }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                margins: { top: 30, bottom: 30, left: 30, right: 30 },
                children: [
                  new Paragraph({
                    spacing: { before: 10, after: 10 },
                    children: [
                      new TextRun({ text: `Limite: ${param.limite}`, size: 17, font: 'Courier New' }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                margins: { top: 30, bottom: 30, left: 30, right: 30 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 10, after: 10 },
                    children: [
                      new TextRun({
                        text: `[${param.status}]`,
                        bold: true,
                        size: 17,
                        color:
                          param.status === 'CONFORME'
                            ? '047857'
                            : param.status === 'APLICADO'
                            ? '1D4ED8'
                            : 'B91C1C',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    }),

    new Paragraph({ spacing: { before: 100, after: 60 } }),
    createBanner(
      report.instrumentacao.tituloDps ||
        'PROTEÇÃO CONTRA SURTOS EM QUADROS ELÉTRICOS (ABNT NBR 5410 / NBR 5419-4)'
    ),
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [
        new TextRun({ text: report.instrumentacao.textoDps, size: 19, color: '1F2937' }),
      ],
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ==================== PAGES 5..N: VISTORIAS E ENSAIOS POR TORRE (USANDO O PAGINADOR EXATO DO APP) ====================
  const towerPages = buildTowerPages(report);

  towerPages.forEach((page, pageIdx) => {
    // If not the very first photo page, insert pageBreak
    if (pageIdx > 0) {
      docChildren.push(new Paragraph({ pageBreakBefore: true }));
    }

    page.blocks.forEach((block, bIdx) => {
      if (block.type === 'tower_header' && block.title) {
        docChildren.push(
          new Paragraph({
            spacing: { before: bIdx > 0 ? 120 : 40, after: 40 },
            children: [
              new TextRun({
                text: block.title,
                bold: true,
                size: 22,
                color: '111827',
                font: 'Arial',
              }),
            ],
          })
        );
      } else if (block.type === 'sub_header' && block.title) {
        docChildren.push(createBanner(block.title));
      } else if (block.type === 'photo_row' && block.photos) {
        docChildren.push(renderPhotoRowTable(block.photos));
      } else if (block.type === 'tower_note' && block.noteText) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 40, after: 60 },
            children: [
              new TextRun({ text: 'Observações Técnicas: ', bold: true, size: 17, color: '111827' }),
              new TextRun({ text: block.noteText, size: 17, color: '1F2937' }),
            ],
          })
        );
      }
    });
  });

  // ==================== FINAL PAGE: CORREÇÕES NECESSÁRIAS, CONCLUSÃO & ASSINATURA ====================
  docChildren.push(
    new Paragraph({ pageBreakBefore: true }),
    new Paragraph({
      spacing: { before: 60, after: 80 },
      children: [
        new TextRun({
          text:
            report.modeloTextos.tituloSecao7 ||
            '7) CORREÇÕES NECESSÁRIAS PARA PROTEÇÃO DAS EDIFICAÇÕES',
          bold: true,
          size: 22,
          color: '111827',
        }),
      ],
    }),
    createBanner(
      report.modeloTextos.subtituloSecao7 ||
        'Recomendações Técnicas Prioritárias (NBR 5419:2026)'
    ),
    new Paragraph({
      spacing: { before: 40, after: 80 },
      children: [
        ...report.modeloTextos.recomendacoesPrioritarias.flatMap((rec, idx) => [
          new TextRun({ text: `7.${idx + 1}- `, bold: true, color: 'B91C1C', size: 19 }),
          new TextRun({ text: `${rec}\n`, color: 'B91C1C', size: 19 }),
        ]),
        ...report.recomendacoesPersonalizadas.flatMap((rec, idx) => [
          new TextRun({
            text: `7.${report.modeloTextos.recomendacoesPrioritarias.length + idx + 1}- `,
            bold: true,
            color: 'B91C1C',
            size: 19,
          }),
          new TextRun({ text: `${rec}\n`, color: 'B91C1C', size: 19 }),
        ]),
        new TextRun({
          text: `\n${report.fechamentoRecomendacoesPersonalizado ?? (report.modeloTextos.fechamentoRecomendacoes || 'Fazer a correção de todos os itens apontados neste relatório, de forma ao sistema operar em sua perfeita harmonia.')}\n`,
          bold: true,
          size: 19,
          color: '111827',
        }),
      ],
    }),

    new Paragraph({
      spacing: { before: 80, after: 60 },
      children: [
        new TextRun({
          text:
            report.modeloTextos.tituloSecao8 ||
            '8) CONCLUSÃO & PARECER TÉCNICO PERICIAL',
          bold: true,
          size: 22,
          color: '111827',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: report.conclusaoPersonalizada ?? report.modeloTextos.conclusaoFinal,
          size: 19,
          color: '1F2937',
        }),
      ],
    }),
    ...((report.parecerArtPersonalizado ?? report.modeloTextos.parecerArt)
      ? [
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: report.parecerArtPersonalizado ?? report.modeloTextos.parecerArt ?? '',
                size: 19,
                bold: true,
                color: '1F2937',
              }),
            ],
          }),
        ]
      : []),

    // Disposições Finais
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: {
                top: convertMillimetersToTwip(2.5),
                bottom: convertMillimetersToTwip(2.5),
                left: convertMillimetersToTwip(3.5),
                right: convertMillimetersToTwip(3.5),
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                left: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
                right: { style: BorderStyle.SINGLE, size: 8, color: '374151' },
              },
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: `${report.modeloTextos.tituloDisposicoesFinais || 'DISPOSIÇÕES FINAIS & VALIDADE DA INSPEÇÃO:'}\n`,
                      bold: true,
                      size: 19,
                      color: '111827',
                    }),
                    new TextRun({
                      text: report.disposicoesFinaisPersonalizada ?? report.modeloTextos.disposicoesFinais,
                      size: 18,
                      color: '1F2937',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // City, Date and Signature Block
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 180, after: 120 },
      children: [
        new TextRun({
          text: `${report.responsavelTecnico.cidadeEmissao}, ${report.responsavelTecnico.dataEmissao}.`,
          bold: true,
          size: 20,
          color: '111827',
        }),
      ],
    })
  );

  if (assinaturaBytes) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 20 },
        children: [
          new ImageRun({
            data: assinaturaBytes,
            transformation: { width: 180, height: 60 },
            type: 'png',
          }),
        ],
      })
    );
  }

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 20 },
      children: [
        new TextRun({
          text: '________________________________________________________\n',
          color: '374151',
          size: 18,
        }),
        new TextRun({
          text: `${report.responsavelTecnico.responsavelTecnico.toUpperCase()}\n`,
          bold: true,
          size: 21,
          color: '111827',
        }),
        new TextRun({
          text: `${report.responsavelTecnico.qualificacao}\n`,
          size: 18,
          color: '374151',
        }),
        new TextRun({
          text: `${report.responsavelTecnico.registroCrea} | ART: ${report.responsavelTecnico.numeroArt}`,
          size: 17,
          color: '4B5563',
        }),
      ],
    })
  );

  // Final page ends at conclusion & signature

  // ==================== DOCUMENT HEADER & FOOTER DEFINITION ====================
  const cabecalho1 =
    report.empresa.cabecalhoLinha1 !== undefined
      ? report.empresa.cabecalhoLinha1
      : report.empresa.nome;
  const cabecalho2 =
    report.empresa.cabecalhoLinha2 !== undefined ? report.empresa.cabecalhoLinha2 : '';

  const noCellBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = {
    top: noCellBorder,
    bottom: noCellBorder,
    left: noCellBorder,
    right: noCellBorder,
    insideHorizontal: noCellBorder,
    insideVertical: noCellBorder,
  };

  const leftHeaderParagraphs: Paragraph[] = [];
  if (cabecalho1) {
    leftHeaderParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: cabecalho2 ? 20 : 0 },
        children: [
          new TextRun({
            text: cabecalho1.toUpperCase(),
            bold: true,
            size: 19,
            color: '1E293B',
            font: 'Arial',
          }),
        ],
      })
    );
  }
  if (cabecalho2) {
    leftHeaderParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: cabecalho2,
            size: 15,
            color: '64748B',
            font: 'Arial',
          }),
        ],
      })
    );
  }
  if (leftHeaderParagraphs.length === 0) {
    leftHeaderParagraphs.push(new Paragraph({ spacing: { before: 0, after: 0 } }));
  }

  const rightHeaderParagraph = logoData
    ? new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: logoData.bytes,
            transformation: {
              width: logoData.width,
              height: logoData.height,
            },
            type: 'png',
          }),
        ],
      })
    : new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: report.empresa.nome.toUpperCase(),
            bold: true,
            size: 18,
            color: '1E293B',
            font: 'Arial',
          }),
        ],
      });

  const docHeaderChildren: (Paragraph | Table)[] = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlignTable.CENTER,
              borders: noBorders,
              margins: { top: 0, bottom: 40, left: 0, right: 120 },
              children: leftHeaderParagraphs,
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlignTable.CENTER,
              borders: noBorders,
              margins: { top: 0, bottom: 40, left: 0, right: 0 },
              children: [rightHeaderParagraph],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: 'B91C1C' },
      },
      spacing: { before: 0, after: 80 },
    }),
  ];

  const rodape1 =
    report.empresa.rodapeLinha1 !== undefined
      ? report.empresa.rodapeLinha1
      : `${report.empresa.nome} - CNPJ: ${report.empresa.cnpj} – FONE: ${report.empresa.telefone}`;
  const rodape2 =
    report.empresa.rodapeLinha2 !== undefined
      ? report.empresa.rodapeLinha2
      : `${report.empresa.endereco} – ${report.empresa.cidadeUf}`;

  const footerTopBorder = { style: BorderStyle.SINGLE, size: 6, color: '334155' };
  const footerCellBorders = {
    top: footerTopBorder,
    bottom: noCellBorder,
    left: noCellBorder,
    right: noCellBorder,
  };

  const footerTextParagraphs: Paragraph[] = [];
  if (rodape1) {
    footerTextParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: rodape2 ? 10 : 0 },
        children: [
          new TextRun({
            text: rodape1,
            bold: true,
            size: 14,
            color: '1E293B',
            font: 'Arial',
          }),
        ],
      })
    );
  }
  if (rodape2) {
    footerTextParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: rodape2,
            bold: true,
            size: 14,
            color: '1E293B',
            font: 'Arial',
          }),
        ],
      })
    );
  }
  if (footerTextParagraphs.length === 0) {
    footerTextParagraphs.push(new Paragraph({ spacing: { before: 20, after: 0 } }));
  }

  const docFooterChildren: (Paragraph | Table)[] = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: footerTopBorder,
        bottom: noCellBorder,
        left: noCellBorder,
        right: noCellBorder,
        insideHorizontal: noCellBorder,
        insideVertical: noCellBorder,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 82, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlignTable.CENTER,
              borders: footerCellBorders,
              margins: { top: 40, bottom: 0, left: 0, right: 80 },
              children: footerTextParagraphs,
            }),
            new TableCell({
              width: { size: 18, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlignTable.BOTTOM,
              borders: footerCellBorders,
              margins: { top: 40, bottom: 0, left: 0, right: 0 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: 'Página ',
                      size: 14,
                      color: '475569',
                      font: 'Arial',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 14,
                      bold: true,
                      color: '334155',
                      font: 'Arial',
                    }),
                    new TextRun({
                      text: ' de ',
                      size: 14,
                      color: '475569',
                      font: 'Arial',
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 14,
                      bold: true,
                      color: '334155',
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
  ];

  // Document Assembly
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 210mm in twips
              height: 16838, // A4 297mm in twips
            },
            margin: {
              top: 720, // 0.5 inch (12.7mm)
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        headers: {
          default: new Header({ children: docHeaderChildren }),
        },
        footers: {
          default: new Footer({ children: docFooterChildren }),
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Triggers direct download of the Word document (.docx)
 */
export async function exportReportToDocx(
  report: SpdaReport,
  onProgress?: (msg: string) => void
): Promise<void> {
  const blob = await generateReportDocxBlob(report, onProgress);
  const fileName = getReportFileName(report, 'docx');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

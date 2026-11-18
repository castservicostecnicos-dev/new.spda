/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpdaReport, Tower, PhotoItem } from '../types/spda';

export interface ReportSectionBlock {
  type: 'tower_header' | 'sub_header' | 'photo_row' | 'tower_note' | 'empty_row';
  title?: string;
  subTitle?: string;
  noteText?: string;
  towerName?: string;
  towerIndexStr?: string;
  photos?: (PhotoItem | null)[]; // Exactly 5 slots per row
  heightWeight: number; // in approximate row units
}

export interface GeneratedReportPage {
  pageNumber: number;
  blocks: ReportSectionBlock[];
  watermarkText: string;
}

/**
 * Splits an array of photos into rows of exactly 5 columns.
 * Missing items in a row are padded with `null` so the grid cell remains empty
 * while preserving the exact fixed size of all preceding photos!
 */
export function chunkInto5Columns(photos: PhotoItem[]): (PhotoItem | null)[][] {
  const rows: (PhotoItem | null)[][] = [];
  for (let i = 0; i < photos.length; i += 5) {
    const chunk: (PhotoItem | null)[] = photos.slice(i, i + 5);
    // Pad to 5 so each slot is rendered at exact standardized 1/5 width
    while (chunk.length < 5) {
      chunk.push(null);
    }
    rows.push(chunk);
  }
  return rows;
}

/**
 * Calculates dynamic inspection pages for all registered towers and optional common area,
 * packing rows smartly while obeying:
 * - Exactly 5 images per row
 * - Up to 6 rows of photos per page
 * - When 5 rows do not fill the page height, it adds a 6th row to fill the empty space
 * - If 6 rows together with titles do not fit, it automatically pulls back and eliminates the 6th row, pushing it to the next page
 * - Never separating a subsection title from its first row of photos (prevents orphan headers)
 */
export function buildTowerPages(report: SpdaReport, startPageNum = 5): GeneratedReportPage[] {
  const pages: GeneratedReportPage[] = [];
  let currentPageBlocks: ReportSectionBlock[] = [];
  let currentHeightPx = 0;
  let currentPhotoRowsOnPage = 0;

  // Rule: 5 photos per row, up to 5 rows per page.
  // If a 5th row would overlap the footer, keep 4 rows and start the next page with that row.
  const MAX_ROWS_PER_PAGE = 5;

  // Exact A4 usable vertical height (297mm = 1122px minus top/bottom padding 45px, header 52px, footer 38px, safety margin 22px):
  const MAX_CONTENT_HEIGHT_PX = 965;
  const TOWER_HEADER_PX = 30;
  const SUB_HEADER_PX = 32;
  const BASE_PHOTO_ROW_PX = 191; // 185px (3:4 photo at 5-col width) + 6px vertical gap
  const NOTE_PX = 48;

  // Calculate exact pixel height of a photo row including any observation/yellow alert text below photos
  function getPhotoRowHeightPx(row: (PhotoItem | null)[]): number {
    let maxExtraPx = 0;
    for (const photo of row) {
      if (!photo) continue;
      const text = photo.tipoDefeito?.trim() || (photo.destaqueAlerta ? 'FALTA EQUIPOTENCIALIZAR' : '');
      if (text.length > 0) {
        // ~22 chars fit per line in a 138px column at 6.5–7px bold
        const textLines = Math.max(1, Math.ceil((text.length + 2) / 22));
        const obsLines = photo.observacao ? Math.max(1, Math.ceil(photo.observacao.length / 24)) : 0;
        const extra = (textLines + obsLines) * 11 + 8;
        if (extra > maxExtraPx) {
          maxExtraPx = extra;
        }
      }
    }
    return BASE_PHOTO_ROW_PX + maxExtraPx;
  }

  function pushPage() {
    if (currentPageBlocks.length > 0) {
      pages.push({
        pageNumber: startPageNum + pages.length,
        blocks: [...currentPageBlocks],
        watermarkText: report.empresa.marcaDaguaTexto || 'SPDA 2026',
      });
      currentPageBlocks = [];
      currentHeightPx = 0;
      currentPhotoRowsOnPage = 0;
    }
  }

  function canFitPhotoRow(rowHeightPx: number): boolean {
    if (currentPhotoRowsOnPage >= MAX_ROWS_PER_PAGE) {
      return false;
    }
    return currentHeightPx + rowHeightPx <= MAX_CONTENT_HEIGHT_PX;
  }

  function addPhotoRow(row: (PhotoItem | null)[]) {
    const rowHeightPx = getPhotoRowHeightPx(row);
    // If adding this row (e.g., 5th row) would overlap the footer, push current page (4 rows)
    // and start the next page with this row as the 1st row.
    if (!canFitPhotoRow(rowHeightPx)) {
      pushPage();
    }

    currentPageBlocks.push({
      type: 'photo_row',
      photos: row,
      heightWeight: rowHeightPx / BASE_PHOTO_ROW_PX,
    });
    currentHeightPx += rowHeightPx;
    currentPhotoRowsOnPage += 1;
  }

  const prefixoSecao6 =
    report.modeloTextos?.tituloSecao6Prefixo?.trim() || 'VISTORIA & ENSAIOS TÉCNICOS';
  const subtituloEnsaio =
    report.modeloTextos?.subtituloSecao6Ensaio?.trim() ||
    'PONTOS DE ENSAIO DE CONTINUIDADE ÔHMICA (MILIOHMÍMETRO)';
  const subtituloSpda =
    report.modeloTextos?.subtituloSecao6Spda?.trim() ||
    'VISTORIA DO SPDA EXISTENTE, CAPTORES & DESCIDAS';
  const subtituloQuadros =
    report.modeloTextos?.subtituloSecao6Quadros?.trim() ||
    'ANÁLISE DOS QUADROS DE ENERGIA & DPS (ABNT NBR 5410)';

  function addTowerNote(note: string) {
    if (currentHeightPx + NOTE_PX > MAX_CONTENT_HEIGHT_PX) {
      pushPage();
    }
    currentPageBlocks.push({
      type: 'tower_note',
      noteText: note,
      heightWeight: NOTE_PX / BASE_PHOTO_ROW_PX,
    });
    currentHeightPx += NOTE_PX;
  }

  // Iterate over each Tower in a CONTINUOUS DENSE FLOW without artificial breaks between towers!
  report.torres.forEach((tower, tIndex) => {
    const towerIndexStr = `6.${tIndex + 1}`;
    const towerTitle = `${towerIndexStr}) ${prefixoSecao6}: ${tower.nome.toUpperCase()}`;

    // Subsections for this tower
    const subSections: Array<{
      id: string;
      title: string;
      photos: PhotoItem[];
    }> = [
      {
        id: 'ensaio',
        title: `${towerIndexStr}.1) ${subtituloEnsaio}`,
        photos: tower.fotosEnsaio,
      },
      {
        id: 'spda',
        title: `${towerIndexStr}.2) ${subtituloSpda}`,
        photos: tower.fotosSpda,
      },
      {
        id: 'quadros',
        title: `${towerIndexStr}.3) ${subtituloQuadros}`,
        photos: tower.fotosQuadros,
      },
    ];

    let towerHeaderAdded = false;

    subSections.forEach((sub) => {
      const photoRows = chunkInto5Columns(sub.photos);
      if (photoRows.length === 0) return;

      // Cost to start subsection:
      // (tower header if not yet added) + subheader + 1st photo row to prevent orphan title
      const needsTowerHeader = !towerHeaderAdded;
      const firstRowHeightPx = getPhotoRowHeightPx(photoRows[0]);
      const initialHeightPx =
        (needsTowerHeader ? TOWER_HEADER_PX : 0) + SUB_HEADER_PX + firstRowHeightPx;

      // If the initial block (header + 1st row) does not fit on current page or current page already has max rows:
      if (
        currentHeightPx + initialHeightPx > MAX_CONTENT_HEIGHT_PX ||
        currentPhotoRowsOnPage >= MAX_ROWS_PER_PAGE
      ) {
        pushPage();
      }

      if (!towerHeaderAdded) {
        currentPageBlocks.push({
          type: 'tower_header',
          title: towerTitle,
          towerName: tower.nome,
          towerIndexStr,
          heightWeight: TOWER_HEADER_PX / BASE_PHOTO_ROW_PX,
        });
        currentHeightPx += TOWER_HEADER_PX;
        towerHeaderAdded = true;
      }

      // Add subsection title
      currentPageBlocks.push({
        type: 'sub_header',
        title: sub.title,
        heightWeight: SUB_HEADER_PX / BASE_PHOTO_ROW_PX,
      });
      currentHeightPx += SUB_HEADER_PX;

      // Add each photo row, packing up to 5 rows per page without ever overlapping the footer
      photoRows.forEach((row) => {
        addPhotoRow(row);
      });
    });

    if (tower.observacoes && tower.observacoes.trim()) {
      if (!towerHeaderAdded) {
        if (currentHeightPx + TOWER_HEADER_PX + NOTE_PX > MAX_CONTENT_HEIGHT_PX) {
          pushPage();
        }
        currentPageBlocks.push({
          type: 'tower_header',
          title: towerTitle,
          towerName: tower.nome,
          towerIndexStr,
          heightWeight: TOWER_HEADER_PX / BASE_PHOTO_ROW_PX,
        });
        currentHeightPx += TOWER_HEADER_PX;
        towerHeaderAdded = true;
      }
      addTowerNote(tower.observacoes.trim());
    }

    // NOTE: Between towers, we DO NOT force a page break!
    // If the page still has room, the next tower starts immediately on the same page.
  });

  // Handle common area if enabled (continues on same page if room available)
  if (report.areaComum.habilitada) {
    const commonIndexStr = `6.${report.torres.length + 1}`;
    const commonTitle = `${commonIndexStr}) ${prefixoSecao6}: ${report.areaComum.nome.toUpperCase()}`;

    const commonSubSections = [
      {
        id: 'spda_comum',
        title: `${commonIndexStr}.2) ${subtituloSpda}`,
        photos: report.areaComum.fotosSpda,
      },
      {
        id: 'quadros_comum',
        title: `${commonIndexStr}.3) ${subtituloQuadros}`,
        photos: report.areaComum.fotosQuadros,
      },
    ];

    let commonHeaderAdded = false;

    commonSubSections.forEach((sub) => {
      const photoRows = chunkInto5Columns(sub.photos);
      if (photoRows.length === 0) return;

      const needsCommonHeader = !commonHeaderAdded;
      const firstRowHeightPx = getPhotoRowHeightPx(photoRows[0]);
      const initialHeightPx =
        (needsCommonHeader ? TOWER_HEADER_PX : 0) + SUB_HEADER_PX + firstRowHeightPx;

      if (
        currentHeightPx + initialHeightPx > MAX_CONTENT_HEIGHT_PX ||
        currentPhotoRowsOnPage >= MAX_ROWS_PER_PAGE
      ) {
        pushPage();
      }

      if (!commonHeaderAdded) {
        currentPageBlocks.push({
          type: 'tower_header',
          title: commonTitle,
          towerName: report.areaComum.nome,
          towerIndexStr: commonIndexStr,
          heightWeight: TOWER_HEADER_PX / BASE_PHOTO_ROW_PX,
        });
        currentHeightPx += TOWER_HEADER_PX;
        commonHeaderAdded = true;
      }

      currentPageBlocks.push({
        type: 'sub_header',
        title: sub.title,
        heightWeight: SUB_HEADER_PX / BASE_PHOTO_ROW_PX,
      });
      currentHeightPx += SUB_HEADER_PX;

      photoRows.forEach((row) => {
        addPhotoRow(row);
      });
    });

    if (report.areaComum.observacoes && report.areaComum.observacoes.trim()) {
      if (!commonHeaderAdded) {
        if (currentHeightPx + TOWER_HEADER_PX + NOTE_PX > MAX_CONTENT_HEIGHT_PX) {
          pushPage();
        }
        currentPageBlocks.push({
          type: 'tower_header',
          title: commonTitle,
          towerName: report.areaComum.nome,
          towerIndexStr: commonIndexStr,
          heightWeight: TOWER_HEADER_PX / BASE_PHOTO_ROW_PX,
        });
        currentHeightPx += TOWER_HEADER_PX;
        commonHeaderAdded = true;
      }
      addTowerNote(report.areaComum.observacoes.trim());
    }
  }

  // Push remaining blocks if any
  if (currentPageBlocks.length > 0) {
    pushPage();
  }

  return pages;
}

/**
 * Calculates the total page count of the entire document:
 * Page 1: Capa
 * Page 2: Introdução, Referências, Dicionário
 * Page 3: Características da Edificação, Histórico
 * Page 4: Instrumentação e Critérios, DPS
 * Pages 5..N: Tower & Common Area inspection pages (up to 6 rows per page)
 * Page N+1: Recomendações Prioritárias, Conclusão, Assinatura e Disposições Finais
 */
export function calculateTotalPages(report: SpdaReport): {
  towerPages: GeneratedReportPage[];
  totalPages: number;
} {
  const towerPages = buildTowerPages(report, 5);
  // Total is: 4 initial pages + tower pages + 1 final conclusion page
  const totalPages = 4 + towerPages.length + 1;
  return { towerPages, totalPages };
}

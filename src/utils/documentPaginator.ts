/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpdaReport, Tower, PhotoItem } from '../types/spda';

export interface ReportSectionBlock {
  type: 'tower_header' | 'sub_header' | 'photo_row' | 'empty_row';
  title?: string;
  subTitle?: string;
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
  let currentCapacityUsed = 0;
  let currentPhotoRowsOnPage = 0;

  // Maximum photo rows allowed on any single page: up to 5 full lines of photos
  const MAX_ROWS_PER_PAGE = 5;

  // Calibrated vertical page capacity for dense, compact A4 layout without blank gaps:
  // - A 3x4 photo row = 1.0 unit (~185px)
  // - A sub_header banner = 0.12 unit (~20px)
  // - A tower_header = 0.10 unit (~18px)
  // - 5 full photo rows = 5.0 <= 5.15 (Fits tightly and cleanly on A4)
  // - 4 photo rows + 1 tower header + 1 subheader = 4.0 + 0.10 + 0.12 = 4.22 <= 5.15 (Fits with room)
  // - 4 photo rows + 2 tower headers + 2 subheaders = 4.0 + 0.44 = 4.44 <= 5.15 (Fits: Tower 1 ends & Tower 2 starts on same page)
  const MAX_CAPACITY_PER_PAGE = 5.15;
  const TOWER_HEADER_COST = 0.10;
  const SUB_HEADER_COST = 0.12;
  const PHOTO_ROW_COST = 1.0;

  function pushPage() {
    if (currentPageBlocks.length > 0) {
      pages.push({
        pageNumber: startPageNum + pages.length,
        blocks: [...currentPageBlocks],
        watermarkText: report.empresa.marcaDaguaTexto || 'SPDA 2026',
      });
      currentPageBlocks = [];
      currentCapacityUsed = 0;
      currentPhotoRowsOnPage = 0;
    }
  }

  function canFitPhotoRow(): boolean {
    if (currentPhotoRowsOnPage >= MAX_ROWS_PER_PAGE) {
      return false;
    }
    return currentCapacityUsed + PHOTO_ROW_COST <= MAX_CAPACITY_PER_PAGE;
  }

  function addPhotoRow(row: (PhotoItem | null)[]) {
    // If another row doesn't fit on this page, push to the next page
    if (!canFitPhotoRow()) {
      pushPage();
    }

    currentPageBlocks.push({
      type: 'photo_row',
      photos: row,
      heightWeight: PHOTO_ROW_COST,
    });
    currentCapacityUsed += PHOTO_ROW_COST;
    currentPhotoRowsOnPage += 1;
  }

  // Iterate over each Tower in a CONTINUOUS DENSE FLOW without artificial breaks between towers!
  report.torres.forEach((tower, tIndex) => {
    const towerIndexStr = `6.${tIndex + 1}`;
    const towerTitle = `${towerIndexStr}) VISTORIA & ENSAIOS TÉCNICOS: ${tower.nome.toUpperCase()}`;

    // Subsections for this tower
    const subSections: Array<{
      id: string;
      title: string;
      photos: PhotoItem[];
    }> = [
      {
        id: 'ensaio',
        title: `${towerIndexStr}.1) PONTOS DE ENSAIO DE CONTINUIDADE ÔHMICA (MILIOHMÍMETRO)`,
        photos: tower.fotosEnsaio,
      },
      {
        id: 'spda',
        title: `${towerIndexStr}.2) VISTORIA DO SPDA EXISTENTE, CAPTORES & DESCIDAS`,
        photos: tower.fotosSpda,
      },
      {
        id: 'quadros',
        title: `${towerIndexStr}.3) ANÁLISE DOS QUADROS DE ENERGIA & DPS (ABNT NBR 5410)`,
        photos: tower.fotosQuadros,
      },
    ];

    let towerHeaderAdded = false;

    subSections.forEach((sub) => {
      const photoRows = chunkInto5Columns(sub.photos);
      if (photoRows.length === 0) return;

      // Cost to start subsection:
      // (tower header if not yet added) + subheader + at least 1 photo row to prevent orphan title
      const needsTowerHeader = !towerHeaderAdded;
      const initialCost = (needsTowerHeader ? TOWER_HEADER_COST : 0) + SUB_HEADER_COST + PHOTO_ROW_COST;

      // If the initial block (header + 1st row) does not fit on current page or current page already has max rows:
      if (
        currentCapacityUsed + initialCost > MAX_CAPACITY_PER_PAGE ||
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
          heightWeight: TOWER_HEADER_COST,
        });
        currentCapacityUsed += TOWER_HEADER_COST;
        towerHeaderAdded = true;
      }

      // Add subsection title
      currentPageBlocks.push({
        type: 'sub_header',
        title: sub.title,
        heightWeight: SUB_HEADER_COST,
      });
      currentCapacityUsed += SUB_HEADER_COST;

      // Add each photo row, packing up to 5 rows per page
      photoRows.forEach((row) => {
        addPhotoRow(row);
      });
    });

    // NOTE: Between towers, we DO NOT force a page break!
    // If the page still has room, the next tower starts immediately on the same page.
  });

  // Handle common area if enabled (continues on same page if room available)
  if (report.areaComum.habilitada) {
    const commonIndexStr = `6.${report.torres.length + 1}`;
    const commonTitle = `${commonIndexStr}) VISTORIA & ENSAIOS TÉCNICOS: ${report.areaComum.nome.toUpperCase()}`;

    const commonSubSections = [
      {
        id: 'spda_comum',
        title: `${commonIndexStr}.2) VISTORIA DO SPDA EXISTENTE, CAPTORES & DESCIDAS`,
        photos: report.areaComum.fotosSpda,
      },
      {
        id: 'quadros_comum',
        title: `${commonIndexStr}.3) ANÁLISE DOS QUADROS DE ENERGIA & DPS (ABNT NBR 5410)`,
        photos: report.areaComum.fotosQuadros,
      },
    ];

    let commonHeaderAdded = false;

    commonSubSections.forEach((sub) => {
      const photoRows = chunkInto5Columns(sub.photos);
      if (photoRows.length === 0) return;

      const needsCommonHeader = !commonHeaderAdded;
      const initialCost = (needsCommonHeader ? TOWER_HEADER_COST : 0) + SUB_HEADER_COST + PHOTO_ROW_COST;

      if (
        currentCapacityUsed + initialCost > MAX_CAPACITY_PER_PAGE ||
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
          heightWeight: TOWER_HEADER_COST,
        });
        currentCapacityUsed += TOWER_HEADER_COST;
        commonHeaderAdded = true;
      }

      currentPageBlocks.push({
        type: 'sub_header',
        title: sub.title,
        heightWeight: SUB_HEADER_COST,
      });
      currentCapacityUsed += SUB_HEADER_COST;

      photoRows.forEach((row) => {
        addPhotoRow(row);
      });
    });
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

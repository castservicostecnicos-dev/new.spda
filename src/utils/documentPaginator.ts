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

  // Maximum photo rows allowed on any page: up to 6 lines per page
  const MAX_ROWS_PER_PAGE = 6;

  // Calibrated vertical page capacity:
  // - A photo row costs 1.0 unit.
  // - A sub_header banner costs 0.35 unit.
  // - A tower_header costs 0.55 unit.
  // - 6 photo rows with 0 headers: 6 * 1.0 = 6.00 <= 6.35 (FITS: fills the whole page!)
  // - 6 photo rows with 1 compact sub_header: 0.35 + 6.0 = 6.35 <= 6.35 (FITS: fills page without gap!)
  // - 6 photo rows with tower_header + sub_header: 0.55 + 0.35 + 6.0 = 6.90 > 6.35 (DOES NOT FIT: eliminates 6th row and keeps 5 rows!)
  const MAX_CAPACITY_PER_PAGE = 6.35;

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
    return currentCapacityUsed + 1.0 <= MAX_CAPACITY_PER_PAGE;
  }

  function addPhotoRow(row: (PhotoItem | null)[]) {
    // If a 6th row (or subsequent row) does not fit on the current page,
    // "Caso não caiba, ele volta e elimina a última linha", pushing it to the new page.
    if (!canFitPhotoRow()) {
      pushPage();
    }

    currentPageBlocks.push({
      type: 'photo_row',
      photos: row,
      heightWeight: 1.0,
    });
    currentCapacityUsed += 1.0;
    currentPhotoRowsOnPage += 1;
  }

  // Iterate over each Tower
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
      const initialCost = (needsTowerHeader ? 0.55 : 0) + 0.35 + 1.0;

      // If the initial block (header + 1st row) does not fit on current page or current page already has 6 rows:
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
          heightWeight: 0.55,
        });
        currentCapacityUsed += 0.55;
        towerHeaderAdded = true;
      }

      // Add subsection title
      currentPageBlocks.push({
        type: 'sub_header',
        title: sub.title,
        heightWeight: 0.35,
      });
      currentCapacityUsed += 0.35;

      // Add each photo row, testing if the 5th and 6th rows fit dynamically
      photoRows.forEach((row) => {
        addPhotoRow(row);
      });
    });

    // Between towers: if remaining vertical space cannot fit a new tower's header and first row, break page
    const nextTowerInitialCost = 0.55 + 0.35 + 1.0; // 1.90
    if (currentCapacityUsed + nextTowerInitialCost > MAX_CAPACITY_PER_PAGE || currentPhotoRowsOnPage >= 5) {
      pushPage();
    }
  });

  // Handle common area if enabled
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
      const initialCost = (needsCommonHeader ? 0.55 : 0) + 0.35 + 1.0;

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
          heightWeight: 0.55,
        });
        currentCapacityUsed += 0.55;
        commonHeaderAdded = true;
      }

      currentPageBlocks.push({
        type: 'sub_header',
        title: sub.title,
        heightWeight: 0.35,
      });
      currentCapacityUsed += 0.35;

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

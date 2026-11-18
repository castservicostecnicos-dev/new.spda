/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { SpdaReport } from '../types/spda';

export interface PdfExportProgress {
  currentPage: number;
  totalPages: number;
  status: string;
}

/**
 * Generates a high-quality PDF Blob directly from the rendered DOM pages of PdfDocumentView.
 * Uses html2canvas-pro (native oklch/oklab support) capturing each .a4-page at exact 1:1 A4 size.
 */
export async function generateReportPdfBlob(
  report: SpdaReport,
  onProgress?: (progress: PdfExportProgress) => void
): Promise<Blob> {
  const pageElements = document.querySelectorAll<HTMLElement>('.a4-page');

  if (!pageElements || pageElements.length === 0) {
    throw new Error(
      'Visualização do laudo não encontrada na tela. Por favor, acesse a aba "Visualizar Laudo" antes de exportar.'
    );
  }

  const totalPages = pageElements.length;
  const A4_WIDTH_PX = 794;
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  // Initialize A4 PDF: 210mm x 297mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < totalPages; i++) {
    const pageEl = pageElements[i];

    if (onProgress) {
      onProgress({
        currentPage: i + 1,
        totalPages,
        status: `Processando página ${i + 1} de ${totalPages}...`,
      });
    }

    // Capture the exact unscaled A4 page at 2x resolution for crisp print fidelity
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
      onclone: (_clonedDoc, clonedEl) => {
        // Reset mobile preview scaling/zoom so the captured page is 100% native 1:1 A4 (794px wide)
        clonedEl.style.transform = 'none';
        (clonedEl.style as unknown as { zoom?: string }).zoom = '1';
        clonedEl.style.position = 'relative';
        clonedEl.style.top = '0';
        clonedEl.style.left = '0';
        clonedEl.style.margin = '0';
        clonedEl.style.width = `${A4_WIDTH_PX}px`;
        clonedEl.style.backgroundColor = '#ffffff';

        const parent = clonedEl.parentElement;
        if (parent) {
          parent.style.width = `${A4_WIDTH_PX}px`;
          parent.style.height = 'auto';
          parent.style.overflow = 'visible';
          parent.style.transform = 'none';
          parent.style.backgroundColor = '#ffffff';
        }
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    const imgHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;
    const pageHeightMm = imgHeightMm > A4_HEIGHT_MM + 2 ? imgHeightMm : A4_HEIGHT_MM;

    if (i > 0) {
      pdf.addPage([A4_WIDTH_MM, pageHeightMm], 'portrait');
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, imgHeightMm, undefined, 'FAST');
  }

  if (onProgress) {
    onProgress({
      currentPage: totalPages,
      totalPages,
      status: 'Finalizando compilação do arquivo PDF...',
    });
  }

  return pdf.output('blob');
}

/**
 * Generates a filename for the report
 */
export function getReportFileName(report: SpdaReport, extension: 'pdf' | 'docx' = 'pdf'): string {
  const cleanCondo = (report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Laudo_SPDA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const cleanDate = (report.responsavelTecnico.dataEmissao || new Date().toISOString().slice(0, 10))
    .replace(/\//g, '-');

  return `Laudo_SPDA_${cleanCondo}_${cleanDate}.${extension}`;
}

/**
 * Triggers direct download of the PDF blob in browser
 */
export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

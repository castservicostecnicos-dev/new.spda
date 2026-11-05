/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SpdaReport } from '../types/spda';

export interface PdfExportProgress {
  currentPage: number;
  totalPages: number;
  status: string;
}

/**
 * Generates a high-quality PDF Blob directly from the rendered DOM pages of PdfDocumentView.
 * This produces an actual .pdf file that can be sent via WhatsApp, E-mail, Web Share,
 * or downloaded directly without opening the browser's printer dialog.
 */
export async function generateReportPdfBlob(
  report: SpdaReport,
  onProgress?: (progress: PdfExportProgress) => void
): Promise<Blob> {
  const pageElements = document.querySelectorAll<HTMLElement>('.page-outer-container');

  if (!pageElements || pageElements.length === 0) {
    throw new Error(
      'Visualização do laudo não encontrada na tela. Por favor, acesse a aba "Visualizar Laudo" antes de exportar.'
    );
  }

  const totalPages = pageElements.length;
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

    // Capture the page at 2x resolution for print-quality sharpness
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      imageTimeout: 15000,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.94);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // A4 dimensions: 210 x 297 mm
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
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

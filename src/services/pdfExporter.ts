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

// Reusable 1x1 canvas to convert any modern CSS color (oklch, oklab, color-mix, etc.) to standard rgba()
let colorCanvasCtx: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, string>();

function cssColorToRgba(cssColor: string): string {
  const cached = colorCache.get(cssColor);
  if (cached) return cached;

  try {
    if (!colorCanvasCtx) {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      colorCanvasCtx = c.getContext('2d', { willReadFrequently: true });
    }
    if (!colorCanvasCtx) return '#000000';

    colorCanvasCtx.clearRect(0, 0, 1, 1);
    colorCanvasCtx.fillStyle = '#000000';
    colorCanvasCtx.fillStyle = cssColor;
    colorCanvasCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = colorCanvasCtx.getImageData(0, 0, 1, 1).data;
    const rgba =
      a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    colorCache.set(cssColor, rgba);
    return rgba;
  } catch {
    return '#000000';
  }
}

const UNSUPPORTED_COLOR_REGEX = /\b(?:oklch|oklab|lab|lch|color-mix|color)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi;

function sanitizeCssText(cssText: string): string {
  if (!/(?:oklch|oklab|color-mix|color\()/i.test(cssText)) return cssText;
  return cssText.replace(UNSUPPORTED_COLOR_REGEX, (match) => cssColorToRgba(match));
}

function sanitizeClonedDocumentForHtml2Canvas(clonedDoc: Document, clonedRoot: HTMLElement): void {
  // 1. Sanitize all <style> tags in the cloned document
  const styleTags = clonedDoc.querySelectorAll('style');
  styleTags.forEach((styleEl) => {
    if (styleEl.textContent && /(?:oklch|oklab|color-mix|color\()/i.test(styleEl.textContent)) {
      styleEl.textContent = sanitizeCssText(styleEl.textContent);
    }
  });

  // 2. Sanitize computed color properties on all elements inside the captured page
  const win = clonedDoc.defaultView || window;
  const colorProps = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor',
  ] as const;

  const allNodes = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>('*'))];
  for (const el of allNodes) {
    const computed = win.getComputedStyle(el);
    for (const prop of colorProps) {
      const val = computed[prop];
      if (val && /(?:oklch|oklab|color-mix|color\()/i.test(val)) {
        el.style[prop] = cssColorToRgba(val);
      }
    }
    if (computed.boxShadow && /(?:oklch|oklab|color-mix|color\()/i.test(computed.boxShadow)) {
      el.style.boxShadow = 'none';
    }
    if (computed.backgroundImage && /(?:oklch|oklab|color-mix|color\()/i.test(computed.backgroundImage)) {
      el.style.backgroundImage = sanitizeCssText(computed.backgroundImage);
    }
  }
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
      onclone: (clonedDoc, clonedEl) => {
        sanitizeClonedDocumentForHtml2Canvas(clonedDoc, clonedEl);
      },
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpdaReport, PhotoItem } from '../types/spda';

const DB_NAME = 'SPDA_Report_DB';
const DB_VERSION = 1;
const STORE_REPORT = 'current_report';
const STORE_ORIGINAL_PHOTOS = 'original_photos';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_REPORT)) {
        db.createObjectStore(STORE_REPORT, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ORIGINAL_PHOTOS)) {
        db.createObjectStore(STORE_ORIGINAL_PHOTOS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves report document state
 */
export async function saveReportToDb(report: SpdaReport): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORT, 'readwrite');
    const store = tx.objectStore(STORE_REPORT);
    const updated = { ...report, atualizadoEm: Date.now() };
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Loads current report document state
 */
export async function loadReportFromDb(reportId = 'laudo-ref-spda-001'): Promise<SpdaReport | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORT, 'readonly');
    const store = tx.objectStore(STORE_REPORT);
    const req = store.get(reportId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Returns all saved reports in the database
 */
export async function getAllReportsFromDb(): Promise<SpdaReport[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORT, 'readonly');
    const store = tx.objectStore(STORE_REPORT);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a specific report from the database
 */
export async function deleteReportFromDb(reportId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REPORT, 'readwrite');
    const store = tx.objectStore(STORE_REPORT);
    const req = store.delete(reportId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Checks if a report with the same condominium name already exists
 * (rule: cannot have duplicate condominium names)
 */
export async function checkReportNameExists(
  nomeCondominio: string,
  excludeReportId?: string
): Promise<boolean> {
  const all = await getAllReportsFromDb();
  const normalizedNew = nomeCondominio.trim().toLowerCase();
  if (!normalizedNew) return false;

  return all.some((r) => {
    if (excludeReportId && r.id === excludeReportId) return false;
    const existingName = (r.cliente.nomeEmpreendimento || r.cliente.cliente || '').trim().toLowerCase();
    return existingName === normalizedNew;
  });
}

/**
 * Saves original full-resolution photo blob
 */
export async function saveOriginalPhoto(
  photoId: string,
  blob: Blob,
  fileName: string
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORIGINAL_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORE_ORIGINAL_PHOTOS);
    const req = store.put({
      id: photoId,
      blob,
      fileName,
      savedAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves original photo blob
 */
export async function getOriginalPhoto(
  photoId: string
): Promise<{ id: string; blob: Blob; fileName: string } | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORIGINAL_PHOTOS, 'readonly');
    const store = tx.objectStore(STORE_ORIGINAL_PHOTOS);
    const req = store.get(photoId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes original photo blob
 */
export async function deleteOriginalPhoto(photoId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORIGINAL_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORE_ORIGINAL_PHOTOS);
    const req = store.delete(photoId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export interface PrintQualityResult {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
}

/**
 * Computes approximate binary byte size from a base64 Data URL
 */
export function getDataUrlByteSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIdx + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Formats byte size into human-readable KB / MB
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generates Quality #1: Print-Ready Reduced Image for the Report (Laudo).
 * Resizes large camera images (e.g. 4000px / 5MB) down to ~900px (or 1400px for banners)
 * at high JPEG print quality (0.90), yielding >350 DPI on A4 while keeping the report
 * lightweight and fast on mobile devices.
 * Meanwhile, the raw Original (Quality #2) stays untouched for file/phone saving.
 */
export function createPrintQualityImage(
  file: Blob,
  maxDimension = 900,
  quality = 0.9
): Promise<PrintQualityResult> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          const reader = new FileReader();
          reader.onload = () => {
            const fallbackUrl = reader.result as string;
            resolve({
              dataUrl: fallbackUrl,
              sizeBytes: getDataUrlByteSize(fallbackUrl),
              width,
              height,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);

        resolve({
          dataUrl,
          sizeBytes: getDataUrlByteSize(dataUrl),
          width: canvas.width,
          height: canvas.height,
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * Resizes an image file to a high-resolution print-ready preview for the report
 * while preserving the raw original file untouched in IndexedDB.
 */
export async function createOptimizedPreview(
  file: Blob,
  maxDimension = 900,
  quality = 0.9
): Promise<string> {
  const result = await createPrintQualityImage(file, maxDimension, quality);
  return result.dataUrl;
}

/**
 * Converts any image Blob (fallback from original) into a print-ready JPEG Uint8Array
 * so Word (.docx) exports never bloat with multi-megabyte raw camera images.
 */
export async function downscaleBlobToPrintUint8Array(
  blob: Blob,
  maxDimension = 900,
  quality = 0.9
): Promise<Uint8Array | null> {
  try {
    const result = await createPrintQualityImage(blob, maxDimension, quality);
    const res = await fetch(result.dataUrl);
    const smallBlob = await res.blob();
    const ab = await smallBlob.arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

/**
 * Resizes a custom company logo cleanly onto a transparent PNG canvas
 * so it stays sharp in PDF and Word (.docx) headers without bloating report JSON.
 */
export async function resizeLogoToDataUrl(
  file: Blob,
  maxWidth = 600,
  maxHeight = 240
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || 480;
        const naturalH = img.naturalHeight || 170;
        const scale = Math.min(1, maxWidth / naturalW, maxHeight / naturalH);
        const targetW = Math.max(1, Math.round(naturalW * scale));
        const targetH = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Falha ao ler logotipo'));
          reader.readAsDataURL(file);
          return;
        }

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

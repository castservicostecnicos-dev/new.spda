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

/**
 * Resizes an image file to a high-resolution print-ready preview for the report
 * while preserving the raw original file untouched in IndexedDB.
 */
export function createOptimizedPreview(
  file: File,
  maxDimension = 2000,
  quality = 0.94
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

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
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        // High quality JPEG for crisp document print
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

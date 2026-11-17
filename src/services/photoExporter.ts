/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { SpdaReport, PhotoItem } from '../types/spda';
import { getOriginalPhoto } from './storage';

function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Sem_Nome';
}

function getCategoryFolderName(cat: string): string {
  switch (cat) {
    case 'ensaio_miliohmimetro':
      return '01_Pontos_Ensaio_Continuidade';
    case 'spda_captores':
      return '02_SPDA_Captores_Descidas';
    case 'quadros_dps':
      return '03_Quadros_Energia_DPS';
    case 'area_comum':
      return '04_Area_Comum';
    default:
      return '05_Outras_Fotos';
  }
}

function getCategoryShortName(cat: string): string {
  switch (cat) {
    case 'ensaio_miliohmimetro':
      return 'Ensaio';
    case 'spda_captores':
      return 'SPDA';
    case 'quadros_dps':
      return 'Quadros';
    case 'area_comum':
      return 'AreaComum';
    default:
      return 'Foto';
  }
}

/**
 * Triggers direct download of a Blob into the device's Downloads / Files folder.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}

/**
 * Immediately saves an original captured camera file into the phone's Downloads/Files
 * with an organized name while the print-ready version goes into the report.
 */
export function saveOriginalFileToPhoneImmediately(
  file: File,
  towerName: string,
  category: string,
  index: number
): boolean {
  try {
    const safeTower = sanitizeFolderName(towerName).replace(/\s+/g, '_');
    const safeCat = getCategoryShortName(category);
    const safeIndex = String(index).padStart(3, '0');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
    const fileName = `SPDA_${safeTower}_${safeCat}_${safeIndex}.${cleanExt}`;

    triggerBlobDownload(file, fileName);
    return true;
  } catch (err) {
    console.warn('Falha ao salvar cópia automática no celular:', err);
    return false;
  }
}

/**
 * Retrieves the raw original Blob for a PhotoItem from IndexedDB (or falls back to preview).
 */
export async function getOriginalBlobForPhoto(
  photo: PhotoItem
): Promise<{ blob: Blob; fileName: string } | null> {
  try {
    const originalRecord = await getOriginalPhoto(photo.id);
    if (originalRecord && originalRecord.blob) {
      return {
        blob: originalRecord.blob,
        fileName: originalRecord.fileName || photo.nomeArquivoOriginal || `foto_${photo.id}.jpg`,
      };
    }
  } catch {
    // ignore
  }

  if (photo.previewUrl) {
    try {
      const res = await fetch(photo.previewUrl);
      const blob = await res.blob();
      return {
        blob,
        fileName: photo.nomeArquivoOriginal || `foto_${photo.id}.jpg`,
      };
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Downloads a single photo in its original raw resolution to the phone/PC files.
 */
export async function saveSingleOriginalToDevice(
  photo: PhotoItem,
  towerName = 'Torre'
): Promise<boolean> {
  const data = await getOriginalBlobForPhoto(photo);
  if (!data) return false;

  const safeTower = sanitizeFolderName(towerName).replace(/\s+/g, '_');
  const safeCat = getCategoryShortName(photo.categoria);
  const safeIndex = String(photo.ordem || 1).padStart(3, '0');
  const safeCaption = photo.legenda
    ? `_${sanitizeFolderName(photo.legenda).replace(/\s+/g, '_').substring(0, 25)}`
    : '';
  const ext = (data.fileName.split('.').pop() || 'jpg').toLowerCase();
  const outputName = `ORIGINAL_${safeTower}_${safeCat}_${safeIndex}${safeCaption}.${ext}`;

  triggerBlobDownload(data.blob, outputName);
  return true;
}

/**
 * Checks if Web Share API supports sharing actual image files directly to Phone Gallery / Files.
 */
export function canShareOriginalFilesToPhone(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const dummy = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [dummy] });
  } catch {
    return false;
  }
}

/**
 * Shares original image files via the mobile OS native Share Sheet so the user can
 * tap "Save Images" / "Salvar em Arquivos" / Google Photos directly on their phone.
 */
export async function shareOriginalsToPhoneGallery(
  items: Array<{ photo: PhotoItem; towerName: string }>,
  title = 'Fotos Originais SPDA',
  onProgress?: (current: number, total: number, message: string) => void
): Promise<'shared' | 'unsupported' | 'cancelled' | 'error'> {
  if (!canShareOriginalFilesToPhone()) {
    return 'unsupported';
  }

  try {
    const files: File[] = [];
    const total = items.length;

    for (let i = 0; i < total; i++) {
      const { photo, towerName } = items[i];
      if (onProgress) {
        onProgress(i + 1, total, `Preparando foto original ${i + 1} de ${total}...`);
      }

      const data = await getOriginalBlobForPhoto(photo);
      if (data) {
        const safeTower = sanitizeFolderName(towerName).replace(/\s+/g, '_');
        const safeCat = getCategoryShortName(photo.categoria);
        const safeIndex = String(i + 1).padStart(3, '0');
        const ext = (data.fileName.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `SPDA_${safeTower}_${safeCat}_${safeIndex}.${ext}`;
        files.push(new File([data.blob], fileName, { type: data.blob.type || 'image/jpeg' }));
      }
    }

    if (files.length === 0) return 'error';

    if (!navigator.canShare({ files })) {
      return 'unsupported';
    }

    await navigator.share({
      title,
      text: `${files.length} foto(s) em qualidade original para arquivamento.`,
      files,
    });

    return 'shared';
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      return 'cancelled';
    }
    console.warn('Erro ao compartilhar fotos originais:', err);
    return 'error';
  }
}

/**
 * Collects all photos from the report (all towers + common area).
 */
export function collectAllReportPhotos(
  report: SpdaReport
): Array<{ photo: PhotoItem; towerName: string }> {
  const allPhotos: Array<{ photo: PhotoItem; towerName: string }> = [];

  report.torres.forEach((torre) => {
    torre.fotosEnsaio.forEach((p) => allPhotos.push({ photo: p, towerName: torre.nome }));
    torre.fotosSpda.forEach((p) => allPhotos.push({ photo: p, towerName: torre.nome }));
    torre.fotosQuadros.forEach((p) => allPhotos.push({ photo: p, towerName: torre.nome }));
  });

  if (report.areaComum.habilitada) {
    report.areaComum.fotosSpda.forEach((p) => allPhotos.push({ photo: p, towerName: 'Area_Comum' }));
    report.areaComum.fotosQuadros.forEach((p) => allPhotos.push({ photo: p, towerName: 'Area_Comum' }));
  }

  return allPhotos;
}

/**
 * Exports all original high-resolution photos into a ZIP archive
 * organized strictly by Tower and Category, preserving the untouched original files.
 */
export async function exportOriginalPhotosZip(
  report: SpdaReport,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const zip = new JSZip();
  const rootFolderName = `Fotos_Originais_SPDA_${sanitizeFolderName(report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Laudo')}`;
  const rootFolder = zip.folder(rootFolderName) || zip;

  const allPhotos = collectAllReportPhotos(report);
  const total = allPhotos.length;

  let metadataText = `RELATÓRIO DE FOTOGRAFIAS ORIGINAIS - LAUDO TÉCNICO SPDA\n`;
  metadataText += `Empreendimento: ${report.cliente.nomeEmpreendimento || report.cliente.cliente}\n`;
  metadataText += `Data de Emissão: ${report.responsavelTecnico.dataEmissao}\n`;
  metadataText += `Total de Fotos: ${total}\n`;
  metadataText += `Qualidade: ORIGINAL SEM REDUÇÃO (Arquivamento)\n`;
  metadataText += `==========================================================\n\n`;

  // Also include aerial & facade originals if saved in IndexedDB
  try {
    const aerialOrig = await getOriginalPhoto(`edificacao-aerea-${report.id}`);
    if (aerialOrig?.blob) {
      const buildingFolder = rootFolder.folder('00_Edificacao_Capa');
      buildingFolder?.file(`01_Vista_Aerea_${aerialOrig.fileName || 'aerea.jpg'}`, aerialOrig.blob);
    }
    const facadeOrig = await getOriginalPhoto(`edificacao-fachada-${report.id}`);
    if (facadeOrig?.blob) {
      const buildingFolder = rootFolder.folder('00_Edificacao_Capa');
      buildingFolder?.file(`02_Fachada_Principal_${facadeOrig.fileName || 'fachada.jpg'}`, facadeOrig.blob);
    }
  } catch {
    // ignore
  }

  for (let i = 0; i < allPhotos.length; i++) {
    const { photo, towerName } = allPhotos[i];
    if (onProgress) {
      onProgress(i + 1, total, `Exportando original ${i + 1} de ${total}: ${photo.legenda || photo.nomeArquivoOriginal}`);
    }

    const towerFolder = rootFolder.folder(sanitizeFolderName(towerName)) || rootFolder;
    const catFolder = towerFolder.folder(getCategoryFolderName(photo.categoria)) || towerFolder;

    const data = await getOriginalBlobForPhoto(photo);
    if (data) {
      const safeIndex = String(i + 1).padStart(3, '0');
      const safeCaption = sanitizeFolderName(photo.legenda || getCategoryShortName(photo.categoria)).substring(0, 30);
      const extension = data.fileName.split('.').pop() || 'jpg';
      const outputFileName = `${safeIndex}_${safeCaption}.${extension}`;

      catFolder.file(outputFileName, data.blob);

      metadataText += `[${safeIndex}] Arquivo: ${outputFileName}\n`;
      metadataText += `  Torre: ${towerName}\n`;
      metadataText += `  Categoria: ${photo.categoria}\n`;
      metadataText += `  Legenda: ${photo.legenda || 'Sem legenda'}\n`;
      if (photo.tipoDefeito || photo.destaqueAlerta) {
        metadataText += `  Alerta / Defeito: SIM (⚠ ${photo.tipoDefeito || 'FALTA EQUIPOTENCIALIZAR'})\n`;
      }
      if (photo.observacao) metadataText += `  Observação: ${photo.observacao}\n`;
      metadataText += `\n`;
    }
  }

  // Add documentation text
  rootFolder.file('LEIA-ME_INDICE_FOTOS.txt', metadataText);

  if (onProgress) {
    onProgress(total, total, 'Compactando arquivo ZIP com qualidade original...');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(total, total, `Gerando arquivo ZIP: ${metadata.percent.toFixed(0)}%`);
    }
  });

  triggerBlobDownload(zipBlob, `${rootFolderName}.zip`);
}

/**
 * Tries saving directly to a chosen phone/PC directory if supported by browser
 * (File System Access API). Returns true if succeeded, false if not supported.
 */
export async function trySaveToDeviceDirectory(
  report: SpdaReport,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<boolean> {
  if (!('showDirectoryPicker' in window)) {
    return false;
  }

  try {
    // @ts-expect-error File System Access API
    const rootHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'pictures',
    });

    const reportFolderName = `Fotos_Originais_SPDA_${sanitizeFolderName(report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Laudo')}`;
    const reportDirHandle = await rootHandle.getDirectoryHandle(reportFolderName, { create: true });

    // Save building aerial & facade originals if present
    try {
      const aerialOrig = await getOriginalPhoto(`edificacao-aerea-${report.id}`);
      const facadeOrig = await getOriginalPhoto(`edificacao-fachada-${report.id}`);
      if (aerialOrig?.blob || facadeOrig?.blob) {
        const bDir = await reportDirHandle.getDirectoryHandle('00_Edificacao_Capa', { create: true });
        if (aerialOrig?.blob) {
          const fh = await bDir.getFileHandle(`01_Vista_Aerea_${aerialOrig.fileName || 'aerea.jpg'}`, { create: true });
          const w = await fh.createWritable();
          await w.write(aerialOrig.blob);
          await w.close();
        }
        if (facadeOrig?.blob) {
          const fh = await bDir.getFileHandle(`02_Fachada_Principal_${facadeOrig.fileName || 'fachada.jpg'}`, { create: true });
          const w = await fh.createWritable();
          await w.write(facadeOrig.blob);
          await w.close();
        }
      }
    } catch {
      // ignore
    }

    const allPhotos = collectAllReportPhotos(report);
    const total = allPhotos.length;

    for (let i = 0; i < allPhotos.length; i++) {
      const { photo, towerName } = allPhotos[i];
      if (onProgress) {
        onProgress(i + 1, total, `Gravando original ${i + 1}/${total} na pasta: ${photo.legenda || towerName}`);
      }

      const towerDir = await reportDirHandle.getDirectoryHandle(sanitizeFolderName(towerName), { create: true });
      const catDir = await towerDir.getDirectoryHandle(getCategoryFolderName(photo.categoria), { create: true });

      const data = await getOriginalBlobForPhoto(photo);
      if (data) {
        const safeIndex = String(i + 1).padStart(3, '0');
        const ext = data.fileName.split('.').pop() || 'jpg';
        const safeName = `${safeIndex}_${sanitizeFolderName(photo.legenda || getCategoryShortName(photo.categoria))}.${ext}`;

        const fileHandle = await catDir.getFileHandle(safeName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data.blob);
        await writable.close();
      }
    }

    return true;
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      return true;
    }
    return false;
  }
}

/**
 * Exports complete report JSON backup
 */
export function exportReportJson(report: SpdaReport): void {
  const jsonStr = JSON.stringify(report, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  triggerBlobDownload(
    blob,
    `Laudo_SPDA_${sanitizeFolderName(report.cliente.nomeEmpreendimento || 'Backup')}_${new Date().toISOString().slice(0, 10)}.spda.json`
  );
}

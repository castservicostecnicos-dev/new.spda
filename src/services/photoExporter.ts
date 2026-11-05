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

/**
 * Exports all original high-resolution photos into a ZIP archive or direct folder
 * organized strictly by Tower and Category, exactly as requested by the user.
 */
export async function exportOriginalPhotosZip(
  report: SpdaReport,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const zip = new JSZip();
  const rootFolderName = `Fotos_Originais_SPDA_${sanitizeFolderName(report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Laudo')}`;
  const rootFolder = zip.folder(rootFolderName) || zip;

  // Gather all photos
  const allPhotos: Array<{ photo: PhotoItem; towerName: string }> = [];

  // Tower photos
  report.torres.forEach((torre) => {
    torre.fotosEnsaio.forEach((p) => allPhotos.push({ photo: p, towerName: torre.nome }));
    torre.fotosSpda.forEach((p) => allPhotos.push({ photo: p, towerName: torre.nome }));
    torre.fotosQuadros.forEach((p) => allPhotos.push({ photo: p, towerName: torre.nome }));
  });

  // Common area photos
  if (report.areaComum.habilitada) {
    report.areaComum.fotosSpda.forEach((p) => allPhotos.push({ photo: p, towerName: 'Area_Comum' }));
    report.areaComum.fotosQuadros.forEach((p) => allPhotos.push({ photo: p, towerName: 'Area_Comum' }));
  }

  const total = allPhotos.length;
  let metadataText = `RELATÓRIO DE FOTOGRAFIAS ORIGINAIS - LAUDO TÉCNICO SPDA\n`;
  metadataText += `Empreendimento: ${report.cliente.nomeEmpreendimento || report.cliente.cliente}\n`;
  metadataText += `Data de Emissão: ${report.responsavelTecnico.dataEmissao}\n`;
  metadataText += `Total de Fotos: ${total}\n`;
  metadataText += `==========================================================\n\n`;

  for (let i = 0; i < allPhotos.length; i++) {
    const { photo, towerName } = allPhotos[i];
    if (onProgress) {
      onProgress(i + 1, total, `Exportando foto ${i + 1} de ${total}: ${photo.legenda || photo.nomeArquivoOriginal}`);
    }

    const towerFolder = rootFolder.folder(sanitizeFolderName(towerName)) || rootFolder;
    const catFolder = towerFolder.folder(getCategoryFolderName(photo.categoria)) || towerFolder;

    let blobToAdd: Blob | null = null;
    let fileName = photo.nomeArquivoOriginal || `foto_${photo.id}.jpg`;

    // Try to get original raw blob from IndexedDB
    try {
      const originalRecord = await getOriginalPhoto(photo.id);
      if (originalRecord && originalRecord.blob) {
        blobToAdd = originalRecord.blob;
        fileName = originalRecord.fileName || fileName;
      }
    } catch {
      // ignore
    }

    // Fallback to preview dataUrl if original not in IDB
    if (!blobToAdd && photo.previewUrl) {
      try {
        const res = await fetch(photo.previewUrl);
        blobToAdd = await res.blob();
      } catch {
        // ignore
      }
    }

    if (blobToAdd) {
      // Name with index for neat ordering
      const safeIndex = String(i + 1).padStart(3, '0');
      const safeCaption = sanitizeFolderName(photo.legenda || 'sem_legenda').substring(0, 30);
      const extension = fileName.split('.').pop() || 'jpg';
      const outputFileName = `${safeIndex}_${safeCaption}.${extension}`;

      catFolder.file(outputFileName, blobToAdd);

      metadataText += `[${safeIndex}] Arquivo: ${outputFileName}\n`;
      metadataText += `  Torre: ${towerName}\n`;
      metadataText += `  Categoria: ${photo.categoria}\n`;
      metadataText += `  Legenda: ${photo.legenda || 'Sem legenda'}\n`;
      if (photo.tipoDefeito || photo.destaqueAlerta) {
        metadataText += `  Alerta / Defeito: SIM (⚠ ${photo.tipoDefeito || 'FALTA EQUIPOTENCIALIZAR'})\n`;
      }
      if (photo.leituraMiliohmimetro) {
        metadataText += `  Leitura do Visor: ${photo.leituraMiliohmimetro}\n`;
      }
      if (photo.observacao) metadataText += `  Observação: ${photo.observacao}\n`;
      metadataText += `\n`;
    }
  }

  // Add documentation text
  rootFolder.file('LEIA-ME_INDICE_FOTOS.txt', metadataText);

  // Generate ZIP
  if (onProgress) {
    onProgress(total, total, 'Compactando arquivo ZIP com qualidade original...');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(total, total, `Gerando arquivo ZIP: ${metadata.percent.toFixed(0)}%`);
    }
  });

  // Trigger download
  const downloadUrl = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `${rootFolderName}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}

/**
 * Tries saving directly to a chosen phone/PC directory if supported by browser
 * (File System Access API). Returns true if succeeded, false if not supported.
 */
export async function trySaveToDeviceDirectory(
  report: SpdaReport,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<boolean> {
  // Check if File System Access API is supported
  if (!('showDirectoryPicker' in window)) {
    return false;
  }

  try {
    // Prompt user to pick a folder on their device
    // @ts-expect-error File System Access API
    const rootHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'pictures',
    });

    const reportFolderName = `Fotos_Originais_SPDA_${sanitizeFolderName(report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Laudo')}`;
    const reportDirHandle = await rootHandle.getDirectoryHandle(reportFolderName, { create: true });

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

    const total = allPhotos.length;

    for (let i = 0; i < allPhotos.length; i++) {
      const { photo, towerName } = allPhotos[i];
      if (onProgress) {
        onProgress(i + 1, total, `Gravando ${i + 1}/${total} na pasta: ${photo.legenda}`);
      }

      const towerDir = await reportDirHandle.getDirectoryHandle(sanitizeFolderName(towerName), { create: true });
      const catDir = await towerDir.getDirectoryHandle(getCategoryFolderName(photo.categoria), { create: true });

      let blob: Blob | null = null;
      try {
        const rec = await getOriginalPhoto(photo.id);
        if (rec) blob = rec.blob;
      } catch {
        // ignore
      }

      if (!blob && photo.previewUrl) {
        const res = await fetch(photo.previewUrl);
        blob = await res.blob();
      }

      if (blob) {
        const safeIndex = String(i + 1).padStart(3, '0');
        const ext = photo.nomeArquivoOriginal.split('.').pop() || 'jpg';
        const safeName = `${safeIndex}_${sanitizeFolderName(photo.legenda || 'foto')}.${ext}`;

        const fileHandle = await catDir.getFileHandle(safeName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
    }

    return true;
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      return true; // user cancelled, no error
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laudo_SPDA_${sanitizeFolderName(report.cliente.nomeEmpreendimento || 'Backup')}_${new Date().toISOString().slice(0, 10)}.spda.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

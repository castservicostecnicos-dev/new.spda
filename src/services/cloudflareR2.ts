/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { SpdaReport, PhotoItem } from '../types/spda';
import { getOriginalPhoto } from './storage';
import { generateReportDocxBlob } from './docxExporter';
import JSZip from 'jszip';

export interface CloudflareR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string; // e.g. https://pub-xxxx.r2.dev or custom domain
}

const STORAGE_KEY = 'spda_cloudflare_r2_config';

/**
 * Loads saved R2 config from localStorage or Vite environment variables
 */
export function loadR2Config(): CloudflareR2Config {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Erro ao carregar credenciais do R2:', err);
  }

  // Fallback to environment variables if provided
  return {
    accountId: (import.meta as any).env?.VITE_R2_ACCOUNT_ID || '',
    accessKeyId: (import.meta as any).env?.VITE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: (import.meta as any).env?.VITE_R2_SECRET_ACCESS_KEY || '',
    bucketName: (import.meta as any).env?.VITE_R2_BUCKET_NAME || '',
    publicUrl: (import.meta as any).env?.VITE_R2_PUBLIC_URL || '',
  };
}

/**
 * Saves R2 config in localStorage
 */
export function saveR2Config(config: CloudflareR2Config): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Erro ao salvar credenciais do R2:', err);
  }
}

/**
 * Creates S3 Client configured for Cloudflare R2
 */
export function createR2Client(config: CloudflareR2Config): S3Client {
  const accountId = config.accountId.trim();
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId.trim(),
      secretAccessKey: config.secretAccessKey.trim(),
    },
  });
}

/**
 * Tests connection to the Cloudflare R2 bucket
 */
export async function testR2Connection(
  config: CloudflareR2Config
): Promise<{ success: boolean; message: string }> {
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    return {
      success: false,
      message: 'Preencha Account ID, Access Key ID, Secret Access Key e o Nome do Bucket.',
    };
  }

  try {
    const client = createR2Client(config);

    // Try creating/putting a tiny verification probe into the bucket
    const probeKey = '.r2-connection-test.txt';
    const probeContent = new TextEncoder().encode(`SJC SPDA R2 Test - ${new Date().toISOString()}`);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName.trim(),
        Key: probeKey,
        Body: probeContent,
        ContentType: 'text/plain',
      })
    );

    return {
      success: true,
      message: `Conexão com o bucket "${config.bucketName}" no Cloudflare R2 estabelecida com sucesso!`,
    };
  } catch (err: any) {
    console.error('Falha ao conectar no R2:', err);
    let msg = err.message || 'Falha ao autenticar com Cloudflare R2.';

    if (err.name === 'TypeError' && err.message?.includes('Failed to fetch')) {
      msg =
        'Erro de CORS ou rede ao conectar com Cloudflare R2. Certifique-se de adicionar uma regra CORS no bucket do R2 permitindo a origem desta aplicação.';
    } else if (err.$metadata?.httpStatusCode === 403) {
      msg = 'Acesso Negado (403). Verifique se o Access Key ID e Secret Access Key possuem permissão "Admin Read & Write" no bucket.';
    } else if (err.$metadata?.httpStatusCode === 404) {
      msg = `Bucket "${config.bucketName}" não encontrado na conta Cloudflare especificada.`;
    }

    return {
      success: false,
      message: msg,
    };
  }
}

function sanitizeFolderName(name: string): string {
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ');
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Helper to fetch blob data from PhotoItem (using IndexedDB original photo or preview URL)
 */
async function getPhotoData(photo: PhotoItem): Promise<{ data: Uint8Array; mimeType: string }> {
  // Check IndexedDB raw blob first
  try {
    const original = await getOriginalPhoto(photo.id);
    if (original && original.blob) {
      const arrayBuffer = await original.blob.arrayBuffer();
      return {
        data: new Uint8Array(arrayBuffer),
        mimeType: original.blob.type || 'image/jpeg',
      };
    }
  } catch (err) {
    console.warn(`Could not load raw photo from IndexedDB for ${photo.id}:`, err);
  }

  // Fallback to previewUrl
  if (photo.previewUrl) {
    const res = await fetch(photo.previewUrl);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return {
      data: new Uint8Array(arrayBuffer),
      mimeType: blob.type || 'image/jpeg',
    };
  }

  throw new Error(`Dados de imagem não disponíveis para ${photo.legenda}`);
}

export interface R2UploadItem {
  key: string;
  data: Uint8Array;
  mimeType: string;
  label: string;
}

/**
 * Prepares the complete files list and folder structure as required:
 *
 * Folder format:
 * - [Nome do Condomínio]/
 *   - [Nome do Condomínio] - Laudo Tecnico SPDA.docx
 *   - laudo.json
 *   If single tower:
 *     - SPDA existente/
 *     - Quadros/
 *     - Pontos de inspeção/
 *   If multiple towers:
 *     - [Nome da Torre]/
 *       - SPDA existente/
 *       - Quadros/
 *       - Pontos de medição/
 *   Área Comum (if enabled):
 *     - Área Comum/
 *       - SPDA existente/
 *       - Quadros/
 */
export async function buildR2FilesList(
  report: SpdaReport,
  onProgress?: (msg: string) => void
): Promise<R2UploadItem[]> {
  const items: R2UploadItem[] = [];

  const rawCondoName = report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Condominio_SPDA';
  const condoFolder = sanitizeFolderName(rawCondoName);

  // 1. Generate and attach the Word (.docx) document
  if (onProgress) onProgress('Gerando documento técnico Word (.docx) para o R2...');
  const docxBlob = await generateReportDocxBlob(report, (m) => {
    if (onProgress) onProgress(m);
  });
  const docxBuffer = await docxBlob.arrayBuffer();
  items.push({
    key: `${condoFolder}/${condoFolder} - Laudo Tecnico SPDA.docx`,
    data: new Uint8Array(docxBuffer),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Documento Word (.docx)',
  });

  // 2. Attach JSON backup metadata
  const jsonString = JSON.stringify(report, null, 2);
  const jsonBuffer = new TextEncoder().encode(jsonString);
  items.push({
    key: `${condoFolder}/laudo.json`,
    data: jsonBuffer,
    mimeType: 'application/json',
    label: 'Arquivo de Metadados e Backup (laudo.json)',
  });

  // 3. Facade & Aerial Photos if available
  if (report.edificacao.fotoFachadaUrl) {
    try {
      const res = await fetch(report.edificacao.fotoFachadaUrl);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      items.push({
        key: `${condoFolder}/Geral/Fachada_Principal.jpg`,
        data: new Uint8Array(buf),
        mimeType: blob.type || 'image/jpeg',
        label: 'Fachada Principal',
      });
    } catch (e) {
      console.warn('Erro ao carregar foto fachada:', e);
    }
  }

  if (report.edificacao.fotoAereaUrl) {
    try {
      const res = await fetch(report.edificacao.fotoAereaUrl);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      items.push({
        key: `${condoFolder}/Geral/Vista_Aerea_Satelite.jpg`,
        data: new Uint8Array(buf),
        mimeType: blob.type || 'image/jpeg',
        label: 'Vista Aérea / Imagem Satélite',
      });
    } catch (e) {
      console.warn('Erro ao carregar foto aérea:', e);
    }
  }

  // 4. Photos: Single Tower vs Multiple Towers
  const isSingleTower = report.torres.length === 1;

  for (let tIdx = 0; tIdx < report.torres.length; tIdx++) {
    const tower = report.torres[tIdx];
    const towerFolder = sanitizeFolderName(tower.nome || `Torre ${tIdx + 1}`);

    // If single tower: root folders are "SPDA existente", "Quadros", "Pontos de inspeção"
    // If multiple towers: nested under "[Nome da Torre]/..."
    const prefix = isSingleTower
      ? `${condoFolder}`
      : `${condoFolder}/${towerFolder}`;

    // Sub-folder names requested by user:
    // - SPDA existente
    // - Quadros
    // - Pontos de inspeção / Pontos de medição
    const spdaFolder = `${prefix}/SPDA existente`;
    const quadrosFolder = `${prefix}/Quadros`;
    const pontosFolder = isSingleTower
      ? `${prefix}/Pontos de inspeção`
      : `${prefix}/Pontos de medição`;

    // Process SPDA existente photos
    for (let i = 0; i < tower.fotosSpda.length; i++) {
      const p = tower.fotosSpda[i];
      try {
        const { data, mimeType } = await getPhotoData(p);
        const fileName = sanitizeFileName(p.nomeArquivoOriginal || `SPDA_${i + 1}.jpg`);
        items.push({
          key: `${spdaFolder}/${String(i + 1).padStart(2, '0')}_${fileName}`,
          data,
          mimeType,
          label: `${tower.nome} · SPDA existente (${p.legenda})`,
        });
      } catch (err) {
        console.warn(`Erro ao processar foto ${p.id}:`, err);
      }
    }

    // Process Quadros photos
    for (let i = 0; i < tower.fotosQuadros.length; i++) {
      const p = tower.fotosQuadros[i];
      try {
        const { data, mimeType } = await getPhotoData(p);
        const fileName = sanitizeFileName(p.nomeArquivoOriginal || `Quadro_${i + 1}.jpg`);
        items.push({
          key: `${quadrosFolder}/${String(i + 1).padStart(2, '0')}_${fileName}`,
          data,
          mimeType,
          label: `${tower.nome} · Quadros e DPS (${p.legenda})`,
        });
      } catch (err) {
        console.warn(`Erro ao processar foto ${p.id}:`, err);
      }
    }

    // Process Pontos de medição / ensaio photos
    for (let i = 0; i < tower.fotosEnsaio.length; i++) {
      const p = tower.fotosEnsaio[i];
      try {
        const { data, mimeType } = await getPhotoData(p);
        const fileName = sanitizeFileName(p.nomeArquivoOriginal || `Ponto_${i + 1}.jpg`);
        items.push({
          key: `${pontosFolder}/${String(i + 1).padStart(2, '0')}_${fileName}`,
          data,
          mimeType,
          label: `${tower.nome} · Pontos de medição (${p.legenda})`,
        });
      } catch (err) {
        console.warn(`Erro ao processar foto ${p.id}:`, err);
      }
    }
  }

  // 5. Common area photos if enabled
  if (report.areaComum.habilitada) {
    const commonPrefix = `${condoFolder}/Área Comum`;

    for (let i = 0; i < report.areaComum.fotosSpda.length; i++) {
      const p = report.areaComum.fotosSpda[i];
      try {
        const { data, mimeType } = await getPhotoData(p);
        const fileName = sanitizeFileName(p.nomeArquivoOriginal || `SPDA_Comum_${i + 1}.jpg`);
        items.push({
          key: `${commonPrefix}/SPDA existente/${String(i + 1).padStart(2, '0')}_${fileName}`,
          data,
          mimeType,
          label: `Área Comum · SPDA existente (${p.legenda})`,
        });
      } catch (err) {
        console.warn(`Erro ao processar foto ${p.id}:`, err);
      }
    }

    for (let i = 0; i < report.areaComum.fotosQuadros.length; i++) {
      const p = report.areaComum.fotosQuadros[i];
      try {
        const { data, mimeType } = await getPhotoData(p);
        const fileName = sanitizeFileName(p.nomeArquivoOriginal || `Quadro_Comum_${i + 1}.jpg`);
        items.push({
          key: `${commonPrefix}/Quadros/${String(i + 1).padStart(2, '0')}_${fileName}`,
          data,
          mimeType,
          label: `Área Comum · Quadros e DPS (${p.legenda})`,
        });
      } catch (err) {
        console.warn(`Erro ao processar foto ${p.id}:`, err);
      }
    }
  }

  return items;
}

/**
 * Synchronizes the entire report, .docx document, and photos to Cloudflare R2 bucket
 */
export async function syncReportToCloudflareR2(
  report: SpdaReport,
  config: CloudflareR2Config,
  onProgress?: (current: number, total: number, label: string) => void
): Promise<{ success: boolean; totalUploaded: number; condoFolder: string }> {
  const client = createR2Client(config);
  const items = await buildR2FilesList(report, (msg) => {
    if (onProgress) onProgress(0, 0, msg);
  });

  const total = items.length;
  let uploaded = 0;

  for (const item of items) {
    uploaded++;
    if (onProgress) {
      onProgress(uploaded, total, `Enviando: ${item.key}`);
    }

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName.trim(),
        Key: item.key,
        Body: item.data,
        ContentType: item.mimeType,
      })
    );
  }

  const rawCondoName = report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Condominio_SPDA';
  const condoFolder = sanitizeFolderName(rawCondoName);

  return {
    success: true,
    totalUploaded: uploaded,
    condoFolder,
  };
}

/**
 * Fallback: Creates a ZIP file containing the exact same Cloudflare R2 folder structure
 * so the user can download it and drag-and-drop into Cloudflare R2 dashboard web UI if needed.
 */
export async function downloadR2FolderStructureZip(
  report: SpdaReport,
  onProgress?: (current: number, total: number, label: string) => void
): Promise<void> {
  const items = await buildR2FilesList(report, (msg) => {
    if (onProgress) onProgress(0, 0, msg);
  });

  const zip = new JSZip();
  let count = 0;
  const total = items.length;

  for (const item of items) {
    count++;
    if (onProgress) {
      onProgress(count, total, `Empacotando: ${item.key}`);
    }
    zip.file(item.key, item.data);
  }

  const rawCondoName = report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Condominio_SPDA';
  const condoFolder = sanitizeFolderName(rawCondoName);

  if (onProgress) onProgress(total, total, 'Compactando arquivo ZIP final...');
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${condoFolder}_Estrutura_Cloudflare_R2.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

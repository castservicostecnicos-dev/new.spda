/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpdaReport, Tower, PhotoItem } from '../types/spda';
import { getBuildingSampleImages } from '../data/samplePhotos';

/**
 * Creates high-fidelity 3:4 SVG data URLs for sample repairs
 */
function createRepairedSvg(
  type: 'miliohm' | 'pit' | 'captor' | 'connector' | 'switchboard' | 'aerial' | 'facade',
  label: string,
  extra?: string
): string {
  let innerContent = '';
  const width = 300;
  const height = 400;

  switch (type) {
    case 'miliohm':
      innerContent = `
        <rect width="300" height="400" fill="#1e293b"/>
        <rect x="18" y="18" width="264" height="364" rx="12" fill="#0f172a" stroke="#475569" stroke-width="5"/>
        <rect x="30" y="30" width="240" height="34" rx="4" fill="#0284c7"/>
        <text x="150" y="52" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="900" letter-spacing="1" text-anchor="middle">MICRÔMETRO / MILIOHMÍMETRO</text>
        <rect x="30" y="74" width="240" height="136" rx="6" fill="#022c22" stroke="#16a34a" stroke-width="4"/>
        <rect x="36" y="80" width="228" height="124" rx="4" fill="#031f18"/>
        <text x="50" y="104" fill="#86efac" font-family="sans-serif" font-size="11" font-weight="bold">KELVIN 4 FIOS</text>
        <text x="250" y="104" fill="#86efac" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="end">DC 1.2A</text>
        <text x="150" y="160" fill="#4ade80" font-family="'Courier New', Courier, monospace" font-size="44" font-weight="900" letter-spacing="2" text-anchor="middle">${extra || '0.104 Ω'}</text>
        <rect x="36" y="176" width="228" height="28" fill="#04271e"/>
        <text x="150" y="195" fill="#86efac" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">STATUS: LEITURA ESTÁVEL</text>
        <circle cx="150" cy="265" r="36" fill="#334155" stroke="#64748b" stroke-width="4"/>
        <line x1="150" y1="265" x2="150" y2="238" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>
        <text x="150" y="228" fill="#f8fafc" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">200 mΩ</text>
        <text x="200" y="270" fill="#94a3b8" font-family="sans-serif" font-size="9" text-anchor="middle">2 Ω</text>
        <text x="100" y="270" fill="#94a3b8" font-family="sans-serif" font-size="9" text-anchor="middle">OFF</text>
        <g transform="translate(42, 320)">
          <circle cx="20" cy="18" r="12" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
          <text x="20" y="22" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">C1</text>
          <circle cx="78" cy="18" r="12" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
          <text x="78" y="22" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">P1</text>
          <circle cx="136" cy="18" r="12" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
          <text x="136" y="22" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">P2</text>
          <circle cx="194" cy="18" r="12" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
          <text x="194" y="22" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">C2</text>
        </g>
      `;
      break;
    case 'pit':
      innerContent = `
        <rect width="300" height="400" fill="#78716c"/>
        <circle cx="150" cy="180" r="125" fill="#44403c" stroke="#292524" stroke-width="8"/>
        <circle cx="150" cy="180" r="95" fill="#292524"/>
        <circle cx="150" cy="180" r="22" fill="#b45309" stroke="#d97706" stroke-width="3"/>
        <path d="M115 215 L145 185 L165 205 L135 235 Z" fill="#ef4444"/>
        <line x1="115" y1="215" x2="45" y2="295" stroke="#ef4444" stroke-width="8"/>
        <line x1="140" y1="230" x2="35" y2="340" stroke="#000000" stroke-width="5"/>
        <text x="150" y="360" fill="#f5f5f4" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Caixa de Inspeção SPDA</text>
      `;
      break;
    case 'captor':
      innerContent = `
        <rect width="300" height="400" fill="#64748b"/>
        <rect width="300" height="300" fill="#94a3b8"/>
        <rect x="0" y="300" width="300" height="100" fill="#cbd5e1" stroke="#94a3b8"/>
        <line x1="150" y1="310" x2="150" y2="60" stroke="#475569" stroke-width="8"/>
        <polygon points="150,40 140,70 160,70" fill="#f59e0b"/>
        <line x1="150" y1="65" x2="125" y2="45" stroke="#f59e0b" stroke-width="4"/>
        <line x1="150" y1="65" x2="175" y2="45" stroke="#f59e0b" stroke-width="4"/>
        <line x1="150" y1="65" x2="150" y2="30" stroke="#f59e0b" stroke-width="4"/>
        <path d="M150 310 L195 335 L280 335" fill="none" stroke="#b45309" stroke-width="6"/>
        <text x="150" y="375" fill="#334155" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Captor Tipo Franklin</text>
      `;
      break;
    case 'connector':
      innerContent = `
        <rect width="300" height="400" fill="#e2e8f0"/>
        <rect x="0" y="140" width="300" height="150" fill="#d1d5db" stroke="#9ca3af"/>
        <line x1="15" y1="210" x2="285" y2="210" stroke="#b45309" stroke-width="14"/>
        <circle cx="150" cy="210" r="42" fill="#ea580c" opacity="0.65"/>
        <circle cx="150" cy="210" r="26" fill="#7c2d12" stroke="#451a03" stroke-width="3"/>
        <circle cx="150" cy="210" r="65" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-dasharray="5 3"/>
        <text x="150" y="350" fill="#991b1b" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Ponto de Inspeção / Conector</text>
      `;
      break;
    case 'switchboard':
      innerContent = `
        <rect width="300" height="400" fill="#cbd5e1"/>
        <rect x="25" y="30" width="250" height="340" fill="#b91c1c" rx="6" stroke="#7f1d1d" stroke-width="4"/>
        <rect x="40" y="45" width="220" height="310" fill="#f8fafc" stroke="#e2e8f0"/>
        <rect x="105" y="65" width="90" height="55" fill="#1e293b"/>
        <g transform="translate(60, 150)">
          <rect x="0" y="0" width="40" height="60" fill="#dc2626" rx="3"/>
          <text x="20" y="35" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">DPS</text>
          <rect x="46" y="0" width="40" height="60" fill="#dc2626" rx="3"/>
          <text x="66" y="35" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">DPS</text>
          <rect x="92" y="0" width="40" height="60" fill="#dc2626" rx="3"/>
          <text x="112" y="35" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">DPS</text>
          <rect x="138" y="0" width="40" height="60" fill="#2563eb" rx="3"/>
          <text x="158" y="35" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">DPS-N</text>
        </g>
        <line x1="80" y1="225" x2="80" y2="295" stroke="#22c55e" stroke-width="5"/>
        <line x1="126" y1="225" x2="126" y2="295" stroke="#22c55e" stroke-width="5"/>
        <line x1="172" y1="225" x2="172" y2="295" stroke="#22c55e" stroke-width="5"/>
        <text x="150" y="330" fill="#1e293b" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">QGBT / Painel Elétrico</text>
      `;
      break;
    case 'aerial':
      innerContent = `
        <rect width="300" height="400" fill="#15803d"/>
        <rect x="35" y="45" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="165" y="45" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="35" y="200" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="165" y="200" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="115" y="145" width="70" height="65" fill="#0284c7" rx="6"/>
        <text x="150" y="365" fill="#f8fafc" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">${label}</text>
      `;
      break;
    case 'facade':
      innerContent = `
        <rect width="300" height="400" fill="#bae6fd"/>
        <rect x="0" y="290" width="300" height="110" fill="#475569"/>
        <rect x="35" y="40" width="100" height="250" fill="#fed7aa" stroke="#fb923c" stroke-width="2"/>
        <rect x="165" y="40" width="100" height="250" fill="#fed7aa" stroke="#fb923c" stroke-width="2"/>
        <g fill="#0284c7" opacity="0.8">
          <rect x="50" y="65" width="24" height="24"/>
          <rect x="95" y="65" width="24" height="24"/>
          <rect x="50" y="115" width="24" height="24"/>
          <rect x="95" y="115" width="24" height="24"/>
          <rect x="50" y="165" width="24" height="24"/>
          <rect x="95" y="165" width="24" height="24"/>
          <rect x="50" y="215" width="24" height="24"/>
          <rect x="95" y="215" width="24" height="24"/>
          <rect x="180" y="65" width="24" height="24"/>
          <rect x="225" y="65" width="24" height="24"/>
          <rect x="180" y="115" width="24" height="24"/>
          <rect x="225" y="115" width="24" height="24"/>
          <rect x="180" y="165" width="24" height="24"/>
          <rect x="225" y="165" width="24" height="24"/>
          <rect x="180" y="215" width="24" height="24"/>
          <rect x="225" y="215" width="24" height="24"/>
        </g>
        <text x="150" y="355" fill="#f8fafc" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">${label}</text>
      `;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${innerContent}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DEFAULT_READINGS = ['0.104 Ω', '0.089 Ω', '0.120 Ω', '0.095 Ω', '0.118 Ω', '0.112 Ω', '0.076 Ω', '0.130 Ω'];

/**
 * Automatically upgrades and repairs any existing report in editing:
 * 1. Replaces old 300x300 SVGs with native 300x400 (3:4 ratio) high-visibility SVGs.
 * 2. In Pontos de Inspeção (miliohmímetro): ensures 'leituraMiliohmimetro' is populated and visible on LCD and legend.
 * 3. In SPDA and Quadros: enforces zero captions for normal photos and clear yellow alerts for defect photos.
 */
export function upgradeAndRepairReport(report: SpdaReport): {
  report: SpdaReport;
  modified: boolean;
  details: string[];
} {
  let modified = false;
  const details: string[] = [];

  // Deep clone to avoid mutating in place unexpectedly
  const updated: SpdaReport = JSON.parse(JSON.stringify(report));

  // 1. Check building facade and aerial photos
  if (
    updated.edificacao.fotoAereaUrl &&
    (updated.edificacao.fotoAereaUrl.includes('0%200%20300%20300') ||
      updated.edificacao.fotoAereaUrl.includes('0 0 300 300'))
  ) {
    updated.edificacao.fotoAereaUrl = createRepairedSvg('aerial', 'Vista aérea do condomínio');
    modified = true;
    details.push('Foto aérea atualizada para proporção 3x4');
  }

  if (
    updated.edificacao.fotoFachadaUrl &&
    (updated.edificacao.fotoFachadaUrl.includes('0%200%20300%20300') ||
      updated.edificacao.fotoFachadaUrl.includes('0 0 300 300'))
  ) {
    updated.edificacao.fotoFachadaUrl = createRepairedSvg('facade', 'Entrada do condomínio');
    modified = true;
    details.push('Foto de fachada atualizada para proporção 3x4');
  }

  // Helper to repair a list of photos
  const repairPhotoList = (
    photos: PhotoItem[],
    category: 'ensaio_miliohmimetro' | 'spda_captores' | 'quadros_dps',
    contextName: string
  ): boolean => {
    let listModified = false;

    photos.forEach((photo, idx) => {
      const isSvg = photo.previewUrl && (photo.previewUrl.includes('image/svg+xml') || photo.previewUrl.includes('%3Csvg'));
      const isSquareSvg = isSvg && (photo.previewUrl.includes('300%20300') || photo.previewUrl.includes('300 300'));

      if (category === 'ensaio_miliohmimetro') {
        const isMeter = (idx + 1) % 2 === 0;

        // Try extracting reading from existing reading property, caption or previewUrl
        let reading = photo.leituraMiliohmimetro;
        if (!reading) {
          // Try from caption
          const capMatch = photo.legenda?.match(/([0-9]+(?:[.,][0-9]+)?\s*(?:mΩ|Ω|kΩ|mOhm|Ohm))/i);
          if (capMatch) {
            reading = capMatch[1];
          } else if (isSvg) {
            // Try from decoded svg
            try {
              const dec = decodeURIComponent(photo.previewUrl);
              const svgMatch = dec.match(/([0-9]+(?:[.,][0-9]+)?\s*(?:mΩ|Ω|kΩ|mOhm|Ohm))/i);
              if (svgMatch) reading = svgMatch[1];
            } catch {
              // ignore
            }
          }
        }

        // If it's a meter photo and still lacks reading, assign calibrated default reading
        if (isMeter && !reading) {
          const rIndex = Math.floor(idx / 2) % DEFAULT_READINGS.length;
          reading = DEFAULT_READINGS[rIndex];
        }

        if (isMeter) {
          if (photo.leituraMiliohmimetro !== reading) {
            photo.leituraMiliohmimetro = reading;
            listModified = true;
          }

          const expectedLegenda = `Ponto #${idx + 1} - ${reading}`;
          if (photo.legenda !== expectedLegenda) {
            photo.legenda = expectedLegenda;
            listModified = true;
          }

          // If it was a mock SVG or square, regenerate with high contrast crystal LCD
          if (isSvg) {
            photo.previewUrl = createRepairedSvg('miliohm', `Ponto ${idx + 1}`, reading);
            listModified = true;
          }
        } else {
          // Test pit
          const expectedLegenda = `Ponto #${idx + 1} - Caixa de Inspeção`;
          if (photo.legenda !== expectedLegenda) {
            photo.legenda = expectedLegenda;
            listModified = true;
          }
          if (isSvg) {
            photo.previewUrl = createRepairedSvg('pit', `Ponto ${idx + 1}`);
            listModified = true;
          }
        }
      } else if (category === 'spda_captores') {
        // SPDA: Eliminate captions for normal photos. Keep only yellow alert tag
        const isAlert =
          photo.destaqueAlerta ||
          photo.tipoDefeito ||
          (photo.legenda && photo.legenda.toUpperCase().includes('FALTA EQUIPOTENCIALIZAR'));

        if (isAlert) {
          photo.destaqueAlerta = true;
          if (!photo.tipoDefeito) {
            photo.tipoDefeito = 'FALTA EQUIPOTENCIALIZAR';
            listModified = true;
          }
          // Caption is replaced by the yellow badge
          if (photo.legenda !== 'FALTA EQUIPOTENCIALIZAR') {
            photo.legenda = 'FALTA EQUIPOTENCIALIZAR';
            listModified = true;
          }
        } else {
          // Normal photo: caption eliminated
          if (photo.legenda && photo.legenda !== '') {
            photo.legenda = '';
            listModified = true;
          }
        }

        if (isSquareSvg) {
          const type = (idx + 1) === 1 ? 'captor' : 'connector';
          photo.previewUrl = createRepairedSvg(type, photo.legenda || 'SPDA');
          listModified = true;
        }
      } else if (category === 'quadros_dps') {
        // Quadros: Eliminate captions for normal photos. Only yellow alert for defect
        const isAlert =
          photo.destaqueAlerta ||
          photo.tipoDefeito ||
          (photo.legenda && photo.legenda.toUpperCase().includes('FALTA DPS'));

        if (isAlert) {
          photo.destaqueAlerta = true;
          if (!photo.tipoDefeito) {
            photo.tipoDefeito = 'FALTA DPS';
            listModified = true;
          }
          if (photo.legenda !== 'FALTA DPS') {
            photo.legenda = 'FALTA DPS';
            listModified = true;
          }
        } else {
          // Normal photo: caption eliminated
          if (photo.legenda && photo.legenda !== '') {
            photo.legenda = '';
            listModified = true;
          }
        }

        if (isSquareSvg) {
          photo.previewUrl = createRepairedSvg('switchboard', photo.legenda || 'Quadro');
          listModified = true;
        }
      }
    });

    return listModified;
  };

  // Iterate over all towers
  updated.torres.forEach((tower, tIdx) => {
    const ensModified = repairPhotoList(tower.fotosEnsaio, 'ensaio_miliohmimetro', tower.nome);
    const spdaModified = repairPhotoList(tower.fotosSpda, 'spda_captores', tower.nome);
    const quadModified = repairPhotoList(tower.fotosQuadros, 'quadros_dps', tower.nome);

    if (ensModified || spdaModified || quadModified) {
      modified = true;
      details.push(`Fotos e leituras da ${tower.nome} sincronizadas para 3x4`);
    }
  });

  // Repair common area
  if (updated.areaComum.habilitada) {
    const spdaComumMod = repairPhotoList(updated.areaComum.fotosSpda, 'spda_captores', 'Área Comum');
    const quadComumMod = repairPhotoList(updated.areaComum.fotosQuadros, 'quadros_dps', 'Área Comum');
    if (spdaComumMod || quadComumMod) {
      modified = true;
      details.push('Fotos da Área Comum sincronizadas para 3x4');
    }
  }

  return { report: updated, modified, details };
}

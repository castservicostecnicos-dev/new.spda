/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PhotoItem } from '../types/spda';

/**
 * Creates high-fidelity SVG data URLs representing real inspection photos
 * (Miliohmímetro readings, inspection pits with clamps, Franklin rods,
 * electrical distribution panels with DPS, etc.) for sample preview.
 */
function createTechnicalSvg(
  type: 'miliohm' | 'pit' | 'captor' | 'connector' | 'switchboard' | 'aerial' | 'facade',
  label: string,
  extra?: string
): string {
  let innerContent = '';
  const width = 300;
  const height = 300;

  switch (type) {
    case 'miliohm':
      innerContent = `
        <rect width="300" height="300" fill="#2b313a"/>
        <rect x="30" y="30" width="240" height="240" rx="8" fill="#1e232a" stroke="#4b5563" stroke-width="4"/>
        <rect x="50" y="55" width="200" height="70" rx="4" fill="#0f172a" stroke="#334155"/>
        <text x="150" y="100" fill="#22c55e" font-family="monospace" font-size="28" font-weight="bold" text-anchor="middle">${extra || '0.124 Ω'}</text>
        <text x="150" y="118" fill="#94a3b8" font-family="sans-serif" font-size="10" text-anchor="middle">CONTINUIDADE 4 FIOS</text>
        <!-- Buttons and LEDs -->
        <circle cx="80" cy="165" r="12" fill="#ef4444"/>
        <circle cx="125" cy="165" r="12" fill="#22c55e"/>
        <circle cx="170" cy="165" r="12" fill="#3b82f6"/>
        <circle cx="215" cy="165" r="12" fill="#eab308"/>
        <!-- Brand label -->
        <rect x="90" y="200" width="120" height="26" fill="#0284c7" rx="3"/>
        <text x="150" y="218" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">HI-TECH HTM-01</text>
        <text x="150" y="250" fill="#9ca3af" font-family="sans-serif" font-size="9" text-anchor="middle">KELVIN 1.2A DC</text>
      `;
      break;
    case 'pit':
      innerContent = `
        <rect width="300" height="300" fill="#78716c"/>
        <circle cx="150" cy="150" r="110" fill="#44403c" stroke="#292524" stroke-width="8"/>
        <circle cx="150" cy="150" r="80" fill="#292524"/>
        <!-- Copper rod -->
        <circle cx="150" cy="150" r="18" fill="#b45309" stroke="#d97706" stroke-width="3"/>
        <!-- Red Kelvin clamp -->
        <path d="M120 180 L145 155 L160 170 L135 195 Z" fill="#ef4444"/>
        <line x1="120" y1="180" x2="60" y2="240" stroke="#ef4444" stroke-width="6"/>
        <line x1="140" y1="190" x2="50" y2="270" stroke="#000000" stroke-width="4"/>
        <text x="150" y="280" fill="#f5f5f4" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Caixa de Inspeção SPDA</text>
      `;
      break;
    case 'captor':
      innerContent = `
        <rect width="300" height="300" fill="#64748b"/>
        <!-- Sky gradient -->
        <rect width="300" height="220" fill="#94a3b8"/>
        <!-- Roof parapet -->
        <rect x="0" y="220" width="300" height="80" fill="#cbd5e1" stroke="#94a3b8"/>
        <!-- Mast and Franklin rod -->
        <line x1="150" y1="230" x2="150" y2="40" stroke="#475569" stroke-width="8"/>
        <polygon points="150,25 142,50 158,50" fill="#f59e0b"/>
        <line x1="150" y1="45" x2="130" y2="30" stroke="#f59e0b" stroke-width="3"/>
        <line x1="150" y1="45" x2="170" y2="30" stroke="#f59e0b" stroke-width="3"/>
        <line x1="150" y1="45" x2="150" y2="20" stroke="#f59e0b" stroke-width="3"/>
        <!-- Down conductor tape -->
        <path d="M150 230 L190 250 L270 250" fill="none" stroke="#b45309" stroke-width="5"/>
        <text x="150" y="285" fill="#334155" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Captor Tipo Franklin</text>
      `;
      break;
    case 'connector':
      innerContent = `
        <rect width="300" height="300" fill="#e2e8f0"/>
        <!-- Parapet ledge -->
        <rect x="0" y="100" width="300" height="120" fill="#d1d5db" stroke="#9ca3af"/>
        <!-- Copper strip -->
        <line x1="20" y1="160" x2="280" y2="160" stroke="#b45309" stroke-width="12"/>
        <!-- Rust / paint / oxidation patch -->
        <circle cx="150" cy="160" r="38" fill="#ea580c" opacity="0.6"/>
        <circle cx="150" cy="160" r="22" fill="#7c2d12" stroke="#451a03" stroke-width="3"/>
        <!-- Focus circle indicator (red inspection ring as in reference PDF) -->
        <circle cx="150" cy="160" r="55" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="4 2"/>
        <text x="150" y="260" fill="#991b1b" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Conector / Ponto Inspecionado</text>
      `;
      break;
    case 'switchboard':
      innerContent = `
        <rect width="300" height="300" fill="#cbd5e1"/>
        <!-- Enclosure box -->
        <rect x="35" y="25" width="230" height="250" fill="#b91c1c" rx="4" stroke="#7f1d1d" stroke-width="4"/>
        <rect x="50" y="40" width="200" height="220" fill="#f8fafc" stroke="#e2e8f0"/>
        <!-- Main Breaker -->
        <rect x="110" y="55" width="80" height="45" fill="#1e293b"/>
        <!-- DPS modules (Red & White Clamper/Finder units) -->
        <g transform="translate(70, 120)">
          <rect x="0" y="0" width="35" height="50" fill="#dc2626" rx="2"/>
          <text x="17" y="28" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">DPS</text>
          <rect x="40" y="0" width="35" height="50" fill="#dc2626" rx="2"/>
          <text x="57" y="28" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">DPS</text>
          <rect x="80" y="0" width="35" height="50" fill="#dc2626" rx="2"/>
          <text x="97" y="28" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">DPS</text>
          <rect x="120" y="0" width="35" height="50" fill="#2563eb" rx="2"/>
          <text x="137" y="28" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">DPS-N</text>
        </g>
        <!-- Busbars and wiring -->
        <line x1="87" y1="180" x2="87" y2="230" stroke="#22c55e" stroke-width="4"/>
        <line x1="127" y1="180" x2="127" y2="230" stroke="#22c55e" stroke-width="4"/>
        <line x1="167" y1="180" x2="167" y2="230" stroke="#22c55e" stroke-width="4"/>
        <text x="150" y="250" fill="#1e293b" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">QGBT / Painel com DPS</text>
      `;
      break;
    case 'aerial':
      innerContent = `
        <rect width="300" height="300" fill="#15803d"/>
        <!-- Building rooftops from satellite perspective -->
        <rect x="40" y="40" width="90" height="90" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="170" y="40" width="90" height="90" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="40" y="170" width="90" height="90" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="170" y="170" width="90" height="90" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <!-- Internal courtyard / pool -->
        <rect x="120" y="120" width="60" height="60" fill="#0284c7" rx="6"/>
        <text x="150" y="285" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${label}</text>
      `;
      break;
    case 'facade':
      innerContent = `
        <rect width="300" height="300" fill="#bae6fd"/>
        <!-- Ground / Street -->
        <rect x="0" y="210" width="300" height="90" fill="#475569"/>
        <!-- Residential towers facade -->
        <rect x="40" y="40" width="90" height="180" fill="#fed7aa" stroke="#fb923c" stroke-width="2"/>
        <rect x="170" y="40" width="90" height="180" fill="#fed7aa" stroke="#fb923c" stroke-width="2"/>
        <!-- Windows pattern -->
        <g fill="#0284c7" opacity="0.8">
          <rect x="55" y="60" width="20" height="20"/>
          <rect x="95" y="60" width="20" height="20"/>
          <rect x="55" y="100" width="20" height="20"/>
          <rect x="95" y="100" width="20" height="20"/>
          <rect x="55" y="140" width="20" height="20"/>
          <rect x="95" y="140" width="20" height="20"/>
          <rect x="185" y="60" width="20" height="20"/>
          <rect x="225" y="60" width="20" height="20"/>
          <rect x="185" y="100" width="20" height="20"/>
          <rect x="225" y="100" width="20" height="20"/>
          <rect x="185" y="140" width="20" height="20"/>
          <rect x="225" y="140" width="20" height="20"/>
        </g>
        <text x="150" y="255" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${label}</text>
      `;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${innerContent}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generateSamplePhotosForTower(towerId: string, towerName: string): {
  fotosEnsaio: PhotoItem[];
  fotosSpda: PhotoItem[];
  fotosQuadros: PhotoItem[];
} {
  const fotosEnsaio: PhotoItem[] = [];
  // 15 Continuity test points (miliohmímetro + caixa)
  const readings = ['0.120 Ω', '0.089 Ω', '0.104 Ω', '0.118 Ω', '0.095 Ω', '0.112 Ω', '0.076 Ω', '0.130 Ω'];
  for (let i = 1; i <= 15; i++) {
    const isMeter = i % 2 === 0;
    fotosEnsaio.push({
      id: `${towerId}-ens-${i}`,
      torreId: towerId,
      categoria: 'ensaio_miliohmimetro',
      legenda: towerName,
      previewUrl: isMeter
        ? createTechnicalSvg('miliohm', `${towerName} P${i}`, readings[i % readings.length])
        : createTechnicalSvg('pit', `${towerName} P${i}`),
      nomeArquivoOriginal: `${towerName.replace(/\s+/g, '_')}_Ensaio_Ponto_${i}.jpg`,
      tamanhoBytes: 350000,
      tipoMime: 'image/jpeg',
      dataHora: Date.now() - i * 60000,
      ordem: i,
    });
  }

  // SPDA Captores e Descidas
  const spdaCaptions: Array<{ label: string; alert?: boolean; type: 'captor' | 'connector' }> = [
    { label: 'Captor tipo Franklin', alert: false, type: 'captor' },
    { label: 'Conector oxidado', alert: false, type: 'connector' },
    { label: 'Conector com tinta', alert: false, type: 'connector' },
    { label: 'Conector oxidado', alert: false, type: 'connector' },
    { label: 'Malha com tinta', alert: false, type: 'connector' },
    { label: '⚠ FALTA EQUIPOTENCIALIZAR', alert: true, type: 'connector' },
    { label: '⚠ FALTA EQUIPOTENCIALIZAR', alert: true, type: 'connector' },
    { label: '⚠ FALTA EQUIPOTENCIALIZAR', alert: true, type: 'connector' },
    { label: 'Conector oxidado', alert: false, type: 'connector' },
  ];

  const fotosSpda: PhotoItem[] = spdaCaptions.map((item, idx) => ({
    id: `${towerId}-spda-${idx + 1}`,
    torreId: towerId,
    categoria: 'spda_captores',
    legenda: item.label,
    destaqueAlerta: item.alert,
    previewUrl: createTechnicalSvg(item.type, item.label),
    nomeArquivoOriginal: `${towerName.replace(/\s+/g, '_')}_SPDA_${idx + 1}.jpg`,
    tamanhoBytes: 420000,
    tipoMime: 'image/jpeg',
    dataHora: Date.now() - idx * 50000,
    ordem: idx + 1,
  }));

  // Quadros de energia & DPS
  const fotosQuadros: PhotoItem[] = [];
  for (let i = 1; i <= 15; i++) {
    fotosQuadros.push({
      id: `${towerId}-qdr-${i}`,
      torreId: towerId,
      categoria: 'quadros_dps',
      legenda: towerName,
      previewUrl: createTechnicalSvg('switchboard', `${towerName} Q${i}`),
      nomeArquivoOriginal: `${towerName.replace(/\s+/g, '_')}_Quadro_${i}.jpg`,
      tamanhoBytes: 390000,
      tipoMime: 'image/jpeg',
      dataHora: Date.now() - i * 40000,
      ordem: i,
    });
  }

  return { fotosEnsaio, fotosSpda, fotosQuadros };
}

export function generateSampleCommonAreaPhotos(): {
  fotosSpda: PhotoItem[];
  fotosQuadros: PhotoItem[];
} {
  const spdaList: Array<{ label: string; alert?: boolean }> = [
    { label: 'Malha com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: '⚠ FALTA EQUIPOTENCIALIZAR', alert: true },
    { label: '⚠ FALTA EQUIPOTENCIALIZAR', alert: true },
    { label: '⚠ FALTA EQUIPOTENCIALIZAR', alert: true },
  ];

  const fotosSpda: PhotoItem[] = spdaList.map((item, idx) => ({
    id: `comum-spda-${idx + 1}`,
    torreId: 'area_comum',
    categoria: 'spda_captores',
    legenda: item.label,
    destaqueAlerta: item.alert,
    observacao: item.alert ? 'Usina solar - falta equipotencializar' : undefined,
    previewUrl: createTechnicalSvg('connector', item.label),
    nomeArquivoOriginal: `Area_Comum_SPDA_${idx + 1}.jpg`,
    tamanhoBytes: 410000,
    tipoMime: 'image/jpeg',
    dataHora: Date.now() - idx * 30000,
    ordem: idx + 1,
  }));

  const fotosQuadros: PhotoItem[] = [];
  const labels = [
    'Registro técnico - Área Comum',
    'Área Comum',
    'Área Comum',
    'Área Comum',
    'Área Comum',
  ];
  labels.forEach((lbl, idx) => {
    fotosQuadros.push({
      id: `comum-qdr-${idx + 1}`,
      torreId: 'area_comum',
      categoria: 'quadros_dps',
      legenda: lbl,
      previewUrl: createTechnicalSvg('switchboard', lbl),
      nomeArquivoOriginal: `Area_Comum_Quadro_${idx + 1}.jpg`,
      tamanhoBytes: 380000,
      tipoMime: 'image/jpeg',
      dataHora: Date.now() - idx * 25000,
      ordem: idx + 1,
    });
  });

  return { fotosSpda, fotosQuadros };
}

export function getBuildingSampleImages(): { fotoAereaUrl: string; fotoFachadaUrl: string } {
  return {
    fotoAereaUrl: createTechnicalSvg('aerial', 'Vista aérea do condomínio'),
    fotoFachadaUrl: createTechnicalSvg('facade', 'Entrada do condomínio'),
  };
}

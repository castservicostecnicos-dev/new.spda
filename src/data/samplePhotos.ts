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
  const height = 400;

  switch (type) {
    case 'miliohm':
      innerContent = `
        <rect width="300" height="400" fill="#1e293b"/>
        <!-- Outer casing with rugged industrial bumper -->
        <rect x="18" y="18" width="264" height="364" rx="12" fill="#0f172a" stroke="#475569" stroke-width="5"/>
        
        <!-- Top Device Header / Brand -->
        <rect x="30" y="30" width="240" height="34" rx="4" fill="#0284c7"/>
        <text x="150" y="52" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="900" letter-spacing="1" text-anchor="middle">MICRÔMETRO / MILIOHMÍMETRO</text>

        <!-- Huge LCD Display Screen with high contrast green glow -->
        <rect x="30" y="74" width="240" height="136" rx="6" fill="#022c22" stroke="#16a34a" stroke-width="4"/>
        
        <!-- LCD subtle inner bevel -->
        <rect x="36" y="80" width="228" height="124" rx="4" fill="#031f18"/>
        
        <!-- Measurement Unit & Mode Indicators in LCD -->
        <text x="50" y="104" fill="#86efac" font-family="sans-serif" font-size="11" font-weight="bold">KELVIN 4 FIOS</text>
        <text x="250" y="104" fill="#86efac" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="end">DC 1.2A</text>
        
        <!-- ENORMOUS, CRYSTAL-CLEAR DIGITAL READING DISPLAY -->
        <text x="150" y="160" fill="#4ade80" font-family="'Courier New', Courier, monospace" font-size="44" font-weight="900" letter-spacing="2" text-anchor="middle">${extra || '0.104 Ω'}</text>
        
        <!-- LCD Status bar -->
        <rect x="36" y="176" width="228" height="28" fill="#04271e"/>
        <text x="150" y="195" fill="#86efac" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">STATUS: LEITURA ESTÁVEL</text>
        
        <!-- Instrument Rotary Switch / Control Panel -->
        <circle cx="150" cy="265" r="36" fill="#334155" stroke="#64748b" stroke-width="4"/>
        <line x1="150" y1="265" x2="150" y2="238" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>
        <text x="150" y="228" fill="#f8fafc" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">200 mΩ</text>
        <text x="200" y="270" fill="#94a3b8" font-family="sans-serif" font-size="9" text-anchor="middle">2 Ω</text>
        <text x="100" y="270" fill="#94a3b8" font-family="sans-serif" font-size="9" text-anchor="middle">OFF</text>
        
        <!-- Kelvin Test Terminals (C1, P1, P2, C2) -->
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
        <!-- Copper rod -->
        <circle cx="150" cy="180" r="22" fill="#b45309" stroke="#d97706" stroke-width="3"/>
        <!-- Red Kelvin clamp -->
        <path d="M115 215 L145 185 L165 205 L135 235 Z" fill="#ef4444"/>
        <line x1="115" y1="215" x2="45" y2="295" stroke="#ef4444" stroke-width="8"/>
        <line x1="140" y1="230" x2="35" y2="340" stroke="#000000" stroke-width="5"/>
        <text x="150" y="360" fill="#f5f5f4" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Caixa de Inspeção SPDA</text>
      `;
      break;
    case 'captor':
      innerContent = `
        <rect width="300" height="400" fill="#64748b"/>
        <!-- Sky gradient -->
        <rect width="300" height="300" fill="#94a3b8"/>
        <!-- Roof parapet -->
        <rect x="0" y="300" width="300" height="100" fill="#cbd5e1" stroke="#94a3b8"/>
        <!-- Mast and Franklin rod -->
        <line x1="150" y1="310" x2="150" y2="60" stroke="#475569" stroke-width="8"/>
        <polygon points="150,40 140,70 160,70" fill="#f59e0b"/>
        <line x1="150" y1="65" x2="125" y2="45" stroke="#f59e0b" stroke-width="4"/>
        <line x1="150" y1="65" x2="175" y2="45" stroke="#f59e0b" stroke-width="4"/>
        <line x1="150" y1="65" x2="150" y2="30" stroke="#f59e0b" stroke-width="4"/>
        <!-- Down conductor tape -->
        <path d="M150 310 L195 335 L280 335" fill="none" stroke="#b45309" stroke-width="6"/>
        <text x="150" y="375" fill="#334155" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Captor Tipo Franklin</text>
      `;
      break;
    case 'connector':
      innerContent = `
        <rect width="300" height="400" fill="#e2e8f0"/>
        <!-- Parapet ledge -->
        <rect x="0" y="140" width="300" height="150" fill="#d1d5db" stroke="#9ca3af"/>
        <!-- Copper strip -->
        <line x1="15" y1="210" x2="285" y2="210" stroke="#b45309" stroke-width="14"/>
        <!-- Rust / paint / oxidation patch -->
        <circle cx="150" cy="210" r="42" fill="#ea580c" opacity="0.65"/>
        <circle cx="150" cy="210" r="26" fill="#7c2d12" stroke="#451a03" stroke-width="3"/>
        <!-- Focus circle indicator (red inspection ring as in reference PDF) -->
        <circle cx="150" cy="210" r="65" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-dasharray="5 3"/>
        <text x="150" y="350" fill="#991b1b" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Ponto de Inspeção / Conector</text>
      `;
      break;
    case 'switchboard':
      innerContent = `
        <rect width="300" height="400" fill="#cbd5e1"/>
        <!-- Enclosure box -->
        <rect x="25" y="30" width="250" height="340" fill="#b91c1c" rx="6" stroke="#7f1d1d" stroke-width="4"/>
        <rect x="40" y="45" width="220" height="310" fill="#f8fafc" stroke="#e2e8f0"/>
        <!-- Main Breaker -->
        <rect x="105" y="65" width="90" height="55" fill="#1e293b"/>
        <!-- DPS modules (Red & Blue units) -->
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
        <!-- Busbars and wiring -->
        <line x1="80" y1="225" x2="80" y2="295" stroke="#22c55e" stroke-width="5"/>
        <line x1="126" y1="225" x2="126" y2="295" stroke="#22c55e" stroke-width="5"/>
        <line x1="172" y1="225" x2="172" y2="295" stroke="#22c55e" stroke-width="5"/>
        <text x="150" y="330" fill="#1e293b" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">QGBT / Painel Elétrico</text>
      `;
      break;
    case 'aerial':
      innerContent = `
        <rect width="300" height="400" fill="#15803d"/>
        <!-- Building rooftops from satellite perspective -->
        <rect x="35" y="45" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="165" y="45" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="35" y="200" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <rect x="165" y="200" width="100" height="110" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
        <!-- Internal courtyard / pool -->
        <rect x="115" y="145" width="70" height="65" fill="#0284c7" rx="6"/>
        <text x="150" y="365" fill="#f8fafc" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">${label}</text>
      `;
      break;
    case 'facade':
      innerContent = `
        <rect width="300" height="400" fill="#bae6fd"/>
        <!-- Ground / Street -->
        <rect x="0" y="290" width="300" height="110" fill="#475569"/>
        <!-- Residential towers facade -->
        <rect x="35" y="40" width="100" height="250" fill="#fed7aa" stroke="#fb923c" stroke-width="2"/>
        <rect x="165" y="40" width="100" height="250" fill="#fed7aa" stroke="#fb923c" stroke-width="2"/>
        <!-- Windows pattern -->
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

export function generateSamplePhotosForTower(towerId: string, towerName: string): {
  fotosEnsaio: PhotoItem[];
  fotosSpda: PhotoItem[];
  fotosQuadros: PhotoItem[];
} {
  const fotosEnsaio: PhotoItem[] = [];
  // 15 Continuity test points (miliohmímetro + caixa)
  const readings = ['0.104 Ω', '0.089 Ω', '0.120 Ω', '0.095 Ω', '0.118 Ω', '0.112 Ω', '0.076 Ω', '0.130 Ω'];
  for (let i = 1; i <= 15; i++) {
    const isMeter = i % 2 === 0;
    const reading = isMeter ? readings[Math.floor((i - 1) / 2) % readings.length] : undefined;
    const legenda = isMeter
      ? `Ponto #${i} - ${reading}`
      : `Ponto #${i} - Caixa de Inspeção`;

    fotosEnsaio.push({
      id: `${towerId}-ens-${i}`,
      torreId: towerId,
      categoria: 'ensaio_miliohmimetro',
      legenda,
      leituraMiliohmimetro: reading,
      previewUrl: isMeter
        ? createTechnicalSvg('miliohm', `Ponto ${i}`, reading)
        : createTechnicalSvg('pit', `Ponto ${i}`),
      nomeArquivoOriginal: `${towerName.replace(/\s+/g, '_')}_Ensaio_Ponto_${i}.jpg`,
      tamanhoBytes: 350000,
      tipoMime: 'image/jpeg',
      dataHora: Date.now() - i * 60000,
      ordem: i,
    });
  }

  // SPDA Captores e Descidas
  const spdaCaptions: Array<{ label: string; alert?: boolean; defect?: string; type: 'captor' | 'connector' }> = [
    { label: 'Captor tipo Franklin', alert: false, type: 'captor' },
    { label: 'Conector oxidado', alert: false, type: 'connector' },
    { label: 'Conector com tinta', alert: false, type: 'connector' },
    { label: 'Conector oxidado', alert: false, type: 'connector' },
    { label: 'Malha com tinta', alert: false, type: 'connector' },
    { label: 'FALTA EQUIPOTENCIALIZAR', alert: true, defect: 'FALTA EQUIPOTENCIALIZAR', type: 'connector' },
    { label: 'FALTA EQUIPOTENCIALIZAR', alert: true, defect: 'FALTA EQUIPOTENCIALIZAR', type: 'connector' },
    { label: 'FALTA EQUIPOTENCIALIZAR', alert: true, defect: 'FALTA EQUIPOTENCIALIZAR', type: 'connector' },
    { label: 'Conector oxidado', alert: false, type: 'connector' },
  ];

  const fotosSpda: PhotoItem[] = spdaCaptions.map((item, idx) => ({
    id: `${towerId}-spda-${idx + 1}`,
    torreId: towerId,
    categoria: 'spda_captores',
    legenda: item.label,
    destaqueAlerta: item.alert,
    tipoDefeito: item.defect,
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
  const spdaList: Array<{ label: string; alert?: boolean; defect?: string }> = [
    { label: 'Malha com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'Malha e conector com tinta', alert: false },
    { label: 'FALTA EQUIPOTENCIALIZAR', alert: true, defect: 'FALTA EQUIPOTENCIALIZAR' },
    { label: 'FALTA EQUIPOTENCIALIZAR', alert: true, defect: 'FALTA EQUIPOTENCIALIZAR' },
    { label: 'FALTA EQUIPOTENCIALIZAR', alert: true, defect: 'FALTA EQUIPOTENCIALIZAR' },
  ];

  const fotosSpda: PhotoItem[] = spdaList.map((item, idx) => ({
    id: `comum-spda-${idx + 1}`,
    torreId: 'area_comum',
    categoria: 'spda_captores',
    legenda: item.label,
    destaqueAlerta: item.alert,
    tipoDefeito: item.defect,
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

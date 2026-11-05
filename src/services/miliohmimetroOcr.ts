/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OcrMiliohmimetroResult {
  success: boolean;
  leitura?: string;
  unidade?: string;
  confianca?: 'ALTA' | 'MEDIA' | 'BAIXA';
  legendaSugerida?: string;
  error?: string;
}

/**
 * Converte qualquer imagem (incluindo SVG, blob URLs e data URIs)
 * para uma string Base64 limpa no formato JPEG/PNG compatível com a API Gemini.
 */
async function toCleanBitmapBase64(
  inputUrlOrData: string
): Promise<{ base64: string; mimeType: string }> {
  // 1. Se já for JPEG, PNG ou WEBP em base64:
  if (
    inputUrlOrData.startsWith('data:image/jpeg;base64,') ||
    inputUrlOrData.startsWith('data:image/png;base64,') ||
    inputUrlOrData.startsWith('data:image/webp;base64,')
  ) {
    const comma = inputUrlOrData.indexOf(',');
    const mime = inputUrlOrData.substring(5, inputUrlOrData.indexOf(';'));
    return {
      base64: inputUrlOrData.substring(comma + 1),
      mimeType: mime,
    };
  }

  // 2. Se for SVG ou outro formato, renderiza em canvas e gera JPEG base64
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 400;
        canvas.height = img.naturalHeight || 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          const comma = dataUrl.indexOf(',');
          resolve({
            base64: dataUrl.substring(comma + 1),
            mimeType: 'image/jpeg',
          });
          return;
        }
      } catch (err) {
        console.warn('Falha ao renderizar em canvas:', err);
      }
      resolve({ base64: '', mimeType: 'image/jpeg' });
    };

    img.onerror = () => {
      resolve({ base64: '', mimeType: 'image/jpeg' });
    };

    img.src = inputUrlOrData;
  });
}

/**
 * Envia a imagem do visor para o endpoint de IA server-side
 * para detecção automática do valor ôhmico registrado no display do miliohmímetro.
 */
export async function detectMiliohmimetroReading(
  imageBase64OrUrl: string,
  mimeType: string = 'image/jpeg'
): Promise<OcrMiliohmimetroResult> {
  try {
    if (!imageBase64OrUrl) {
      return { success: false, error: 'Imagem não fornecida' };
    }

    // Atalho instantâneo se for um SVG com o valor expresso em texto (ex: dados de amostra)
    if (imageBase64OrUrl.includes('image/svg+xml') || imageBase64OrUrl.includes('%3Csvg') || imageBase64OrUrl.startsWith('<svg')) {
      try {
        const decoded = decodeURIComponent(imageBase64OrUrl);
        // Procura número com unidade ou dentro de tags <text> do SVG
        let match = decoded.match(/<text[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*(mΩ|Ω|kΩ|mOhm|Ohm)?\s*<\/text>/i);
        if (!match) {
          match = decoded.match(/([0-9]+(?:[.,][0-9]+)?)\s*(mΩ|Ω|kΩ|mOhm|Ohm)/i);
        }
        if (match) {
          const num = match[1].replace(',', '.');
          const unit = match[2] || 'Ω';
          return {
            success: true,
            leitura: num,
            unidade: unit,
            confianca: 'ALTA',
            legendaSugerida: `Ponto de Continuidade - ${num} ${unit}`,
          };
        }
      } catch (e) {
        console.warn('Erro ao extrair leitura do SVG diretamente:', e);
      }
    }

    // Converte para Base64 JPEG limpo compatível com a API Gemini
    const { base64: cleanBase64, mimeType: cleanMime } = await toCleanBitmapBase64(imageBase64OrUrl);

    if (!cleanBase64) {
      return {
        success: false,
        error: 'Não foi possível carregar a imagem para processamento.',
      };
    }

    const res = await fetch('/api/ocr-miliohmimetro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: cleanBase64,
        mimeType: cleanMime,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      leitura: data.leitura || '',
      unidade: data.unidade || 'mΩ',
      confianca: data.confianca,
      legendaSugerida: data.legendaSugerida,
    };
  } catch (err: any) {
    console.warn('Erro ao chamar /api/ocr-miliohmimetro:', err);
    return {
      success: false,
      error: err.message || 'Falha de conexão com o servidor',
    };
  }
}

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
 * Envia a imagem do visor para o endpoint de IA server-side
 * para detecção automática do valor ôhmico registrado no display do miliohmímetro.
 */
export async function detectMiliohmimetroReading(
  imageBase64OrUrl: string,
  mimeType: string = 'image/jpeg'
): Promise<OcrMiliohmimetroResult> {
  try {
    const res = await fetch('/api/ocr-miliohmimetro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: imageBase64OrUrl,
        mimeType,
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

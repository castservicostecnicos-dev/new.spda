import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with 50mb limit for high-resolution photo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI client (only if GEMINI_API_KEY is available)
let genAI: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API endpoint to perform OCR on milliohmmeter display
app.post('/api/ocr-miliohmimetro', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem fornecida.' });
    }

    if (!genAI) {
      return res.status(503).json({
        error: 'Chave GEMINI_API_KEY não configurada no servidor.',
        leitura: '',
      });
    }

    // Strip prefix like "data:image/jpeg;base64," if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Você é um perito em engenharia elétrica e instrumentação de SPDA (NBR 5419:2026).
Analise a fotografia do visor/display do equipamento de medição (miliohmímetro, microhmímetro ou multímetro para ensaio de continuidade ôhmica Kelvin de 4 fios).
Objetivo: Identificar o número exato indicado no mostrador LCD/digital ou escala (por exemplo: 23.5, 0.18, 0.04, 1.25, 42.0, etc.) e a respectiva unidade de grandeza (mΩ, Ω, kΩ).

Retorne ESTRITAMENTE um objeto JSON com o formato:
{
  "leitura": "valor numérico detectado como string (ex: '23.5'). Se o visor estiver desligado ou não for visível número, retorne ''",
  "unidade": "unidade detectada ou suposta pelo contexto: 'mΩ', 'Ω' ou 'kΩ'",
  "confianca": "ALTA" | "MEDIA" | "BAIXA",
  "legendaSugerida": "string pronta para a legenda da foto, ex: 'Ponto de Continuidade - 23.5 mΩ'"
}
Não inclua explicações ou texto fora do JSON.`,
    };

    const response = await genAI.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedData = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      }
    }

    return res.json({ success: true, ...parsedData });
  } catch (error: any) {
    console.error('Erro na rota /api/ocr-miliohmimetro:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Falha ao processar a leitura do visor.',
      leitura: '',
    });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();

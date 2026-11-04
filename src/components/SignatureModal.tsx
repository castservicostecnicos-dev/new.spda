/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { TechnicalResponsibility } from '../types/spda';
import { PenTool, Upload, Trash2, Check, X, ShieldCheck } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  responsavel: TechnicalResponsibility;
  onSaveSignature: (signatureDataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  responsavel,
  onSaveSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(responsavel.assinaturaUrl);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewUrl(responsavel.assinaturaUrl);
    setHasContent(!!responsavel.assinaturaUrl);

    // Give time for modal animation then setup canvas
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Load existing if present
      if (responsavel.assinaturaUrl && activeTab === 'draw') {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = responsavel.assinaturaUrl;
      }
    }, 100);
  }, [isOpen, responsavel.assinaturaUrl, activeTab]);

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasContent(true);

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    setPreviewUrl(undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      setPreviewUrl(res);
      setHasContent(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    let finalUrl = previewUrl;
    if (activeTab === 'draw' && canvasRef.current) {
      finalUrl = canvasRef.current.toDataURL('image/png');
    }
    if (finalUrl) {
      onSaveSignature(finalUrl);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Assinatura Digital &amp; Responsabilidade Técnica
              </h3>
              <p className="text-xs text-slate-500">
                CREA: {responsavel.registroCrea} · ART: {responsavel.numeroArt}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex border-b border-slate-200 gap-4">
            <button
              onClick={() => setActiveTab('draw')}
              className={`pb-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 ${
                activeTab === 'draw'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <PenTool className="w-4 h-4" />
              Desenhar na Tela (Dedo ou Mouse)
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 ${
                activeTab === 'upload'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              Carregar Imagem de Assinatura
            </button>
          </div>

          {activeTab === 'draw' ? (
            <div className="space-y-2">
              <div className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50/50 overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[180px] cursor-crosshair bg-white"
                />
                {!hasContent && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs font-medium">
                    Assine aqui com o dedo ou mouse
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Traço sensível ao toque</span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-slate-600 hover:text-red-600 font-medium py-1 px-2 rounded hover:bg-slate-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Traço
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-red-50/20 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-700">
                  Clique para selecionar arquivo de imagem
                </span>
                <span className="text-xs text-slate-400 mt-1">PNG com fundo transparente ou JPG</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {previewUrl && (
                <div className="border border-slate-200 rounded-lg p-3 bg-white flex items-center justify-center h-28">
                  <img src={previewUrl} alt="Assinatura" className="max-h-full object-contain" />
                </div>
              )}
            </div>
          )}

          {/* Stamp Preview */}
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-700 space-y-1">
            <div className="font-extrabold uppercase text-slate-900 tracking-wide">
              {responsavel.responsavelTecnico}
            </div>
            <div className="text-slate-600">{responsavel.qualificacao}</div>
            <div className="text-slate-600">
              {responsavel.registroCrea} | ART: {responsavel.numeroArt}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasContent && !previewUrl}
            className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Check className="w-4 h-4" />
            Confirmar e Salvar no Laudo
          </button>
        </div>
      </div>
    </div>
  );
};

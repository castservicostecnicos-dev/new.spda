/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { PhotoItem } from '../types/spda';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Gauge,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  Sliders,
} from 'lucide-react';
import { detectMiliohmimetroReading } from '../services/miliohmimetroOcr';

interface MeterZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: PhotoItem | null;
  photoIndex: number;
  totalPhotos: number;
  towerName: string;
  onUpdatePhoto: (photoId: string, updates: Partial<PhotoItem>) => void;
  onNavigate: (newIndex: number) => void;
}

export const MeterZoomModal: React.FC<MeterZoomModalProps> = ({
  isOpen,
  onClose,
  photo,
  photoIndex,
  totalPhotos,
  towerName,
  onUpdatePhoto,
  onNavigate,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Value and unit state
  const [currentVal, setCurrentVal] = useState<string>('');
  const [currentUnit, setCurrentUnit] = useState<string>('Ω');
  const [isReadingAi, setIsReadingAi] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Sync state when photo changes
  useEffect(() => {
    if (photo) {
      setZoomLevel(1.5); // Default to 1.5x zoom so LCD is immediately larger and visible!
      setPan({ x: 0, y: -20 }); // Slightly pan towards the upper half where the meter screen sits
      setAiMessage(null);

      const existingReading = photo.leituraMiliohmimetro || '';
      if (existingReading) {
        const parts = existingReading.split(/\s+/);
        if (parts.length >= 2) {
          setCurrentVal(parts[0]);
          setCurrentUnit(parts[1]);
        } else {
          setCurrentVal(existingReading.replace(/[^0-9.,]/g, ''));
          setCurrentUnit(existingReading.includes('m') ? 'mΩ' : 'Ω');
        }
      } else {
        // Try extracting from caption
        const match = photo.legenda?.match(/([0-9]+(?:[.,][0-9]+)?)\s*(mΩ|Ω|kΩ)?/i);
        if (match) {
          setCurrentVal(match[1]);
          setCurrentUnit(match[2] || 'Ω');
        } else {
          setCurrentVal('');
          setCurrentUnit('Ω');
        }
      }
    }
  }, [photo?.id]);

  if (!isOpen || !photo) return null;

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(4, Math.max(1, +(prev + delta).toFixed(1))));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Run AI OCR on this photo
  const handleRunAi = async () => {
    setIsReadingAi(true);
    setAiMessage(null);
    try {
      const result = await detectMiliohmimetroReading(photo.previewUrl);
      if (result.success && result.leitura) {
        setCurrentVal(result.leitura);
        const unit = result.unidade || 'Ω';
        setCurrentUnit(unit);
        setAiMessage(`Leitura detectada com sucesso: ${result.leitura} ${unit}`);

        // Automatically apply to photo
        const formatted = `${result.leitura} ${unit}`;
        onUpdatePhoto(photo.id, {
          leituraMiliohmimetro: formatted,
          legenda: `Ponto #${photoIndex} - ${formatted}`,
        });
      } else {
        setAiMessage(result.error || 'Não foi possível detectar o número automaticamente. Digite no campo abaixo.');
      }
    } catch (err: any) {
      setAiMessage(err.message || 'Erro ao comunicar com o leitor.');
    } finally {
      setIsReadingAi(false);
    }
  };

  // Apply reading and save
  const handleSaveReading = (advanceNext = false) => {
    const valClean = currentVal.trim();
    if (valClean) {
      const formatted = `${valClean} ${currentUnit}`;
      onUpdatePhoto(photo.id, {
        leituraMiliohmimetro: formatted,
        legenda: `Ponto #${photoIndex} - ${formatted}`,
      });
    }

    if (advanceNext && photoIndex < totalPhotos) {
      onNavigate(photoIndex); // photoIndex is 1-based, passing to 0-based navigate
    } else if (!advanceNext) {
      onClose();
    }
  };

  const quickValues = ['23.5 mΩ', '0.104 Ω', '0.089 Ω', '0.120 Ω', '0.095 Ω', '0.118 Ω', '0.076 Ω'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-5">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[820px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Inspeção e Leitura do Visor</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                  Ponto #{photoIndex} de {totalPhotos}
                </span>
                <span className="text-xs text-slate-400">({towerName})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Arraste para mover e utilize o zoom para ler o visor digital com nitidez máxima
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left / Center: Interactive Image Pan & Zoom Area */}
          <div className="relative flex-1 bg-black/90 flex items-center justify-center overflow-hidden select-none">
            {/* Viewer Controls Toolbar */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-lg p-1 shadow-lg text-xs">
              <button
                type="button"
                onClick={() => handleZoom(-0.3)}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono font-bold text-slate-200 px-1 text-[11px] min-w-10 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.3)}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-200"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-200 flex items-center gap-1"
                title="Resetar Posição e Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[10px]">100%</span>
              </button>
            </div>

            {/* Hint overlay */}
            {zoomLevel > 1 && (
              <div className="absolute bottom-3 left-3 z-20 bg-slate-900/80 text-slate-300 text-[10px] px-2.5 py-1 rounded-full pointer-events-none border border-slate-700/60">
                Arraste a foto com o mouse para focar no visor
              </div>
            )}

            {/* Draggable & Scalable Image Container */}
            <div
              className={`w-full h-full flex items-center justify-center ${
                zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={photo.previewUrl}
                alt={photo.legenda || 'Foto do visor'}
                className="max-h-[85%] max-w-[85%] object-contain transition-transform duration-75 select-none rounded shadow-md"
                style={{
                  transform: `scale(${zoomLevel}) translate(${pan.x / zoomLevel}px, ${pan.y / zoomLevel}px)`,
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Right Panel: Value Input, AI Reader & Legend Sync */}
          <div className="w-full md:w-96 bg-slate-800/95 border-t md:border-t-0 md:border-l border-slate-700 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Point Badge & Status */}
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                    Ponto de Ensaio #{photoIndex}
                  </span>
                </div>
                {photo.leituraMiliohmimetro ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    Visor: {photo.leituraMiliohmimetro}
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Pendente Leitura
                  </span>
                )}
              </div>

              {/* AI Auto-Read Trigger */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-900/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Leitor Automático com IA
                  </span>
                  <span className="text-[9px] text-slate-400">Gemini 3.8 Flash</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Identifica automaticamente o número e a escala no display digital da foto.
                </p>

                <button
                  type="button"
                  disabled={isReadingAi}
                  onClick={handleRunAi}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
                >
                  {isReadingAi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Lendo visor com IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Ler Valor no Visor Automaticamente</span>
                    </>
                  )}
                </button>

                {aiMessage && (
                  <div className="text-[10.5px] p-2 rounded bg-slate-800 border border-slate-700 text-slate-200">
                    {aiMessage}
                  </div>
                )}
              </div>

              {/* Manual Entry & Calibration */}
              <div className="space-y-2 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
                <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>Valor Lido no Visor:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Ex: 23.5 ou 0.104</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={currentVal}
                    placeholder="Ex: 23.5"
                    onChange={(e) => setCurrentVal(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-base font-mono font-bold text-emerald-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  {/* Unit Selector */}
                  <div className="flex rounded-lg bg-slate-800 border border-slate-600 p-0.5 text-xs font-bold">
                    {(['mΩ', 'Ω', 'kΩ'] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setCurrentUnit(unit)}
                        className={`px-2 py-1 rounded font-mono transition-colors ${
                          currentUnit === unit
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Value suggestions */}
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-medium">Valores rápidos:</span>
                  <div className="flex flex-wrap gap-1">
                    {quickValues.map((qv) => (
                      <button
                        key={qv}
                        type="button"
                        onClick={() => {
                          const [v, u] = qv.split(' ');
                          setCurrentVal(v);
                          setCurrentUnit(u || 'Ω');
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono"
                      >
                        {qv}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview of the Report Caption */}
              <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                  Legenda Automática no Laudo:
                </span>
                <div className="text-xs font-mono font-semibold text-emerald-400">
                  {currentVal
                    ? `Ponto #${photoIndex} - ${currentVal.trim()} ${currentUnit}`
                    : `Ponto #${photoIndex}`}
                </div>
              </div>
            </div>

            {/* Bottom Actions & Navigation */}
            <div className="pt-3 border-t border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveReading(true)}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar e Próximo Ponto</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveReading(false)}
                  className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold text-xs transition-colors"
                >
                  Concluir
                </button>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  disabled={photoIndex <= 1}
                  onClick={() => onNavigate(photoIndex - 2)}
                  className="flex items-center gap-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 px-2 py-1 rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>
                <span className="font-mono text-[11px]">
                  {photoIndex} / {totalPhotos}
                </span>
                <button
                  type="button"
                  disabled={photoIndex >= totalPhotos}
                  onClick={() => onNavigate(photoIndex)}
                  className="flex items-center gap-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 px-2 py-1 rounded"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

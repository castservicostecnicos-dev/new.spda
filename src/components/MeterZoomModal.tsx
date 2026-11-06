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
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
} from 'lucide-react';

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

  // Caption state
  const [currentCaption, setCurrentCaption] = useState<string>('');

  // Sync state when photo changes
  useEffect(() => {
    if (photo) {
      setZoomLevel(1.2);
      setPan({ x: 0, y: 0 });
      setCurrentCaption(photo.legenda || `Ponto #${photoIndex}`);
    }
  }, [photo?.id, photoIndex]);

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

  // Save caption and close or navigate
  const handleSaveCaption = (advanceNext = false) => {
    onUpdatePhoto(photo.id, {
      legenda: currentCaption.trim(),
    });

    if (advanceNext && photoIndex < totalPhotos) {
      onNavigate(photoIndex); // photoIndex is 1-based, passing to 0-based navigate
    } else if (!advanceNext) {
      onClose();
    }
  };

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
                <span>Ampliação e Inspeção da Foto</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                  Foto #{photoIndex} de {totalPhotos}
                </span>
                <span className="text-xs text-slate-400">({towerName})</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Arraste com o mouse e utilize os controles de zoom para inspecionar os detalhes da fotografia
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
                Arraste a foto com o mouse para focar no detalhe desejado
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
                alt={photo.legenda || 'Foto ampliada'}
                className="max-h-[85%] max-w-[85%] object-contain transition-transform duration-75 select-none rounded shadow-md"
                style={{
                  transform: `scale(${zoomLevel}) translate(${pan.x / zoomLevel}px, ${pan.y / zoomLevel}px)`,
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Right Panel: Caption and Navigation */}
          <div className="w-full md:w-80 bg-slate-800/95 border-t md:border-t-0 md:border-l border-slate-700 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              <div className="border-b border-slate-700 pb-3">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-200 block">
                  Foto #{photoIndex} — {towerName}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Visualização nítida em proporção retangular 3:4.
                </p>
              </div>

              {/* Caption field */}
              <div className="space-y-2 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Legenda da Foto no Laudo:
                </label>
                <input
                  type="text"
                  value={currentCaption}
                  onChange={(e) => setCurrentCaption(e.target.value)}
                  placeholder={`Ex: Ponto #${photoIndex}`}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400">
                  Este texto será apresentado abaixo da foto no documento final.
                </p>
              </div>
            </div>

            {/* Bottom Actions & Navigation */}
            <div className="pt-3 border-t border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveCaption(true)}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar e Próxima Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCaption(false)}
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
                  <span>Próxima</span>
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

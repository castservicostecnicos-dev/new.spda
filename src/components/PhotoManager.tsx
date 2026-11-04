/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Tower, PhotoItem, PhotoCategory, CommonAreaSection } from '../types/spda';
import {
  Upload,
  Camera,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Check,
  Plus,
  FolderArchive,
  Image as ImageIcon,
} from 'lucide-react';
import { saveOriginalPhoto, createOptimizedPreview } from '../services/storage';

interface PhotoManagerProps {
  torres: Tower[];
  areaComum: CommonAreaSection;
  selectedTowerId: string;
  onSelectTowerId: (id: string) => void;
  onUpdateTowerPhotos: (
    towerId: string,
    category: PhotoCategory,
    photos: PhotoItem[]
  ) => void;
  onUpdateCommonAreaPhotos: (
    category: 'spda_captores' | 'quadros_dps',
    photos: PhotoItem[]
  ) => void;
}

const PRESET_CAPTIONS: Record<PhotoCategory, string[]> = {
  ensaio_miliohmimetro: [
    'Torre 1',
    'Torre 2',
    'Torre 3',
    'Torre 4',
    'Torre 5',
    'Caixa de Inspeção SPDA',
    'Ponto de Aterramento',
    'Ensaio Kelvin 4 Fios',
  ],
  spda_captores: [
    'Captor tipo Franklin',
    'Conector oxidado',
    'Conector com tinta',
    'Malha com tinta',
    'Malha e conector com tinta',
    'Parafuso oxidado',
    '⚠ FALTA EQUIPOTENCIALIZAR',
    'Descida SPDA externa',
  ],
  quadros_dps: [
    'Torre 1',
    'Torre 2',
    'Torre 3',
    'Torre 4',
    'QGBT Principal',
    'Quadro de Bombas',
    'Barramento de Equipotencialização (BEP)',
    'Quadro de Comando e DPS',
  ],
  area_comum: [
    'Registro técnico - Área Comum',
    'Área Comum',
    'Malha com tinta',
    'Malha e conector com tinta',
    '⚠ FALTA EQUIPOTENCIALIZAR',
    'Usina solar - falta equipotencializar',
    'Quadro de Bombas e Iluminação',
  ],
};

export const PhotoManager: React.FC<PhotoManagerProps> = ({
  torres,
  areaComum,
  selectedTowerId,
  onSelectTowerId,
  onUpdateTowerPhotos,
  onUpdateCommonAreaPhotos,
}) => {
  const isCommon = selectedTowerId === 'area_comum';
  const currentTower = torres.find((t) => t.id === selectedTowerId);

  const [activeCategory, setActiveCategory] = useState<PhotoCategory>(
    isCommon ? 'spda_captores' : 'ensaio_miliohmimetro'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Get active photo list
  const getActivePhotos = (): PhotoItem[] => {
    if (isCommon) {
      if (activeCategory === 'spda_captores') return areaComum.fotosSpda;
      return areaComum.fotosQuadros;
    }
    if (!currentTower) return [];
    if (activeCategory === 'ensaio_miliohmimetro') return currentTower.fotosEnsaio;
    if (activeCategory === 'spda_captores') return currentTower.fotosSpda;
    return currentTower.fotosQuadros;
  };

  const activePhotos = getActivePhotos();

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    const targetTowerName = isCommon
      ? 'Área Comum'
      : currentTower?.nome || 'Torre';

    const newPhotos: PhotoItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingProgress(`Otimizando foto ${i + 1} de ${files.length}...`);

      const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      try {
        // 1. Save original file in IndexedDB
        await saveOriginalPhoto(photoId, file, file.name);

        // 2. Create high-resolution print-ready preview for document
        const previewUrl = await createOptimizedPreview(file, 2000, 0.94);

        // Default caption
        let defaultCaption = targetTowerName;
        if (activeCategory === 'spda_captores') {
          defaultCaption = 'Captor tipo Franklin';
        }

        newPhotos.push({
          id: photoId,
          torreId: selectedTowerId,
          categoria: activeCategory,
          legenda: defaultCaption,
          destaqueAlerta: defaultCaption.includes('FALTA EQUIPOTENCIALIZAR'),
          previewUrl,
          storageKey: photoId,
          nomeArquivoOriginal: file.name,
          tamanhoBytes: file.size,
          tipoMime: file.type || 'image/jpeg',
          dataHora: Date.now(),
          ordem: activePhotos.length + i + 1,
        });
      } catch (err) {
        console.error('Erro ao processar imagem:', err);
      }
    }

    const updated = [...activePhotos, ...newPhotos];
    updatePhotosState(updated);
    setIsProcessing(false);
    setProcessingProgress('');
  };

  const updatePhotosState = (updatedList: PhotoItem[]) => {
    // Re-index order numbers
    const sequenced = updatedList.map((item, idx) => ({ ...item, ordem: idx + 1 }));

    if (isCommon) {
      if (activeCategory === 'spda_captores') {
        onUpdateCommonAreaPhotos('spda_captores', sequenced);
      } else {
        onUpdateCommonAreaPhotos('quadros_dps', sequenced);
      }
    } else if (currentTower) {
      onUpdateTowerPhotos(currentTower.id, activeCategory, sequenced);
    }
  };

  const handleUpdateItem = (id: string, partial: Partial<PhotoItem>) => {
    const updated = activePhotos.map((item) =>
      item.id === id ? { ...item, ...partial } : item
    );
    updatePhotosState(updated);
  };

  const handleDeleteItem = (id: string) => {
    const updated = activePhotos.filter((item) => item.id !== id);
    updatePhotosState(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activePhotos.length) return;

    const copy = [...activePhotos];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    updatePhotosState(copy);
  };

  return (
    <div className="space-y-6">
      {/* Tower Selector Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-red-600" />
              Gestão Fotográfica por Torre &amp; Seção
            </h2>
            <p className="text-xs text-slate-500">
              Fotografias armazenadas e vinculadas exclusivamente à torre selecionada (sem duplicidade).
            </p>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            Total nesta seção:{' '}
            <span className="font-bold text-slate-900">{activePhotos.length}</span> fotos
          </div>
        </div>

        {/* Tower Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 no-scrollbar">
          {torres.map((t) => {
            const count =
              t.fotosEnsaio.length + t.fotosSpda.length + t.fotosQuadros.length;
            const isSelected = selectedTowerId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTowerId(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{t.nome}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {areaComum.habilitada && (
            <button
              onClick={() => {
                onSelectTowerId('area_comum');
                if (activeCategory === 'ensaio_miliohmimetro') {
                  setActiveCategory('spda_captores');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                isCommon
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Área Comum</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isCommon ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {areaComum.fotosSpda.length + areaComum.fotosQuadros.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        {!isCommon && (
          <button
            onClick={() => setActiveCategory('ensaio_miliohmimetro')}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeCategory === 'ensaio_miliohmimetro'
                ? 'border-red-600 text-red-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Pontos de Continuidade ({currentTower?.fotosEnsaio.length || 0})
          </button>
        )}
        <button
          onClick={() => setActiveCategory('spda_captores')}
          className={`pb-2.5 border-b-2 transition-colors ${
            activeCategory === 'spda_captores'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          2. SPDA Existente, Captores &amp; Descidas (
          {isCommon ? areaComum.fotosSpda.length : currentTower?.fotosSpda.length || 0})
        </button>
        <button
          onClick={() => setActiveCategory('quadros_dps')}
          className={`pb-2.5 border-b-2 transition-colors ${
            activeCategory === 'quadros_dps'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          3. Quadros de Energia &amp; DPS (
          {isCommon ? areaComum.fotosQuadros.length : currentTower?.fotosQuadros.length || 0})
        </button>
      </div>

      {/* Upload Action Box */}
      <div className="bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {isProcessing ? (
          <div className="space-y-2 py-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-600 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-700">{processingProgress}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Tirar Foto com a Câmera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                Carregar Fotos em Massa
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Arraste e solte ou selecione imagens. Salvas em qualidade original no celular/computador e otimizadas para o laudo.
            </p>
          </div>
        )}
      </div>

      {/* Photo Grid Preview & Caption Editor */}
      {activePhotos.length === 0 ? (
        <div className="text-center py-12 border border-slate-200 rounded-xl bg-white text-slate-400">
          <ImageIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-medium">Nenhuma foto adicionada nesta seção ainda.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tire fotos no local com a câmera do celular ou importe da galeria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {activePhotos.map((photo, idx) => (
              <div
                key={photo.id}
                className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs flex flex-col space-y-2 group relative"
              >
                {/* Index badge */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span className="font-bold text-slate-700">#{idx + 1}</span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Mover para trás"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === activePhotos.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Mover para frente"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(photo.id)}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Photo Thumbnail */}
                <div className="relative aspect-square w-full rounded bg-slate-100 overflow-hidden border border-slate-200">
                  <img
                    src={photo.previewUrl}
                    alt={photo.legenda}
                    className="w-full h-full object-cover"
                  />
                  {photo.destaqueAlerta && (
                    <div className="absolute top-1 left-1 right-1 bg-amber-100/90 text-amber-900 border border-amber-300 rounded text-[9px] font-bold px-1 py-0.5 text-center">
                      ⚠ FALTA EQUIPOTENCIALIZAR
                    </div>
                  )}
                </div>

                {/* Caption Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">
                    Legenda Técnica
                  </label>
                  <input
                    type="text"
                    value={photo.legenda}
                    onChange={(e) => handleUpdateItem(photo.id, { legenda: e.target.value })}
                    className="w-full border border-slate-300 rounded p-1 text-[11px] focus:ring-1 focus:ring-red-500 font-medium"
                    placeholder="Ex: Captor tipo Franklin"
                  />
                </div>

                {/* Preset caption chips */}
                <div className="flex flex-wrap gap-1">
                  {PRESET_CAPTIONS[activeCategory].slice(0, 4).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        handleUpdateItem(photo.id, {
                          legenda: preset,
                          destaqueAlerta: preset.includes('FALTA EQUIPOTENCIALIZAR'),
                        })
                      }
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-full"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Alert toggle */}
                <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 cursor-pointer pt-1 border-t border-slate-100">
                  <input
                    type="checkbox"
                    checked={!!photo.destaqueAlerta}
                    onChange={(e) =>
                      handleUpdateItem(photo.id, { destaqueAlerta: e.target.checked })
                    }
                    className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Destaque Amarelo de Alerta</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

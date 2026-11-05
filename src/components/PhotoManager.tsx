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
  FolderArchive,
  Image as ImageIcon,
  Zap,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { saveOriginalPhoto, createOptimizedPreview } from '../services/storage';
import { detectMiliohmimetroReading } from '../services/miliohmimetroOcr';

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

// Preset defect lists per user specification
export const DEFECTS_BY_CATEGORY: Record<PhotoCategory, string[]> = {
  quadros_dps: [
    'FALTA DPS',
  ],
  spda_captores: [
    'FALTA EQUIPOTENCIALIZAR',
    'CONECTOR OXIDADO',
    'CONECTOR COM TINTA',
    'MALHA/FITA DE CAPTAÇÃO COM TINTA',
    'PARAFUSO OXIDADO',
    'MALHA/FITA ROMPIDA',
    'CAPTOR TIPO FRANKLIN COM DEFEITO',
    'TERMINAIS AÉREOS COM DEFEITO',
  ],
  ensaio_miliohmimetro: [
    'LIMPEZA PENDENTE',
    'ALTA RESISTÊNCIA (> 0,20 Ω)',
    'TERMINAL OXIDADO',
    'SEM CONTINUIDADE',
  ],
  area_comum: [
    'FALTA EQUIPOTENCIALIZAR',
    'CONECTOR OXIDADO',
    'CONECTOR COM TINTA',
    'MALHA/FITA DE CAPTAÇÃO COM TINTA',
    'FALTA DPS',
  ],
};

const PRESET_CAPTIONS: Record<PhotoCategory, string[]> = {
  ensaio_miliohmimetro: [
    'Ponto de Inspeção SPDA',
    'Caixa de Inspeção',
    'Barramento de Equipotencialização',
    'Eletrodo de Aterramento',
  ],
  spda_captores: [
    'Captor tipo Franklin',
    'Descida SPDA externa',
    'Fita de Captação no Topo',
    'Anel de Cintamento',
  ],
  quadros_dps: [
    'QGBT Principal',
    'Quadro de Bombas',
    'Quadro de Elevadores',
    'Barramento BEP',
  ],
  area_comum: [
    'Registro técnico - Área Comum',
    'SPDA Área Comum',
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
  const [readingOcrId, setReadingOcrId] = useState<string | null>(null);
  const [batchOcrProgress, setBatchOcrProgress] = useState<string | null>(null);

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
      const photoIndex = activePhotos.length + i + 1;
      setProcessingProgress(`Otimizando foto ${i + 1} de ${files.length}...`);

      const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      try {
        // 1. Save original file in IndexedDB
        await saveOriginalPhoto(photoId, file, file.name);

        // 2. Create high-resolution print-ready preview for document
        const previewUrl = await createOptimizedPreview(file, 2000, 0.94);

        // 3. Default Caption & Defect
        let defaultCaption = `${targetTowerName} - Foto #${photoIndex}`;
        let detectedReading: string | undefined = undefined;

        if (activeCategory === 'ensaio_miliohmimetro') {
          defaultCaption = `Ponto #${photoIndex}`;
          // Automated OCR display reading for milliohmmeter photos
          try {
            setProcessingProgress(`Identificando leitura no visor do miliohmímetro ${i + 1}/${files.length} via IA...`);
            const ocr = await detectMiliohmimetroReading(previewUrl, file.type || 'image/jpeg');
            if (ocr.success && ocr.leitura && ocr.leitura.trim() !== '') {
              const unit = ocr.unidade || 'mΩ';
              detectedReading = `${ocr.leitura} ${unit}`.trim();
              defaultCaption = `Ponto #${photoIndex} - ${detectedReading}`;
            }
          } catch (ocrErr) {
            console.warn('OCR em background não concluído para a foto:', ocrErr);
          }
        } else if (activeCategory === 'spda_captores') {
          defaultCaption = 'Captor tipo Franklin';
        } else if (activeCategory === 'quadros_dps') {
          defaultCaption = 'Quadro de Distribuição (QGBT)';
        }

        newPhotos.push({
          id: photoId,
          torreId: selectedTowerId,
          categoria: activeCategory,
          legenda: defaultCaption,
          destaqueAlerta: false,
          tipoDefeito: undefined,
          leituraMiliohmimetro: detectedReading,
          previewUrl,
          storageKey: photoId,
          nomeArquivoOriginal: file.name,
          tamanhoBytes: file.size,
          tipoMime: file.type || 'image/jpeg',
          dataHora: Date.now(),
          ordem: photoIndex,
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

  // Set or toggle a specific defect for a photo
  const handleSelectDefect = (photo: PhotoItem, defect: string | undefined) => {
    if (!defect || defect === '' || photo.tipoDefeito === defect) {
      // Clear defect
      handleUpdateItem(photo.id, {
        destaqueAlerta: false,
        tipoDefeito: undefined,
      });
    } else {
      // Set defect and enable highlight
      handleUpdateItem(photo.id, {
        destaqueAlerta: true,
        tipoDefeito: defect,
      });
    }
  };

  // Perform single photo milliohmmeter OCR
  const handleRunOcrSingle = async (photo: PhotoItem, photoIndex: number) => {
    setReadingOcrId(photo.id);
    try {
      const res = await detectMiliohmimetroReading(photo.previewUrl, photo.tipoMime);
      if (res.success && res.leitura && res.leitura.trim() !== '') {
        const unit = res.unidade || 'mΩ';
        const formatted = `${res.leitura} ${unit}`.trim();
        const baseCaption = `Ponto #${photoIndex}`;
        const newCaption = `${baseCaption} - ${formatted}`;
        handleUpdateItem(photo.id, {
          leituraMiliohmimetro: formatted,
          legenda: newCaption,
        });
      } else {
        alert(
          res.error ||
            'Não foi possível identificar o visor do equipamento na imagem. Você pode inserir a medição manualmente no campo abaixo.'
        );
      }
    } catch (err: any) {
      alert(`Falha ao ler visor: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setReadingOcrId(null);
    }
  };

  // Perform batch OCR for all milliohmmeter photos
  const handleRunOcrBatch = async () => {
    if (activePhotos.length === 0) return;
    setBatchOcrProgress('Iniciando leitura em massa dos visores...');
    let successCount = 0;

    const updatedList = [...activePhotos];
    for (let i = 0; i < updatedList.length; i++) {
      const photo = updatedList[i];
      setBatchOcrProgress(`Lendo visor ${i + 1} de ${updatedList.length}...`);
      try {
        const res = await detectMiliohmimetroReading(photo.previewUrl, photo.tipoMime);
        if (res.success && res.leitura && res.leitura.trim() !== '') {
          const unit = res.unidade || 'mΩ';
          const formatted = `${res.leitura} ${unit}`.trim();
          updatedList[i] = {
            ...photo,
            leituraMiliohmimetro: formatted,
            legenda: `Ponto #${i + 1} - ${formatted}`,
          };
          successCount++;
        }
      } catch (err) {
        console.warn(`Erro no OCR da foto ${photo.id}:`, err);
      }
    }

    updatePhotosState(updatedList);
    setBatchOcrProgress(null);
    alert(
      `Processamento concluído: ${successCount} de ${updatedList.length} visores identificados e inseridos nas legendas.`
    );
  };

  // Batch apply defect to all photos in active category
  const handleBatchApplyDefect = (defect: string | undefined) => {
    if (!defect) {
      const cleared = activePhotos.map((p) => ({
        ...p,
        destaqueAlerta: false,
        tipoDefeito: undefined,
      }));
      updatePhotosState(cleared);
      return;
    }

    const updated = activePhotos.map((p) => ({
      ...p,
      destaqueAlerta: true,
      tipoDefeito: defect,
    }));
    updatePhotosState(updated);
  };

  const currentDefectList = DEFECTS_BY_CATEGORY[activeCategory] || [];
  const alertCount = activePhotos.filter((p) => p.destaqueAlerta || p.tipoDefeito).length;

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
            {alertCount > 0 && (
              <span className="ml-2 text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                ⚠ {alertCount} com defeito destacado
              </span>
            )}
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
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeCategory === 'ensaio_miliohmimetro'
                ? 'border-red-600 text-red-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>1. Pontos de Inspeção / Miliohmímetro ({currentTower?.fotosEnsaio.length || 0})</span>
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
      <div className="bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:bg-slate-50 transition-colors">
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
            <div className="flex flex-wrap justify-center gap-3">
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
              {activeCategory === 'ensaio_miliohmimetro'
                ? '⚡ Ao carregar fotos de ensaio, o sistema identifica automaticamente o valor numérico do visor do miliohmímetro e preenche a legenda.'
                : 'Arraste e solte ou selecione imagens. Salvas em qualidade original e otimizadas para o laudo pericial.'}
            </p>
          </div>
        )}
      </div>

      {/* Batch Operations Toolbar for defects and OCR */}
      {activePhotos.length > 0 && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Ações Rápidas:</span>
            {activeCategory === 'ensaio_miliohmimetro' && (
              <button
                type="button"
                disabled={!!batchOcrProgress}
                onClick={handleRunOcrBatch}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-bold text-[11px] shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Lê os visores digitais de todas as fotos desta seção e insere as medições nas legendas"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {batchOcrProgress ? batchOcrProgress : 'Ler Todos os Visores com IA'}
                </span>
              </button>
            )}

            {activeCategory === 'quadros_dps' && (
              <button
                type="button"
                onClick={() => handleBatchApplyDefect('FALTA DPS')}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-md font-bold text-[11px] transition-colors"
              >
                ⚠ Marcar &quot;FALTA DPS&quot; em Todas
              </button>
            )}

            {activeCategory === 'spda_captores' && (
              <button
                type="button"
                onClick={() => handleBatchApplyDefect('FALTA EQUIPOTENCIALIZAR')}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-md font-bold text-[11px] transition-colors"
              >
                ⚠ Marcar &quot;FALTA EQUIPOTENCIALIZAR&quot; em Todas
              </button>
            )}
          </div>

          {alertCount > 0 && (
            <button
              type="button"
              onClick={() => handleBatchApplyDefect(undefined)}
              className="text-slate-600 hover:text-red-600 text-[11px] font-medium underline"
            >
              Limpar todos os destaques em amarelo desta seção
            </button>
          )}
        </div>
      )}

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
            {activePhotos.map((photo, idx) => {
              const hasDefect = !!photo.destaqueAlerta || !!photo.tipoDefeito;
              const isReadingThis = readingOcrId === photo.id;

              return (
                <div
                  key={photo.id}
                  className={`bg-white border rounded-lg p-2.5 shadow-2xs flex flex-col space-y-2 group relative transition-all ${
                    hasDefect
                      ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-50/15'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Index badge & controls */}
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

                    {/* Prominent Yellow Highlight Badge when Defect is Active */}
                    {hasDefect && (
                      <div className="absolute top-1 left-1 right-1 bg-[#fef3c7] text-[#92400e] border border-[#fde68a] rounded text-[8.5px] font-extrabold px-1.5 py-0.5 text-center shadow-xs truncate">
                        ⚠ {photo.tipoDefeito || 'FALTA EQUIPOTENCIALIZAR'}
                      </div>
                    )}

                    {/* Detected meter value badge */}
                    {photo.leituraMiliohmimetro && (
                      <div className="absolute bottom-1 left-1 right-1 bg-slate-900/90 text-white rounded text-[8.5px] font-mono font-bold px-1 py-0.5 text-center truncate flex items-center justify-center gap-1">
                        <Gauge className="w-3 h-3 text-emerald-400" />
                        <span>Visor: {photo.leituraMiliohmimetro}</span>
                      </div>
                    )}
                  </div>

                  {/* Meter Reading Input & AI Read Button for Ensaio */}
                  {activeCategory === 'ensaio_miliohmimetro' && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-slate-500" />
                          Leitura do Visor:
                        </span>
                        <button
                          type="button"
                          disabled={isReadingThis}
                          onClick={() => handleRunOcrSingle(photo, idx + 1)}
                          className="text-[9px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5 bg-amber-100/80 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                          title="Lê o valor numérico do visor digital com IA"
                        >
                          {isReadingThis ? (
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-2.5 h-2.5" />
                          )}
                          <span>{isReadingThis ? 'Lendo...' : 'Ler Visor'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={photo.leituraMiliohmimetro || ''}
                          placeholder="Ex: 23.5 mΩ"
                          onChange={(e) => {
                            const val = e.target.value;
                            const newCaption = val
                              ? `Ponto #${idx + 1} - ${val}`
                              : `Ponto #${idx + 1}`;
                            handleUpdateItem(photo.id, {
                              leituraMiliohmimetro: val,
                              legenda: newCaption,
                            });
                          }}
                          className="flex-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px] font-mono font-semibold text-slate-900 focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Caption Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">
                      Legenda no Laudo
                    </label>
                    <input
                      type="text"
                      value={photo.legenda}
                      onChange={(e) => handleUpdateItem(photo.id, { legenda: e.target.value })}
                      className="w-full border border-slate-300 rounded p-1 text-[11px] focus:ring-1 focus:ring-red-500 font-medium text-slate-900"
                      placeholder="Ex: Captor tipo Franklin"
                    />
                  </div>

                  {/* Preset caption chips (contextual) */}
                  <div className="flex flex-wrap gap-1">
                    {PRESET_CAPTIONS[activeCategory]?.slice(0, 3).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          handleUpdateItem(photo.id, {
                            legenda: preset,
                          })
                        }
                        className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-full"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Defect Picker (Highlight Selector) */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Destaque de Defeito:</span>
                      </label>
                      {hasDefect && (
                        <button
                          type="button"
                          onClick={() => handleSelectDefect(photo, undefined)}
                          className="text-[9px] text-red-600 hover:underline font-semibold"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    {/* Defect Selection Dropdown */}
                    <select
                      value={photo.tipoDefeito || ''}
                      onChange={(e) => handleSelectDefect(photo, e.target.value)}
                      className={`w-full text-[10px] rounded p-1 border font-medium ${
                        hasDefect
                          ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <option value="">(Normal / Sem Defeito)</option>
                      {currentDefectList.map((defect) => (
                        <option key={defect} value={defect}>
                          ⚠ {defect}
                        </option>
                      ))}
                    </select>

                    {/* Quick Defect Buttons */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {currentDefectList.map((defect) => {
                        const isSelected = photo.tipoDefeito === defect;
                        return (
                          <button
                            key={defect}
                            type="button"
                            onClick={() => handleSelectDefect(photo, defect)}
                            className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold transition-all text-left truncate max-w-full ${
                              isSelected
                                ? 'bg-amber-300 text-amber-950 border border-amber-500 shadow-2xs'
                                : 'bg-slate-100 hover:bg-amber-100/70 text-slate-700 border border-slate-200'
                            }`}
                            title={`Selecionar: ${defect}`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {defect}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

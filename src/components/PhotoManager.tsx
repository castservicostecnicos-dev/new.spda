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
  Eye,
  Download,
  Smartphone,
  Share2,
} from 'lucide-react';
import {
  saveOriginalPhoto,
  createPrintQualityImage,
  formatFileSize,
} from '../services/storage';
import {
  saveOriginalFileToPhoneImmediately,
  saveSingleOriginalToDevice,
  shareOriginalsToPhoneGallery,
  canShareOriginalFilesToPhone,
} from '../services/photoExporter';
import { MeterZoomModal } from './MeterZoomModal';

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
  onSaveAllOriginals?: () => void;
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
  onSaveAllOriginals,
}) => {
  const isCommon = selectedTowerId === 'area_comum';
  const currentTower = torres.find((t) => t.id === selectedTowerId);

  const [activeCategory, setActiveCategory] = useState<PhotoCategory>(
    isCommon ? 'spda_captores' : 'ensaio_miliohmimetro'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState('');
  const [inspectingPhotoIndex, setInspectingPhotoIndex] = useState<number | null>(null);
  const [autoSaveCameraToPhone, setAutoSaveCameraToPhone] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('spda_auto_save_camera_originals');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [phoneActionNotice, setPhoneActionNotice] = useState<string | null>(null);
  const [isSharingSection, setIsSharingSection] = useState(false);

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

  const toggleAutoSaveCamera = (checked: boolean) => {
    setAutoSaveCameraToPhone(checked);
    try {
      localStorage.setItem('spda_auto_save_camera_originals', String(checked));
    } catch {
      // ignore storage quota
    }
  };

  const handleFilesSelected = async (
    selectedFiles: File[],
    isFromCamera = false
  ) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setIsProcessing(true);

    const targetTowerName = isCommon
      ? 'Área Comum'
      : currentTower?.nome || 'Torre';

    const newPhotos: PhotoItem[] = [];
    let savedToPhoneCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const photoIndex = activePhotos.length + i + 1;
      setProcessingProgress(
        `Gerando qualidade de impressão e salvando original (${i + 1}/${selectedFiles.length})...`
      );

      const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      try {
        // QUALIDADE 2 (Arquivos / Celular): Salva arquivo original intacto no banco local
        await saveOriginalPhoto(photoId, file, file.name);

        // Se foi fotografada agora com a câmera e a opção está ativa, salva cópia original nos Downloads/Arquivos do celular
        let salvaNoCelular = false;
        if (isFromCamera && autoSaveCameraToPhone) {
          saveOriginalFileToPhoneImmediately(
            file,
            targetTowerName,
            activeCategory,
            photoIndex
          );
          salvaNoCelular = true;
          savedToPhoneCount++;
        }

        // QUALIDADE 1 (Impressão para o Laudo): Reduz dimensões para grade 3:4 do laudo (~900px, 300+ DPI)
        const printResult = await createPrintQualityImage(file, 900, 0.9);

        // Legenda padrão
        let defaultCaption = `${targetTowerName} - Foto #${photoIndex}`;
        if (activeCategory === 'ensaio_miliohmimetro') {
          defaultCaption = `Ponto #${photoIndex}`;
        } else if (
          activeCategory === 'spda_captores' ||
          activeCategory === 'quadros_dps' ||
          activeCategory === 'area_comum'
        ) {
          defaultCaption = '';
        }

        newPhotos.push({
          id: photoId,
          torreId: selectedTowerId,
          categoria: activeCategory,
          legenda: defaultCaption,
          destaqueAlerta: false,
          tipoDefeito: undefined,
          previewUrl: printResult.dataUrl,
          storageKey: photoId,
          nomeArquivoOriginal: file.name,
          tamanhoBytes: file.size,
          tamanhoImpressaoBytes: printResult.sizeBytes,
          dimensaoImpressao: `${printResult.width}x${printResult.height}`,
          salvaNoCelular,
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

    if (savedToPhoneCount > 0) {
      setPhoneActionNotice(
        `${savedToPhoneCount} foto(s) original(is) salva(s) na pasta Downloads/Arquivos do celular e reduzida(s) com qualidade de impressão no laudo.`
      );
      setTimeout(() => setPhoneActionNotice(null), 5000);
    }
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
      <div className="bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:bg-slate-50 transition-colors space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = '';
            handleFilesSelected(selectedFiles, false);
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = '';
            handleFilesSelected(selectedFiles, true);
          }}
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

            {/* Dual-quality & Phone Save Controls */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-left max-w-3xl mx-auto space-y-2.5 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-start gap-2 bg-emerald-50/70 border border-emerald-200/80 rounded-md p-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950 block">1. No Laudo (Impressão):</span>
                    <span className="text-emerald-800">
                      Reduzida para caber no laudo mantendo nitidez de impressão (300+ DPI).
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-sky-50/70 border border-sky-200/80 rounded-md p-2">
                  <Smartphone className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sky-950 block">2. Nos Arquivos / Celular:</span>
                    <span className="text-sky-800">
                      Foto original intacta salva no aparelho e organizada para backup.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSaveCameraToPhone}
                    onChange={(e) => toggleAutoSaveCamera(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span>Salvar foto original no celular automaticamente ao tirar foto pela câmera</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {activePhotos.length > 0 && canShareOriginalFilesToPhone() && (
                    <button
                      type="button"
                      disabled={isSharingSection}
                      onClick={async () => {
                        setIsSharingSection(true);
                        try {
                          const targetName = isCommon
                            ? 'Area_Comum'
                            : currentTower?.nome || 'Torre';
                          const status = await shareOriginalsToPhoneGallery(
                            activePhotos.map((photo) => ({ photo, towerName: targetName })),
                            `Fotos Originais - ${targetName}`
                          );
                          if (status === 'shared') {
                            setPhoneActionNotice(
                              `${activePhotos.length} foto(s) original(is) enviada(s) para Salvar na Galeria / Arquivos do celular.`
                            );
                            setTimeout(() => setPhoneActionNotice(null), 4500);
                          } else if (status === 'unsupported') {
                            setPhoneActionNotice(
                              'Compartilhamento direto indisponível neste navegador. Use "Salvar Todas as Originais".'
                            );
                            setTimeout(() => setPhoneActionNotice(null), 4000);
                          }
                        } finally {
                          setIsSharingSection(false);
                        }
                      }}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>
                        {isSharingSection ? 'Preparando...' : 'Salvar Seção na Galeria/Arquivos'}
                      </span>
                    </button>
                  )}
                  {onSaveAllOriginals && (
                    <button
                      type="button"
                      onClick={onSaveAllOriginals}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Salvar Todas as Originais</span>
                    </button>
                  )}
                </div>
              </div>

              {phoneActionNotice && (
                <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
                  ✓ {phoneActionNotice}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Batch Operations Toolbar for defects */}
      {activePhotos.length > 0 && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Ações Rápidas:</span>

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
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-700">#{idx + 1}</span>
                      {photo.salvaNoCelular && (
                        <span
                          className="text-[9px] font-sans font-bold bg-sky-100 text-sky-800 px-1 py-0.2 rounded"
                          title="Cópia original salva no aparelho"
                        >
                          ✓ Celular
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-85 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={async () => {
                          const targetName = isCommon
                            ? 'Area_Comum'
                            : currentTower?.nome || 'Torre';
                          await saveSingleOriginalToDevice(photo, targetName);
                          handleUpdateItem(photo.id, { salvaNoCelular: true });
                        }}
                        className="p-1 hover:bg-sky-50 text-sky-600 hover:text-sky-700 rounded"
                        title="Salvar foto original nos arquivos do celular"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
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

                  {/* Photo Thumbnail - 3:4 rectangular ratio with click-to-zoom */}
                  <div
                    onClick={() => setInspectingPhotoIndex(idx)}
                    className="relative aspect-[3/4] w-full rounded bg-slate-100 overflow-hidden border border-slate-200 cursor-pointer group/thumb shadow-xs"
                    title="Clique para ampliar e ler o visor com nitidez"
                  >
                    <img
                      src={photo.previewUrl}
                      alt={photo.legenda}
                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                    />

                    {/* Magnifier overlay on hover */}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white font-bold text-[11px] backdrop-blur-[1px]">
                      <Eye className="w-5 h-5 text-emerald-300 drop-shadow" />
                      <span>Ampliar Visor</span>
                    </div>

                    {/* Prominent Yellow Highlight Badge when Defect is Active */}
                    {hasDefect && (
                      <div className="absolute top-1 left-1 right-1 bg-[#fef3c7] text-[#92400e] border border-[#fde68a] rounded text-[8.5px] font-extrabold px-1.5 py-0.5 text-center shadow-xs truncate z-10">
                        ⚠ {photo.tipoDefeito || 'FALTA EQUIPOTENCIALIZAR'}
                      </div>
                    )}
                  </div>

                  {/* Dual quality compact readout */}
                  {(photo.tamanhoImpressaoBytes || photo.tamanhoBytes > 0) && (
                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      <span title="Tamanho otimizado para impressão no laudo">
                        Laudo: {photo.tamanhoImpressaoBytes ? formatFileSize(photo.tamanhoImpressaoBytes) : 'Impr.'}
                      </span>
                      <span title="Tamanho do arquivo original preservado">
                        Orig: {photo.tamanhoBytes ? formatFileSize(photo.tamanhoBytes) : '—'}
                      </span>
                    </div>
                  )}

                  {/* Button to Inspect & Zoom on Photo */}
                  <button
                    type="button"
                    onClick={() => setInspectingPhotoIndex(idx)}
                    className="w-full py-1.5 px-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 rounded text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 shadow-2xs"
                    title="Abre visualização ampliada da foto com zoom"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ampliar Foto</span>
                  </button>

                  {/* For Ensaio: Caption for the point. For SPDA & Quadros: captions eliminated, only yellow alert */}
                  {activeCategory === 'ensaio_miliohmimetro' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 block">
                          Legenda do Ponto no Laudo
                        </label>
                        <input
                          type="text"
                          value={photo.legenda}
                          onChange={(e) => handleUpdateItem(photo.id, { legenda: e.target.value })}
                          className="w-full border border-slate-300 rounded p-1 text-[11px] focus:ring-1 focus:ring-red-500 font-medium text-slate-900"
                          placeholder={`Ex: Ponto #${idx + 1}`}
                        />
                      </div>

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
                    </>
                  ) : (
                    <div className="text-[9.5px] text-slate-500 italic bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      Legenda eliminada nesta seção — apenas o alerta em amarelo será exibido se houver defeito.
                    </div>
                  )}

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

      {/* Interactive Meter Display Inspection & Zoom Magnifier Modal */}
      {inspectingPhotoIndex !== null && (
        <MeterZoomModal
          isOpen={inspectingPhotoIndex !== null}
          onClose={() => setInspectingPhotoIndex(null)}
          photo={activePhotos[inspectingPhotoIndex] || null}
          photoIndex={inspectingPhotoIndex + 1}
          totalPhotos={activePhotos.length}
          towerName={isCommon ? 'Área Comum' : currentTower?.nome || 'Torre'}
          onUpdatePhoto={handleUpdateItem}
          onNavigate={(newIdx) => {
            if (newIdx >= 0 && newIdx < activePhotos.length) {
              setInspectingPhotoIndex(newIdx);
            }
          }}
        />
      )}
    </div>
  );
};

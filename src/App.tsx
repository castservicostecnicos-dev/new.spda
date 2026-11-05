/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SpdaReport,
  Tower,
  PhotoCategory,
  PhotoItem,
  CompanyProfile,
  FixedTextsTemplate,
} from './types/spda';
import {
  createInitialReport,
  DEFAULT_FIXED_TEXTS,
  DEFAULT_COMPANY,
} from './data/defaultReport';
import {
  generateSamplePhotosForTower,
  generateSampleCommonAreaPhotos,
  getBuildingSampleImages,
} from './data/samplePhotos';
import {
  saveReportToDb,
  loadReportFromDb,
  getAllReportsFromDb,
  checkReportNameExists,
} from './services/storage';
import {
  exportOriginalPhotosZip,
  trySaveToDeviceDirectory,
  exportReportJson,
} from './services/photoExporter';
import { exportReportToDocx } from './services/docxExporter';
import { PdfDocumentView } from './components/PdfDocumentView';
import { PhotoManager } from './components/PhotoManager';
import { SignatureModal } from './components/SignatureModal';
import { PreFlightCheckModal } from './components/PreFlightCheckModal';
import { AdminTemplateModal } from './components/AdminTemplateModal';
import { CreateReportModal } from './components/CreateReportModal';
import { ReportsManagerModal } from './components/ReportsManagerModal';
import { CloudflareR2Modal } from './components/CloudflareR2Modal';
import { calculateTotalPages } from './utils/documentPaginator';
import {
  FileText,
  Building,
  Layers,
  Camera,
  Activity,
  Award,
  Eye,
  Settings,
  Download,
  Printer,
  Plus,
  Trash2,
  CheckCircle,
  FolderDown,
  RotateCcw,
  UploadCloud,
  FileCheck,
  Save,
  FolderArchive,
  Building2,
  Cloud,
} from 'lucide-react';

export default function App() {
  const [report, setReport] = useState<SpdaReport>(() => {
    const init = createInitialReport();
    // Pre-populate with realistic sample photos matching the reference PDF
    const { fotoAereaUrl, fotoFachadaUrl } = getBuildingSampleImages();
    init.edificacao.fotoAereaUrl = fotoAereaUrl;
    init.edificacao.fotoFachadaUrl = fotoFachadaUrl;

    init.torres = init.torres.map((t) => {
      const { fotosEnsaio, fotosSpda, fotosQuadros } = generateSamplePhotosForTower(
        t.id,
        t.nome
      );
      return { ...t, fotosEnsaio, fotosSpda, fotosQuadros };
    });

    const commonPhotos = generateSampleCommonAreaPhotos();
    init.areaComum.fotosSpda = commonPhotos.fotosSpda;
    init.areaComum.fotosQuadros = commonPhotos.fotosQuadros;

    return init;
  });

  const [activeTab, setActiveTab] = useState<
    'painel' | 'cliente' | 'torres' | 'fotos' | 'medicoes' | 'conclusao' | 'preview'
  >('painel');

  const [selectedTowerId, setSelectedTowerId] = useState<string>('t-1');
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isAdminTemplateOpen, setIsAdminTemplateOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReportsManagerOpen, setIsReportsManagerOpen] = useState(false);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);
  const [savedReportsCount, setSavedReportsCount] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string>('Salvo localmente');

  const refreshReportsCount = async () => {
    try {
      const all = await getAllReportsFromDb();
      setSavedReportsCount(all.length);
      return all;
    } catch (err) {
      console.warn('Could not count reports:', err);
      return [];
    }
  };

  // Load saved draft or last active report on mount
  useEffect(() => {
    const initLoad = async () => {
      try {
        const all = await getAllReportsFromDb();
        setSavedReportsCount(all.length);
        const lastId = localStorage.getItem('spda_last_report_id');
        let target = all.find((r) => r.id === lastId);
        if (!target && all.length > 0) {
          target = all[0];
        }

        if (target) {
          setReport(target);
          if (target.torres.length > 0) {
            setSelectedTowerId(target.torres[0].id);
          }
        } else {
          // Save default initial report to local DB so it is preserved
          await saveReportToDb(report);
          localStorage.setItem('spda_last_report_id', report.id);
          setSavedReportsCount(1);
        }
      } catch (err) {
        console.warn('Could not load from DB:', err);
      }
    };
    initLoad();
  }, []);

  // Auto-save debounced whenever edits happen
  useEffect(() => {
    const timer = setTimeout(() => {
      saveReportToDb(report)
        .then(() => {
          setSavedStatus(`Salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
        })
        .catch(() => setSavedStatus('Falha ao salvar'));
    }, 1200);
    return () => clearTimeout(timer);
  }, [report]);

  // Manual save button handler (with uniqueness check on condominium name)
  const handleManualSave = async () => {
    const nomeCond = (report.cliente.nomeEmpreendimento || report.cliente.cliente || '').trim();
    if (!nomeCond) {
      alert('Por favor, informe o nome do condomínio antes de salvar.');
      return;
    }

    setIsSaving(true);
    try {
      // Validate that no OTHER report has this exact same condominium name
      const isDuplicate = await checkReportNameExists(nomeCond, report.id);
      if (isDuplicate) {
        alert(
          `Atenção: Já existe outro laudo cadastrado com o condomínio "${nomeCond}". Não é permitido duplicidade de nomes. Altere o nome nas configurações do cliente para garantir exclusividade.`
        );
        setIsSaving(false);
        return;
      }

      const updatedReport: SpdaReport = {
        ...report,
        atualizadoEm: Date.now(),
      };

      await saveReportToDb(updatedReport);
      setReport(updatedReport);
      localStorage.setItem('spda_last_report_id', updatedReport.id);
      const timeStr = new Date().toLocaleTimeString('pt-BR');
      setSavedStatus(`Salvo às ${timeStr}`);
      setExportMessage(`Laudo "${nomeCond}" atualizado e salvo com sucesso!`);
      await refreshReportsCount();
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('Falha ao salvar laudo:', err);
      setExportMessage('Erro ao salvar o laudo.');
      setTimeout(() => setExportMessage(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReportCreated = (newReport: SpdaReport) => {
    setReport(newReport);
    if (newReport.torres.length > 0) {
      setSelectedTowerId(newReport.torres[0].id);
    }
    localStorage.setItem('spda_last_report_id', newReport.id);
    refreshReportsCount();
    setExportMessage(`Novo laudo do condomínio "${newReport.cliente.nomeEmpreendimento}" iniciado com sucesso!`);
    setActiveTab('cliente');
    setTimeout(() => setExportMessage(null), 4000);
  };

  const handleSelectReport = (selected: SpdaReport) => {
    setReport(selected);
    if (selected.torres && selected.torres.length > 0) {
      setSelectedTowerId(selected.torres[0].id);
    }
    localStorage.setItem('spda_last_report_id', selected.id);
    refreshReportsCount();
    setExportMessage(`Laudo "${selected.cliente.nomeEmpreendimento || selected.cliente.cliente}" carregado para edição.`);
    setTimeout(() => setExportMessage(null), 3000);
  };

  // Total pages
  const { totalPages } = calculateTotalPages(report);

  // Tower Management Handlers
  const handleAddTower = () => {
    const nextNumber = report.torres.length + 1;
    const newTowerId = `t-${Date.now()}`;
    const newTower: Tower = {
      id: newTowerId,
      nome: `Torre ${nextNumber}`,
      numeroOrdem: nextNumber,
      fotosEnsaio: [],
      fotosSpda: [],
      fotosQuadros: [],
    };
    const updatedTorres = [...report.torres, newTower];
    setReport({
      ...report,
      cliente: { ...report.cliente, quantidadeTorres: updatedTorres.length },
      torres: updatedTorres,
    });
    setSelectedTowerId(newTowerId);
  };

  const handleRemoveTower = (towerId: string) => {
    if (report.torres.length <= 1) {
      alert('O laudo precisa ter pelo menos 1 torre cadastrada.');
      return;
    }
    if (!confirm('Deseja excluir esta torre e todas as fotografias vinculadas a ela?')) {
      return;
    }
    const updated = report.torres
      .filter((t) => t.id !== towerId)
      .map((t, idx) => ({ ...t, numeroOrdem: idx + 1 }));

    setReport({
      ...report,
      cliente: { ...report.cliente, quantidadeTorres: updated.length },
      torres: updated,
    });
    setSelectedTowerId(updated[0].id);
  };

  const handleUpdateTowerName = (towerId: string, novoNome: string) => {
    const updated = report.torres.map((t) =>
      t.id === towerId ? { ...t, nome: novoNome } : t
    );
    setReport({ ...report, torres: updated });
  };

  // Photo Update Handlers
  const handleUpdateTowerPhotos = (
    towerId: string,
    category: PhotoCategory,
    photos: PhotoItem[]
  ) => {
    const updated = report.torres.map((t) => {
      if (t.id !== towerId) return t;
      if (category === 'ensaio_miliohmimetro') return { ...t, fotosEnsaio: photos };
      if (category === 'spda_captores') return { ...t, fotosSpda: photos };
      return { ...t, fotosQuadros: photos };
    });
    setReport({ ...report, torres: updated });
  };

  const handleUpdateCommonAreaPhotos = (
    category: 'spda_captores' | 'quadros_dps',
    photos: PhotoItem[]
  ) => {
    setReport({
      ...report,
      areaComum: {
        ...report.areaComum,
        ...(category === 'spda_captores'
          ? { fotosSpda: photos }
          : { fotosQuadros: photos }),
      },
    });
  };

  // Export to Device / Phone Folder
  const handleSaveToDevice = async () => {
    setExportMessage('Iniciando exportação das fotos originais...');
    const supportedDirect = await trySaveToDeviceDirectory(report, (c, t, msg) => {
      setExportMessage(msg);
    });

    if (supportedDirect) {
      setExportMessage('Fotos originais salvas com sucesso na pasta escolhida!');
      setTimeout(() => setExportMessage(null), 4000);
      return;
    }

    // Fallback: structured ZIP download
    try {
      await exportOriginalPhotosZip(report, (c, t, msg) => {
        setExportMessage(msg);
      });
      setExportMessage('Arquivo ZIP com fotos originais baixado com sucesso!');
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setExportMessage('Erro ao exportar arquivo ZIP.');
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  // Word (.docx) Export Trigger
  const handleExportDocx = async () => {
    try {
      setExportMessage('Carregando imagens de alta resolução e gerando arquivo Word (.docx)...');
      await exportReportToDocx(report, (msg) => {
        setExportMessage(msg);
      });
      setExportMessage('Laudo Técnico exportado em Word (.docx) com sucesso!');
      setTimeout(() => setExportMessage(null), 4500);
    } catch (err) {
      console.error('Erro ao gerar documento Word:', err);
      setExportMessage('Erro ao gerar arquivo Word (.docx). Verifique as imagens.');
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  // Print / PDF Trigger
  const handleProceedToPrint = () => {
    setActiveTab('preview');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Count total photos
  let totalPhotos = 0;
  report.torres.forEach((t) => {
    totalPhotos += t.fotosEnsaio.length + t.fotosSpda.length + t.fotosQuadros.length;
  });
  if (report.areaComum.habilitada) {
    totalPhotos += report.areaComum.fotosSpda.length + report.areaComum.fotosQuadros.length;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* ========================================================
          APP TOP BAR (Clean Three-Zone Header)
      ======================================================== */}
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Zone 1: Wordmark & Report Selector */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-bold text-sm tracking-wider text-white shadow-xs">
            SPDA
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>SJC SPDA</span>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1 py-0.5 rounded">
                NBR 5419:2026
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Gerador de Laudos Técnicos Periciais
            </p>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block mx-0.5" />

          {/* Quick Active Report Badge / Selector */}
          <button
            type="button"
            onClick={() => setIsReportsManagerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700/80 transition-colors shadow-2xs"
            title="Abrir gerenciador de laudos salvos"
          >
            <FolderArchive className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="max-w-[100px] sm:max-w-[160px] truncate text-white">
              {report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Sem nome'}
            </span>
            <span className="text-[9.5px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
              {savedReportsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            title="Iniciar um novo laudo pericial"
          >
            <Plus className="w-3.5 h-3.5 text-red-400" />
            <span>Novo Laudo</span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('painel')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'painel' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            Painel Geral
          </button>
          <button
            onClick={() => setActiveTab('cliente')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'cliente' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            1. Cliente &amp; Edificação
          </button>
          <button
            onClick={() => setActiveTab('torres')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'torres' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            2. Torres ({report.torres.length})
          </button>
          <button
            onClick={() => setActiveTab('fotos')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'fotos' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            3. Fotos por Torre ({totalPhotos})
          </button>
          <button
            onClick={() => setActiveTab('medicoes')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'medicoes' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            4. Medições &amp; DPS
          </button>
          <button
            onClick={() => setActiveTab('conclusao')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'conclusao' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            5. Parecer &amp; Assinatura
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'preview' ? 'bg-red-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            6. Visualizar Laudo ({totalPages}p)
          </button>
        </nav>

        {/* Zone 3: Primary Action & Quick Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAdminTemplateOpen(true)}
            className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Gerenciar modelo padrão do laudo"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSaving}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            title="Salvar e atualizar todas as alterações feitas neste laudo"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{isSaving ? 'Salvando...' : 'Salvar Laudo'}</span>
            <span className="sm:hidden">{isSaving ? '...' : 'Salvar'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToDevice}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            title="Salva as fotos originais em uma pasta no celular ou computador"
          >
            <FolderDown className="w-4 h-4 text-emerald-400" />
            <span>Fotos</span>
          </button>

          <button
            type="button"
            onClick={handleExportDocx}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            title="Exportar laudo pericial em formato Microsoft Word (.docx)"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Word (.docx)</span>
            <span className="sm:hidden">Word</span>
          </button>

          <button
            type="button"
            onClick={() => setIsR2ModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            title="Sincronizar laudo (.docx) e fotos originais no bucket do Cloudflare R2"
          >
            <Cloud className="w-4 h-4" />
            <span className="hidden sm:inline">Cloudflare R2</span>
            <span className="sm:hidden">R2</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPreFlightOpen(true)}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Navigation Bar */}
      <div className="no-print lg:hidden bg-slate-900/95 border-b border-slate-800 px-2 py-2 flex items-center gap-1.5 overflow-x-auto text-xs font-medium text-slate-300 no-scrollbar">
        {[
          { id: 'painel', label: 'Painel' },
          { id: 'cliente', label: 'Cliente' },
          { id: 'torres', label: `Torres (${report.torres.length})` },
          { id: 'fotos', label: `Fotos (${totalPhotos})` },
          { id: 'medicoes', label: 'Medições' },
          { id: 'conclusao', label: 'Assinatura' },
          { id: 'preview', label: `Laudo (${totalPages}p)` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === tab.id ? 'bg-red-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toast Notification Bar */}
      {exportMessage && (
        <div className="no-print bg-slate-800 text-white px-4 py-2.5 text-xs flex items-center justify-between border-b border-slate-700 shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportMessage}</span>
          </div>
        </div>
      )}

      {/* ========================================================
          MAIN BODY CONTAINER
      ======================================================== */}
      <main className="flex-1 flex flex-col">
        {/* TAB 1: PAINEL GERAL */}
        {activeTab === 'painel' && (
          <div className="no-print max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
            {/* Hero Overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-bold text-red-600 tracking-wider uppercase">
                    Laudo Técnico Pericial de Engenharia Elétrica
                  </span>
                  <h1 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    {report.cliente.nomeEmpreendimento || report.cliente.cliente}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {report.cliente.municipioUf} · Período: {report.cliente.periodoAvaliacao} · Responsável: {report.responsavelTecnico.responsavelTecnico}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                    {savedStatus}
                  </span>
                  <button
                    type="button"
                    onClick={handleManualSave}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Salva todas as alterações deste laudo no banco de dados local"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Salvando...' : 'Salvar / Atualizar Laudo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReportsManagerOpen(true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-red-600" />
                    <span>Meus Laudos ({savedReportsCount})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Laudo Pronto
                  </button>
                </div>
              </div>

              {/* Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-slate-500">Torres Cadastradas</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {report.torres.length}
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                    {report.areaComum.habilitada ? '+ Área Comum' : 'Sem área comum'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-slate-500">Fotografias Inspecionadas</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{totalPhotos}</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">5 colunas padronizadas</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-slate-500">Total de Páginas A4</div>
                  <div className="text-2xl font-black text-red-600 mt-1">{totalPages}</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">Paginação automática NBR</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-slate-500">Assinatura Digital ART</div>
                  <div className="text-sm font-bold text-slate-900 mt-2 flex items-center gap-1.5">
                    {report.responsavelTecnico.assinaturaUrl ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Assinada
                      </span>
                    ) : (
                      <span className="text-amber-600">Pendente</span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsSignatureOpen(true)}
                    className="text-[10.5px] text-red-600 hover:underline font-semibold mt-1"
                  >
                    Gerenciar assinatura
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div
                onClick={() => setIsR2ModalOpen(true)}
                className="bg-white border border-slate-200 hover:border-orange-500 rounded-xl p-5 shadow-2xs cursor-pointer transition-all hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
                  <Cloud className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Cloudflare R2</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sincronize laudos em .docx e fotos originais organizadas por pastas no bucket R2.
                </p>
              </div>

              <div
                onClick={() => setIsReportsManagerOpen(true)}
                className="bg-white border border-slate-200 hover:border-red-400 rounded-xl p-5 shadow-2xs cursor-pointer transition-all hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-3">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Gerenciar Laudos ({savedReportsCount})</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Abra, alterne, duplique ou crie um novo laudo para outros condomínios.
                </p>
              </div>

              <div
                onClick={() => setActiveTab('fotos')}
                className="bg-white border border-slate-200 hover:border-red-400 rounded-xl p-5 shadow-2xs cursor-pointer transition-all hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-3">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Upload de Fotos de Campo</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Fotografe com o celular ou importe fotos dos ensaios, captores e DPS por torre.
                </p>
              </div>

              <div
                onClick={handleSaveToDevice}
                className="bg-white border border-slate-200 hover:border-emerald-400 rounded-xl p-5 shadow-2xs cursor-pointer transition-all hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <FolderDown className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Salvar Fotos na Pasta</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Grava todas as fotos originais separadas em pastas no seu computador ou celular.
                </p>
              </div>

              <div
                onClick={() => setIsPreFlightOpen(true)}
                className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-5 shadow-2xs cursor-pointer transition-all hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Conferência &amp; Emissão</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Conferência dos 13 itens obrigatórios da NBR 5419 e emissão em PDF e Word.
                </p>
              </div>
            </div>

            {/* Backup & Tools Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportReportJson(report)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Salvar Backup (.JSON)
                </button>
                <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors">
                  <UploadCloud className="w-3.5 h-3.5" /> Restaurar Backup
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const parsed = JSON.parse(ev.target?.result as string);
                          if (parsed.cliente && parsed.torres) {
                            setReport(parsed);
                            alert('Laudo restaurado com sucesso!');
                          }
                        } catch {
                          alert('Arquivo JSON inválido.');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Deseja iniciar um laudo em branco?')) {
                      const fresh = createInitialReport();
                      fresh.cliente.cliente = '';
                      fresh.cliente.nomeEmpreendimento = '';
                      fresh.torres = [
                        { id: 't-1', nome: 'Torre 1', numeroOrdem: 1, fotosEnsaio: [], fotosSpda: [], fotosQuadros: [] },
                      ];
                      setReport(fresh);
                      setSelectedTowerId('t-1');
                    }
                  }}
                  className="px-3 py-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors"
                >
                  Novo Laudo em Branco
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Restaurar dados completos da referência original (Residencial Max Clube - 21 páginas)?')) {
                      const init = createInitialReport();
                      const { fotoAereaUrl, fotoFachadaUrl } = getBuildingSampleImages();
                      init.edificacao.fotoAereaUrl = fotoAereaUrl;
                      init.edificacao.fotoFachadaUrl = fotoFachadaUrl;
                      init.torres = init.torres.map((t) => {
                        const { fotosEnsaio, fotosSpda, fotosQuadros } = generateSamplePhotosForTower(t.id, t.nome);
                        return { ...t, fotosEnsaio, fotosSpda, fotosQuadros };
                      });
                      const cPhotos = generateSampleCommonAreaPhotos();
                      init.areaComum.fotosSpda = cPhotos.fotosSpda;
                      init.areaComum.fotosQuadros = cPhotos.fotosQuadros;
                      setReport(init);
                    }
                  }}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-semibold rounded-lg transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restaurar Referência Original
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLIENTE & EDIFICAÇÃO */}
        {activeTab === 'cliente' && (
          <div className="no-print max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Dados da Edificação &amp; Cliente
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cliente</label>
                  <input
                    type="text"
                    value={report.cliente.cliente}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, cliente: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    placeholder="Ex: Condomínio Residencial Max Clube"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome do Empreendimento</label>
                  <input
                    type="text"
                    value={report.cliente.nomeEmpreendimento}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, nomeEmpreendimento: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={report.cliente.cnpj}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, cnpj: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    placeholder="— ou 00.000.000/0000-00"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Local</label>
                  <input
                    type="text"
                    value={report.cliente.local}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, local: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    placeholder="No entorno das torres."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Município / UF</label>
                  <input
                    type="text"
                    value={report.cliente.municipioUf}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, municipioUf: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    placeholder="SÃO JOSÉ DOS CAMPOS - SP"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ramo de Atividade</label>
                  <input
                    type="text"
                    value={report.cliente.ramoAtividade}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, ramoAtividade: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    placeholder="RESIDENCIAL"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Período de Avaliação</label>
                  <input
                    type="text"
                    value={report.cliente.periodoAvaliacao}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, periodoAvaliacao: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    placeholder="17/10/2026 – 23/10/2026"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Grau de Exposição</label>
                  <input
                    type="text"
                    value={report.cliente.grauExposicao}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        cliente: { ...report.cliente, grauExposicao: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    placeholder="baixa EXPOSIÇÃO"
                  />
                </div>
              </div>
            </div>

            {/* Características da Edificação & Fotos de Fachada */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Parâmetros Construtivos &amp; Fotos Gerais
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipologia Construtiva</label>
                  <input
                    type="text"
                    value={report.edificacao.tipologiaConstrutiva}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        edificacao: { ...report.edificacao, tipologiaConstrutiva: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Topografia &amp; Entorno</label>
                  <input
                    type="text"
                    value={report.edificacao.topografiaEntorno}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        edificacao: { ...report.edificacao, topografiaEntorno: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nível de Proteção Dimensionado</label>
                  <input
                    type="text"
                    value={report.edificacao.nivelProtecao}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        edificacao: { ...report.edificacao, nivelProtecao: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Métodos de Proteção Aplicáveis</label>
                  <input
                    type="text"
                    value={report.edificacao.metodosProtecao}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        edificacao: { ...report.edificacao, metodosProtecao: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              {/* Photos upload: Aerial and Facade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-slate-100 text-xs">
                {/* Aerial */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-700">3.1) Vista Aérea / Imagem Satélite</span>
                  <div className="w-full h-36 bg-slate-100 border border-slate-300 rounded overflow-hidden flex items-center justify-center">
                    {report.edificacao.fotoAereaUrl ? (
                      <img
                        src={report.edificacao.fotoAereaUrl}
                        alt="Vista Aérea"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-400">Nenhuma imagem carregada</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setReport({
                          ...report,
                          edificacao: {
                            ...report.edificacao,
                            fotoAereaUrl: ev.target?.result as string,
                          },
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="text-xs text-slate-500"
                  />
                </div>

                {/* Facade */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-700">3.2) Fachada Principal do Condomínio</span>
                  <div className="w-full h-36 bg-slate-100 border border-slate-300 rounded overflow-hidden flex items-center justify-center">
                    {report.edificacao.fotoFachadaUrl ? (
                      <img
                        src={report.edificacao.fotoFachadaUrl}
                        alt="Fachada Principal"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-400">Nenhuma imagem carregada</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setReport({
                          ...report,
                          edificacao: {
                            ...report.edificacao,
                            fotoFachadaUrl: ev.target?.result as string,
                          },
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="text-xs text-slate-500"
                  />
                </div>
              </div>

              {/* History */}
              <div className="pt-2 text-xs space-y-2">
                <label className="block font-semibold text-slate-700">
                  4) Histórico de Ocorrências e Descargas Atmosféricas
                </label>
                <textarea
                  rows={2}
                  value={report.edificacao.historicoOcorrencias}
                  onChange={(e) =>
                    setReport({
                      ...report,
                      edificacao: { ...report.edificacao, historicoOcorrencias: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GESTÃO DE TORRES */}
        {activeTab === 'torres' && (
          <div className="no-print max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Organização Automática por Torre
                  </h2>
                  <p className="text-xs text-slate-500">
                    O laudo criará automaticamente uma seção independente (6.1, 6.2, ...) para cada torre no mesmo documento PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddTower}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Adicionar Nova Torre
                </button>
              </div>

              {/* Towers list */}
              <div className="space-y-3">
                {report.torres.map((tower, idx) => {
                  const totalTPhotos =
                    tower.fotosEnsaio.length +
                    tower.fotosSpda.length +
                    tower.fotosQuadros.length;

                  return (
                    <div
                      key={tower.id}
                      className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center font-mono">
                          6.{idx + 1}
                        </span>
                        <div>
                          <input
                            type="text"
                            value={tower.nome}
                            onChange={(e) => handleUpdateTowerName(tower.id, e.target.value)}
                            className="font-bold text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-red-600 focus:outline-hidden"
                          />
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {tower.fotosEnsaio.length} pontos continuidade · {tower.fotosSpda.length} SPDA/captores · {tower.fotosQuadros.length} DPS
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTowerId(tower.id);
                            setActiveTab('fotos');
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5 text-red-600" />
                          Gerenciar Fotos ({totalTPhotos})
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveTower(tower.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Excluir torre"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Common Area Toggle */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Seção da Área Comum</h4>
                  <p className="text-[11px] text-slate-500">
                    Incluir vistoria de SPDA e quadros da área comum (usina solar, guarita, lazer).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={report.areaComum.habilitada}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        areaComum: { ...report.areaComum, habilitada: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FOTOS POR TORRE */}
        {activeTab === 'fotos' && (
          <div className="no-print max-w-5xl w-full mx-auto p-4 sm:p-6">
            <PhotoManager
              torres={report.torres}
              areaComum={report.areaComum}
              selectedTowerId={selectedTowerId}
              onSelectTowerId={setSelectedTowerId}
              onUpdateTowerPhotos={handleUpdateTowerPhotos}
              onUpdateCommonAreaPhotos={handleUpdateCommonAreaPhotos}
            />
          </div>
        )}

        {/* TAB 5: MEDIÇÕES, INSTRUMENTAÇÃO & DPS */}
        {activeTab === 'medicoes' && (
          <div className="no-print max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                5) Instrumentação Técnica &amp; Parâmetros de Continuidade
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Equipamento Utilizado
                  </label>
                  <input
                    type="text"
                    value={report.instrumentacao.equipamentoNome}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          equipamentoNome: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Corrente de Ensaio
                  </label>
                  <input
                    type="text"
                    value={report.instrumentacao.correnteEnsaio}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          correnteEnsaio: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              {/* Status table for continuity */}
              <div className="space-y-2 pt-2">
                <span className="font-bold text-xs text-slate-700">
                  Status dos Parâmetros Normativos NBR 5419:2026
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  {report.instrumentacao.parametrosContinuidades.map((param, idx) => (
                    <div
                      key={param.id}
                      className="flex items-center justify-between p-3 border-b border-slate-100 last:border-b-0 bg-slate-50/40"
                    >
                      <div className="pr-4">
                        <div className="font-bold text-slate-900">{param.item}</div>
                        <div className="text-slate-500 text-[11px]">
                          {param.norma} · Limite: {param.limite}
                        </div>
                      </div>
                      <select
                        value={param.status}
                        onChange={(e) => {
                          const copy = [...report.instrumentacao.parametrosContinuidades];
                          copy[idx] = { ...copy[idx], status: e.target.value as any };
                          setReport({
                            ...report,
                            instrumentacao: { ...report.instrumentacao, parametrosContinuidades: copy },
                          });
                        }}
                        className="border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="CONFORME">CONFORME</option>
                        <option value="APLICADO">APLICADO</option>
                        <option value="LIMPEZA PENDENTE">LIMPEZA PENDENTE</option>
                        <option value="NÃO CONFORME">NÃO CONFORME</option>
                        <option value="ATENÇÃO">ATENÇÃO</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* DPS Description */}
              <div className="space-y-1.5 pt-2 text-xs">
                <label className="block font-semibold text-slate-700">
                  Proteção Contra Surtos em Quadros Elétricos (DPS NBR 5410)
                </label>
                <textarea
                  rows={3}
                  value={report.instrumentacao.textoDps}
                  onChange={(e) =>
                    setReport({
                      ...report,
                      instrumentacao: { ...report.instrumentacao, textoDps: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: CONCLUSÃO, RECOMENDAÇÕES & ASSINATURA */}
        {activeTab === 'conclusao' && (
          <div className="no-print max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                7) Recomendações Técnicas Prioritárias &amp; Conclusão
              </h2>

              <div className="space-y-2 text-xs">
                <label className="block font-semibold text-slate-700">
                  Recomendações Técnicas Prioritárias (NBR 5419:2026)
                </label>
                <div className="space-y-1.5 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  {report.modeloTextos.recomendacoesPrioritarias.map((rec, idx) => (
                    <div key={idx} className="text-slate-800 flex items-start gap-2">
                      <span className="font-bold text-red-600 shrink-0">7.{idx + 1}-</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conclusão final */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700">
                  8) Conclusão Final do Parecer Técnico
                </label>
                <textarea
                  rows={4}
                  value={report.conclusaoPersonalizada || report.modeloTextos.conclusaoFinal}
                  onChange={(e) => setReport({ ...report, conclusaoPersonalizada: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Responsabilidade Técnica & Assinatura */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">
                    Responsabilidade Técnica &amp; Assinatura Digital
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsSignatureOpen(true)}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Award className="w-4 h-4" />
                    {report.responsavelTecnico.assinaturaUrl ? 'Alterar Assinatura' : 'Assinar Digitalmente'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Responsável Técnico
                    </label>
                    <input
                      type="text"
                      value={report.responsavelTecnico.responsavelTecnico}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          responsavelTecnico: {
                            ...report.responsavelTecnico,
                            responsavelTecnico: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Qualificação Profissional
                    </label>
                    <input
                      type="text"
                      value={report.responsavelTecnico.qualificacao}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          responsavelTecnico: {
                            ...report.responsavelTecnico,
                            qualificacao: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Registro CREA / CONFEA
                    </label>
                    <input
                      type="text"
                      value={report.responsavelTecnico.registroCrea}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          responsavelTecnico: {
                            ...report.responsavelTecnico,
                            registroCrea: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Número / Detalhe da ART
                    </label>
                    <input
                      type="text"
                      value={report.responsavelTecnico.numeroArt}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          responsavelTecnico: {
                            ...report.responsavelTecnico,
                            numeroArt: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Cidade de Emissão
                    </label>
                    <input
                      type="text"
                      value={report.responsavelTecnico.cidadeEmissao}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          responsavelTecnico: {
                            ...report.responsavelTecnico,
                            cidadeEmissao: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Data de Emissão
                    </label>
                    <input
                      type="text"
                      value={report.responsavelTecnico.dataEmissao}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          responsavelTecnico: {
                            ...report.responsavelTecnico,
                            dataEmissao: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>

                {report.responsavelTecnico.assinaturaUrl && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-32 bg-white border border-slate-300 rounded flex items-center justify-center p-1">
                        <img
                          src={report.responsavelTecnico.assinaturaUrl}
                          alt="Assinatura"
                          className="max-h-full object-contain"
                        />
                      </div>
                      <span className="text-xs text-slate-600 font-medium">
                        Assinatura digital inserida no documento final
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setReport({
                          ...report,
                          responsavelTecnico: {
                            ...report.responsavelTecnico,
                            assinaturaUrl: undefined,
                          },
                        })
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover Assinatura
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: PREVIEW DO LAUDO COMPLETO (PDF) */}
        {activeTab === 'preview' && (
          <div className="w-full flex flex-col items-center">
            {/* Top Preview Control Bar */}
            <div className="no-print w-full bg-white border-b border-slate-200 px-6 py-3 sticky top-14 z-30 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-900">
                  Pré-visualização A4 em Tempo Real
                </span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  {totalPages} Páginas Formatadas
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Padrão NBR 5419:2026 · Grade fixa 5 colunas
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToDevice}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FolderDown className="w-4 h-4 text-emerald-600" />
                  Salvar Fotos (ZIP)
                </button>
                <button
                  type="button"
                  onClick={handleExportDocx}
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Exportar para Microsoft Word (.docx)"
                >
                  <FileText className="w-4 h-4" />
                  Exportar Word (.docx)
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreFlightOpen(true)}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Emitir PDF
                </button>
              </div>
            </div>

            {/* Document Render */}
            <div className="w-full flex justify-center py-4">
              <PdfDocumentView report={report} />
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODALS
      ======================================================== */}
      <SignatureModal
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        responsavel={report.responsavelTecnico}
        onSaveSignature={(signatureUrl) =>
          setReport({
            ...report,
            responsavelTecnico: {
              ...report.responsavelTecnico,
              assinaturaUrl: signatureUrl,
              dataAssinatura: new Date().toISOString(),
            },
          })
        }
      />

      <PreFlightCheckModal
        isOpen={isPreFlightOpen}
        onClose={() => setIsPreFlightOpen(false)}
        report={report}
        onProceedToPrint={handleProceedToPrint}
        onExportPhotosZip={handleSaveToDevice}
        onExportDocx={handleExportDocx}
        onOpenR2Sync={() => setIsR2ModalOpen(true)}
      />

      <AdminTemplateModal
        isOpen={isAdminTemplateOpen}
        onClose={() => setIsAdminTemplateOpen(false)}
        empresa={report.empresa}
        modeloTextos={report.modeloTextos}
        onSave={(updatedEmpresa, updatedTextos) =>
          setReport({
            ...report,
            empresa: updatedEmpresa,
            modeloTextos: updatedTextos,
          })
        }
      />

      <CreateReportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onReportCreated={handleReportCreated}
      />

      <ReportsManagerModal
        isOpen={isReportsManagerOpen}
        onClose={() => setIsReportsManagerOpen(false)}
        currentReportId={report.id}
        onSelectReport={handleSelectReport}
        onOpenCreateNew={() => setIsCreateModalOpen(true)}
      />

      <CloudflareR2Modal
        isOpen={isR2ModalOpen}
        onClose={() => setIsR2ModalOpen(false)}
        report={report}
        onSyncComplete={(msg) => {
          setExportMessage(msg);
          setTimeout(() => setExportMessage(null), 5000);
        }}
      />
    </div>
  );
}

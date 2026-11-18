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
  saveOriginalPhoto,
  createPrintQualityImage,
  resizeLogoToDataUrl,
} from './services/storage';
import {
  exportOriginalPhotosZip,
  trySaveToDeviceDirectory,
  exportReportJson,
} from './services/photoExporter';
import { exportReportToDocx } from './services/docxExporter';
import { PdfDocumentView } from './components/PdfDocumentView';
import { DocumentHeader } from './components/DocumentHeader';
import { DocumentFooter } from './components/DocumentFooter';
import { CompanyLogo } from './components/CompanyLogo';
import { PhotoManager } from './components/PhotoManager';
import { SignatureModal } from './components/SignatureModal';
import { PreFlightCheckModal } from './components/PreFlightCheckModal';
import { AdminTemplateModal } from './components/AdminTemplateModal';
import { CreateReportModal } from './components/CreateReportModal';
import { ReportsManagerModal } from './components/ReportsManagerModal';
import { CloudflareR2Modal } from './components/CloudflareR2Modal';
import { SendReportModal } from './components/SendReportModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { calculateTotalPages } from './utils/documentPaginator';
import { upgradeAndRepairReport } from './utils/reportRepairMigration';
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
  Send,
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
  Upload,
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
  const [isSendReportOpen, setIsSendReportOpen] = useState(false);
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

  // Load saved draft or last active report on mount, ensuring automatic upgrade to 3x4
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

        const reportToUpgrade = target || report;
        const { report: repaired, modified } = upgradeAndRepairReport(reportToUpgrade);

        setReport(repaired);
        if (repaired.torres.length > 0) {
          setSelectedTowerId(repaired.torres[0].id);
        }

        if (modified || !target) {
          // Permanently persist the 3x4 upgraded report in IndexedDB
          await saveReportToDb(repaired);
          localStorage.setItem('spda_last_report_id', repaired.id);
          setSavedReportsCount(Math.max(1, all.length));
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
    const { report: repaired, modified } = upgradeAndRepairReport(selected);
    setReport(repaired);
    if (repaired.torres && repaired.torres.length > 0) {
      setSelectedTowerId(repaired.torres[0].id);
    }
    localStorage.setItem('spda_last_report_id', repaired.id);
    if (modified) {
      saveReportToDb(repaired).catch(console.warn);
    }
    refreshReportsCount();
    setExportMessage(`Laudo "${repaired.cliente.nomeEmpreendimento || repaired.cliente.cliente}" carregado e sincronizado no formato 3x4.`);
    setTimeout(() => setExportMessage(null), 3000);
  };

  // Manual Trigger to guarantee active report in editing is 100% upgraded to 3x4
  const handleUpgradeCurrentReport = async () => {
    const { report: repaired, modified, details } = upgradeAndRepairReport(report);
    setReport(repaired);
    await saveReportToDb(repaired);
    setExportMessage(
      modified
        ? `Laudo em edição atualizado com sucesso! ${details.length > 0 ? details.join(', ') : 'Fotos convertidas para 3x4 e visores sincronizados'}.`
        : 'O laudo em edição já está 100% atualizado com fotos retangulares 3x4 e visores legíveis.'
    );
    setTimeout(() => setExportMessage(null), 5000);
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
    setExportMessage('Preparando fotos originais intactas para salvar nos arquivos...');
    const supportedDirect = await trySaveToDeviceDirectory(report, (c, t, msg) => {
      setExportMessage(msg);
    });

    if (supportedDirect) {
      setExportMessage('Fotos originais salvas na pasta escolhida (qualidade original preservada)!');
      setTimeout(() => setExportMessage(null), 4500);
      return;
    }

    // Fallback: structured ZIP download
    try {
      await exportOriginalPhotosZip(report, (c, t, msg) => {
        setExportMessage(msg);
      });
      setExportMessage('Arquivo ZIP com todas as fotos originais baixado nos arquivos do aparelho!');
      setTimeout(() => setExportMessage(null), 4500);
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

  // Open Send / PDF Export Modal
  const handleProceedToPrint = () => {
    setActiveTab('preview');
    setIsSendReportOpen(true);
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
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans overflow-x-hidden">
      {/* ========================================================
          APP TOP BAR (Clean Three-Zone Header)
      ======================================================== */}
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 w-full max-w-full px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Wordmark & Report Selector */}
        <div className="flex items-center gap-2 min-w-0">
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
            5. Textos &amp; Parecer
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
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 max-w-full">
          <PWAInstallButton />

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
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            title="Salva todas as fotos originais intactas em uma pasta ou ZIP no celular ou computador"
          >
            <FolderDown className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Fotos Originais</span>
            <span className="sm:hidden">Originais</span>
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
            onClick={() => {
              setActiveTab('preview');
              setIsSendReportOpen(true);
            }}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar e enviar o laudo em PDF para o cliente"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar Laudo</span>
            <span className="sm:hidden">Enviar</span>
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
          { id: 'conclusao', label: 'Textos & Parecer' },
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
                  <label className="block font-semibold text-slate-700 mb-1">Endereço</label>
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
                    placeholder="Ex: Av. São João, 1234 - Colinas"
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
                  <div className="w-full min-h-[9rem] bg-slate-100 border border-slate-300 rounded overflow-hidden flex items-center justify-center">
                    {report.edificacao.fotoAereaUrl ? (
                      <img
                        src={report.edificacao.fotoAereaUrl}
                        alt="Vista Aérea"
                        className="w-full h-auto block"
                      />
                    ) : (
                      <span className="text-slate-400">Nenhuma imagem carregada</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        await saveOriginalPhoto(`edificacao-aerea-${report.id}`, file, file.name);
                        const originalDataUrl = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.onerror = () => reject(new Error('Falha ao ler imagem'));
                          reader.readAsDataURL(file);
                        });
                        setReport((prev) => ({
                          ...prev,
                          edificacao: {
                            ...prev.edificacao,
                            fotoAereaUrl: originalDataUrl,
                          },
                        }));
                      } catch (err) {
                        console.error('Erro ao processar vista aérea:', err);
                      }
                    }}
                    className="text-xs text-slate-500"
                  />
                </div>

                {/* Facade */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-700">3.2) Fachada Principal do Condomínio</span>
                  <div className="w-full min-h-[9rem] bg-slate-100 border border-slate-300 rounded overflow-hidden flex items-center justify-center">
                    {report.edificacao.fotoFachadaUrl ? (
                      <img
                        src={report.edificacao.fotoFachadaUrl}
                        alt="Fachada Principal"
                        className="w-full h-auto block"
                      />
                    ) : (
                      <span className="text-slate-400">Nenhuma imagem carregada</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        await saveOriginalPhoto(`edificacao-fachada-${report.id}`, file, file.name);
                        const originalDataUrl = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.onerror = () => reject(new Error('Falha ao ler imagem'));
                          reader.readAsDataURL(file);
                        });
                        setReport((prev) => ({
                          ...prev,
                          edificacao: {
                            ...prev.edificacao,
                            fotoFachadaUrl: originalDataUrl,
                          },
                        }));
                      } catch (err) {
                        console.error('Erro ao processar foto da fachada:', err);
                      }
                    }}
                    className="text-xs text-slate-500"
                  />
                </div>
              </div>

              {/* History */}
              <div className="pt-2 text-xs space-y-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    4.1) Histórico de Ocorrências e Descargas Atmosféricas
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
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    4.2) Análise Complementar das Ocorrências
                  </label>
                  <textarea
                    rows={2}
                    value={report.edificacao.historicoOcorrenciasComplemento}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        edificacao: {
                          ...report.edificacao,
                          historicoOcorrenciasComplemento: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
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
          <div className="no-print max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-4">
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                    <span>Fotos 3x4 &amp; Leitura Ampliada de Visores Ativadas</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono font-bold">
                      Laudo em Edição Sincronizado
                    </span>
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Fotos exibidas no formato retangular 3x4 (sem achatamento). Clique sobre qualquer foto ou em <strong>Inspecionar Visor (Lupa)</strong> para ampliar a imagem e ler os dígitos do micrômetro/miliohmímetro com alta nitidez.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpgradeCurrentReport}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                title="Sincroniza todas as fotos deste laudo em edição para o formato retangular 3x4 e carrega leituras dos visores nas legendas"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Atualizar Fotos do Laudo</span>
              </button>
            </div>

            <PhotoManager
              torres={report.torres}
              areaComum={report.areaComum}
              selectedTowerId={selectedTowerId}
              onSelectTowerId={setSelectedTowerId}
              onUpdateTowerPhotos={handleUpdateTowerPhotos}
              onUpdateCommonAreaPhotos={handleUpdateCommonAreaPhotos}
              onSaveAllOriginals={handleSaveToDevice}
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

              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700">
                  Texto Introdutório da Seção 5
                </label>
                <textarea
                  rows={2}
                  value={
                    report.instrumentacao.textoIntroducao ??
                    `Foram efetuadas medidas de continuidade elétrica e inspeção visual, com o uso do ${report.instrumentacao.equipamentoNome}. Os certificados de calibração estão em anexo.`
                  }
                  onChange={(e) =>
                    setReport({
                      ...report,
                      instrumentacao: {
                        ...report.instrumentacao,
                        textoIntroducao: e.target.value,
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

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
                    Local da Medição
                  </label>
                  <input
                    type="text"
                    value={report.instrumentacao.localMedicao}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          localMedicao: e.target.value,
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

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipo de Corrente
                  </label>
                  <input
                    type="text"
                    value={report.instrumentacao.tipoCorrente}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          tipoCorrente: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700">
                  Descrição Técnica do Equipamento
                </label>
                <textarea
                  rows={2}
                  value={report.instrumentacao.equipamentoDescricao}
                  onChange={(e) =>
                    setReport({
                      ...report,
                      instrumentacao: {
                        ...report.instrumentacao,
                        equipamentoDescricao: e.target.value,
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Status table for continuity */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-700">
                    Parâmetros Normativos de Continuidade (NBR 5419:2026)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const copy = [...report.instrumentacao.parametrosContinuidades];
                      copy.push({
                        id: `param-${Date.now()}`,
                        item: 'Novo Item de Verificação',
                        norma: 'NBR 5419-3:2026',
                        limite: '≤ 0,200 Ω (200 mΩ)',
                        status: 'CONFORME',
                      });
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          parametrosContinuidades: copy,
                        },
                      });
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Parâmetro
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                  {report.instrumentacao.parametrosContinuidades.map((param, idx) => (
                    <div
                      key={param.id}
                      className="p-3 bg-slate-50/40 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={param.item}
                        onChange={(e) => {
                          const copy = [...report.instrumentacao.parametrosContinuidades];
                          copy[idx] = { ...copy[idx], item: e.target.value };
                          setReport({
                            ...report,
                            instrumentacao: { ...report.instrumentacao, parametrosContinuidades: copy },
                          });
                        }}
                        className="sm:col-span-4 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 bg-white"
                        placeholder="Item"
                      />
                      <input
                        type="text"
                        value={param.norma}
                        onChange={(e) => {
                          const copy = [...report.instrumentacao.parametrosContinuidades];
                          copy[idx] = { ...copy[idx], norma: e.target.value };
                          setReport({
                            ...report,
                            instrumentacao: { ...report.instrumentacao, parametrosContinuidades: copy },
                          });
                        }}
                        className="sm:col-span-3 border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 bg-white"
                        placeholder="Norma"
                      />
                      <input
                        type="text"
                        value={param.limite}
                        onChange={(e) => {
                          const copy = [...report.instrumentacao.parametrosContinuidades];
                          copy[idx] = { ...copy[idx], limite: e.target.value };
                          setReport({
                            ...report,
                            instrumentacao: { ...report.instrumentacao, parametrosContinuidades: copy },
                          });
                        }}
                        className="sm:col-span-2 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800 bg-white"
                        placeholder="Limite"
                      />
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
                        className="sm:col-span-2 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="CONFORME">CONFORME</option>
                        <option value="APLICADO">APLICADO</option>
                        <option value="LIMPEZA PENDENTE">LIMPEZA PENDENTE</option>
                        <option value="NÃO CONFORME">NÃO CONFORME</option>
                        <option value="ATENÇÃO">ATENÇÃO</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = report.instrumentacao.parametrosContinuidades.filter(
                            (_, i) => i !== idx
                          );
                          setReport({
                            ...report,
                            instrumentacao: { ...report.instrumentacao, parametrosContinuidades: copy },
                          });
                        }}
                        className="sm:col-span-1 p-1 text-slate-400 hover:text-red-600 justify-self-end"
                        title="Remover parâmetro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

        {/* TAB 5: TEXTOS DO LAUDO (SEÇÃO 4 EM DIANTE) & PARECER TÉCNICO */}
        {activeTab === 'conclusao' && (
          <div className="no-print max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
            {/* Header explicativo com ação de restaurar padrão */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold">
                    Textos Editáveis (Seção 4 em diante) &amp; Parecer Técnico
                  </h2>
                </div>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  Os textos das Seções 1, 2 e 3 seguem o padrão fixo do laudo. Da Seção 4 em diante (Seções 4, 5, 6, 7 e 8), todos os textos carregam o padrão normativo da NBR 5419:2026 e podem ser editados livremente para cada cliente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      'Deseja restaurar todos os textos das Seções 4 a 8 para o padrão normativo da NBR 5419:2026?'
                    )
                  ) {
                    const defaultInit = createInitialReport();
                    setReport({
                      ...report,
                      edificacao: {
                        ...report.edificacao,
                        historicoOcorrencias: defaultInit.edificacao.historicoOcorrencias,
                        historicoOcorrenciasComplemento:
                          defaultInit.edificacao.historicoOcorrenciasComplemento,
                      },
                      instrumentacao: { ...defaultInit.instrumentacao },
                      torres: report.torres.map((t) => ({ ...t, observacoes: undefined })),
                      areaComum: { ...report.areaComum, observacoes: undefined },
                      modeloTextos: {
                        ...report.modeloTextos,
                        tituloSecao4: DEFAULT_FIXED_TEXTS.tituloSecao4,
                        tituloSecao5: DEFAULT_FIXED_TEXTS.tituloSecao5,
                        tituloSecao6Prefixo: DEFAULT_FIXED_TEXTS.tituloSecao6Prefixo,
                        subtituloSecao6Ensaio: DEFAULT_FIXED_TEXTS.subtituloSecao6Ensaio,
                        subtituloSecao6Spda: DEFAULT_FIXED_TEXTS.subtituloSecao6Spda,
                        subtituloSecao6Quadros: DEFAULT_FIXED_TEXTS.subtituloSecao6Quadros,
                        tituloSecao7: DEFAULT_FIXED_TEXTS.tituloSecao7,
                        subtituloSecao7: DEFAULT_FIXED_TEXTS.subtituloSecao7,
                        recomendacoesPrioritarias: [...DEFAULT_FIXED_TEXTS.recomendacoesPrioritarias],
                        fechamentoRecomendacoes: DEFAULT_FIXED_TEXTS.fechamentoRecomendacoes,
                        tituloSecao8: DEFAULT_FIXED_TEXTS.tituloSecao8,
                        conclusaoFinal: DEFAULT_FIXED_TEXTS.conclusaoFinal,
                        parecerArt: DEFAULT_FIXED_TEXTS.parecerArt,
                        tituloDisposicoesFinais: DEFAULT_FIXED_TEXTS.tituloDisposicoesFinais,
                        disposicoesFinais: DEFAULT_FIXED_TEXTS.disposicoesFinais,
                      },
                      conclusaoPersonalizada: undefined,
                      parecerArtPersonalizado: undefined,
                      fechamentoRecomendacoesPersonalizado: undefined,
                      disposicoesFinaisPersonalizada: undefined,
                      recomendacoesPersonalizadas: [],
                    });
                  }
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                title="Recarregar os textos padrão da NBR 5419:2026 para as Seções 4 a 8"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restaurar Padrão (Seções 4 a 8)</span>
              </button>
            </div>

            {/* CABEÇALHO, RODAPÉ & LOGOTIPO DO LAUDO */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    Cabeçalho, Rodapé &amp; Logotipo do Laudo
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Personalize os textos do cabeçalho e do rodapé e troque o logotipo exibido em todas as páginas (PDF e Word).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReport({
                      ...report,
                      empresa: {
                        ...report.empresa,
                        logoUrl: undefined,
                        cabecalhoLinha1: DEFAULT_COMPANY.cabecalhoLinha1,
                        cabecalhoLinha2: DEFAULT_COMPANY.cabecalhoLinha2,
                        rodapeLinha1: DEFAULT_COMPANY.rodapeLinha1,
                        rodapeLinha2: DEFAULT_COMPANY.rodapeLinha2,
                      },
                    })
                  }
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Restaurar Padrão
                </button>
              </div>

              {/* Logotipo do Cabeçalho */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white border border-slate-200 rounded-md px-3 py-1.5 flex items-center justify-center min-w-[125px]">
                    <CompanyLogo customLogoUrl={report.empresa.logoUrl} height={42} />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-800">Logotipo no Cabeçalho</div>
                    <div className="text-[11px] text-slate-500">
                      {report.empresa.logoUrl
                        ? 'Imagem personalizada carregada (aplicada no PDF e Word)'
                        : 'Logotipo padrão SJC Engenharia ativo'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Enviar / Trocar Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await resizeLogoToDataUrl(file);
                          setReport((prev) => ({
                            ...prev,
                            empresa: { ...prev.empresa, logoUrl: dataUrl },
                          }));
                        } catch {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setReport((prev) => ({
                              ...prev,
                              empresa: {
                                ...prev.empresa,
                                logoUrl: ev.target?.result as string,
                              },
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {report.empresa.logoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setReport({
                          ...report,
                          empresa: { ...report.empresa, logoUrl: undefined },
                        })
                      }
                      className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                    >
                      Restaurar Logo Padrão
                    </button>
                  )}
                </div>
              </div>

              {/* Textos do Cabeçalho & Rodapé */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Cabeçalho — Texto Principal (Linha 1):
                  </label>
                  <input
                    type="text"
                    value={report.empresa.cabecalhoLinha1 ?? report.empresa.nome}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        empresa: { ...report.empresa, cabecalhoLinha1: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-red-500"
                    placeholder="Ex: SJC ENGENHARIA E SOLUÇÕES"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Cabeçalho — Subtítulo (Linha 2):
                  </label>
                  <input
                    type="text"
                    value={report.empresa.cabecalhoLinha2 ?? ''}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        empresa: { ...report.empresa, cabecalhoLinha2: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-1 focus:ring-red-500"
                    placeholder="Ex: Laudo Técnico Pericial de SPDA — ABNT NBR 5419:2026"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Rodapé — Linha 1:
                  </label>
                  <input
                    type="text"
                    value={
                      report.empresa.rodapeLinha1 ??
                      `${report.empresa.nome} - CNPJ: ${report.empresa.cnpj} – FONE: ${report.empresa.telefone}`
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        empresa: { ...report.empresa, rodapeLinha1: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Rodapé — Linha 2:
                  </label>
                  <input
                    type="text"
                    value={
                      report.empresa.rodapeLinha2 ??
                      `${report.empresa.endereco} – ${report.empresa.cidadeUf}`
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        empresa: { ...report.empresa, rodapeLinha2: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Prévia em Tempo Real do Cabeçalho e Rodapé */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Prévia em Tempo Real (como aparecerá nas páginas do laudo)
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-3">
                  <DocumentHeader empresa={report.empresa} />
                  <div className="text-[10px] text-slate-400 text-center italic py-1">
                    [ Conteúdo da página do laudo ]
                  </div>
                  <DocumentFooter empresa={report.empresa} currentPage={1} totalPages={totalPages} />
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: HISTÓRICO DE OCORRÊNCIAS & DESCARGAS ATMOSFÉRICAS */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  4) Histórico de Ocorrências &amp; Descargas Atmosféricas
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Edite o título da seção, o histórico relatado pelo cliente (4.1) e a análise técnica complementar (4.2).
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800">
                    Título da Seção 4:
                  </label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.tituloSecao4 ??
                      '4) HISTÓRICO DE OCORRÊNCIAS & DESCARGAS ATMOSFÉRICAS'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: { ...report.modeloTextos, tituloSecao4: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800">
                    4.1- Histórico de Ocorrências:
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800">
                    4.2- Análise Complementar (Efeitos Indiretos &amp; Proteção):
                  </label>
                  <textarea
                    rows={3}
                    value={report.edificacao.historicoOcorrenciasComplemento}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        edificacao: {
                          ...report.edificacao,
                          historicoOcorrenciasComplemento: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 5: INSTRUMENTAÇÃO TÉCNICA E CRITÉRIOS DE INSPEÇÃO */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  5) Instrumentação Técnica, Critérios de Inspeção &amp; DPS
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Todos os textos da Página 4 carregam o padrão técnico e permitem adaptação para cada laudo.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800">Título da Seção 5:</label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.tituloSecao5 ??
                      '5) INSTRUMENTAÇÃO TÉCNICA E CRITÉRIOS DE INSPEÇÃO'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: { ...report.modeloTextos, tituloSecao5: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800">
                    Texto Introdutório da Instrumentação:
                  </label>
                  <textarea
                    rows={2}
                    value={
                      report.instrumentacao.textoIntroducao ??
                      `Foram efetuadas medidas de continuidade elétrica e inspeção visual, com o uso do ${report.instrumentacao.equipamentoNome}. Os certificados de calibração estão em anexo.`
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          textoIntroducao: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nome do Equipamento:
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
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Local da Medição:
                    </label>
                    <input
                      type="text"
                      value={report.instrumentacao.localMedicao}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          instrumentacao: {
                            ...report.instrumentacao,
                            localMedicao: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Corrente de Ensaio:
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
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tipo de Corrente:
                    </label>
                    <input
                      type="text"
                      value={report.instrumentacao.tipoCorrente}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          instrumentacao: {
                            ...report.instrumentacao,
                            tipoCorrente: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800">
                    Descrição Técnica do Instrumento:
                  </label>
                  <textarea
                    rows={2}
                    value={report.instrumentacao.equipamentoDescricao}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          equipamentoDescricao: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed"
                  />
                </div>

                {/* Parâmetros Normativos de Continuidade */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="font-semibold text-slate-800">
                      Título &amp; Itens dos Parâmetros Normativos de Continuidade:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...report.instrumentacao.parametrosContinuidades];
                        copy.push({
                          id: `param-${Date.now()}`,
                          item: 'Novo Item Normativo',
                          norma: 'NBR 5419-3:2026',
                          limite: '≤ 0,200 Ω (200 mΩ)',
                          status: 'CONFORME',
                        });
                        setReport({
                          ...report,
                          instrumentacao: {
                            ...report.instrumentacao,
                            parametrosContinuidades: copy,
                          },
                        });
                      }}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Item
                    </button>
                  </div>

                  <input
                    type="text"
                    value={
                      report.instrumentacao.tituloParametrosContinuidades ??
                      'PARÂMETROS NORMATIVOS DE CONTINUIDADE (ABNT NBR 5419:2026)'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: {
                          ...report.instrumentacao,
                          tituloParametrosContinuidades: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900"
                  />

                  <div className="space-y-2">
                    {report.instrumentacao.parametrosContinuidades.map((param, idx) => (
                      <div
                        key={param.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <input
                          type="text"
                          value={param.item}
                          onChange={(e) => {
                            const copy = [...report.instrumentacao.parametrosContinuidades];
                            copy[idx] = { ...copy[idx], item: e.target.value };
                            setReport({
                              ...report,
                              instrumentacao: {
                                ...report.instrumentacao,
                                parametrosContinuidades: copy,
                              },
                            });
                          }}
                          className="sm:col-span-4 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900"
                          placeholder="Descrição do item"
                        />
                        <input
                          type="text"
                          value={param.norma}
                          onChange={(e) => {
                            const copy = [...report.instrumentacao.parametrosContinuidades];
                            copy[idx] = { ...copy[idx], norma: e.target.value };
                            setReport({
                              ...report,
                              instrumentacao: {
                                ...report.instrumentacao,
                                parametrosContinuidades: copy,
                              },
                            });
                          }}
                          className="sm:col-span-3 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700"
                          placeholder="Referência normativa"
                        />
                        <input
                          type="text"
                          value={param.limite}
                          onChange={(e) => {
                            const copy = [...report.instrumentacao.parametrosContinuidades];
                            copy[idx] = { ...copy[idx], limite: e.target.value };
                            setReport({
                              ...report,
                              instrumentacao: {
                                ...report.instrumentacao,
                                parametrosContinuidades: copy,
                              },
                            });
                          }}
                          className="sm:col-span-2 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800"
                          placeholder="Limite"
                        />
                        <select
                          value={param.status}
                          onChange={(e) => {
                            const copy = [...report.instrumentacao.parametrosContinuidades];
                            copy[idx] = { ...copy[idx], status: e.target.value as any };
                            setReport({
                              ...report,
                              instrumentacao: {
                                ...report.instrumentacao,
                                parametrosContinuidades: copy,
                              },
                            });
                          }}
                          className="sm:col-span-2 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800"
                        >
                          <option value="CONFORME">CONFORME</option>
                          <option value="APLICADO">APLICADO</option>
                          <option value="LIMPEZA PENDENTE">LIMPEZA PENDENTE</option>
                          <option value="NÃO CONFORME">NÃO CONFORME</option>
                          <option value="ATENÇÃO">ATENÇÃO</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = report.instrumentacao.parametrosContinuidades.filter(
                              (_, i) => i !== idx
                            );
                            setReport({
                              ...report,
                              instrumentacao: {
                                ...report.instrumentacao,
                                parametrosContinuidades: copy,
                              },
                            });
                          }}
                          className="sm:col-span-1 p-1 text-slate-400 hover:text-red-600 justify-self-end"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proteção Contra Surtos (DPS) */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block font-semibold text-slate-800">
                    Título &amp; Texto de Proteção Contra Surtos (DPS):
                  </label>
                  <input
                    type="text"
                    value={
                      report.instrumentacao.tituloDps ??
                      'PROTEÇÃO CONTRA SURTOS EM QUADROS ELÉTRICOS (ABNT NBR 5410 / NBR 5419-4)'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: { ...report.instrumentacao, tituloDps: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900"
                  />
                  <textarea
                    rows={3}
                    value={report.instrumentacao.textoDps}
                    onChange={(e) =>
                      setReport({
                        ...report,
                        instrumentacao: { ...report.instrumentacao, textoDps: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 6: VISTORIAS E ENSAIOS TÉCNICOS POR TORRE */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  6) Vistorias &amp; Ensaios Técnicos por Torre (Títulos e Observações)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Edite os títulos padrão das subseções fotográficas da Seção 6 e adicione observações técnicas opcionais por torre.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Prefixo do Título por Torre (6.X):
                  </label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.tituloSecao6Prefixo ?? 'VISTORIA & ENSAIOS TÉCNICOS'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: {
                          ...report.modeloTextos,
                          tituloSecao6Prefixo: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Subtítulo 6.X.1 (Ensaio de Continuidade):
                  </label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.subtituloSecao6Ensaio ??
                      'PONTOS DE ENSAIO DE CONTINUIDADE ÔHMICA (MILIOHMÍMETRO)'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: {
                          ...report.modeloTextos,
                          subtituloSecao6Ensaio: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Subtítulo 6.X.2 (SPDA &amp; Captores):
                  </label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.subtituloSecao6Spda ??
                      'VISTORIA DO SPDA EXISTENTE, CAPTORES & DESCIDAS'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: {
                          ...report.modeloTextos,
                          subtituloSecao6Spda: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Subtítulo 6.X.3 (Quadros &amp; DPS):
                  </label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.subtituloSecao6Quadros ??
                      'ANÁLISE DOS QUADROS DE ENERGIA & DPS (ABNT NBR 5410)'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: {
                          ...report.modeloTextos,
                          subtituloSecao6Quadros: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Observações específicas por torre e área comum */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs">
                <label className="block font-semibold text-slate-800">
                  Observações Técnicas por Torre / Área Comum (opcional — exibidas no bloco da torre):
                </label>
                {report.torres.map((tower, idx) => (
                  <div key={tower.id} className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      6.{idx + 1}) {tower.nome}
                    </label>
                    <textarea
                      rows={2}
                      value={tower.observacoes || ''}
                      onChange={(e) => {
                        const updated = report.torres.map((t) =>
                          t.id === tower.id ? { ...t, observacoes: e.target.value } : t
                        );
                        setReport({ ...report, torres: updated });
                      }}
                      placeholder={`Observações técnicas específicas para ${tower.nome} (deixe em branco se não houver)...`}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                    />
                  </div>
                ))}

                {report.areaComum.habilitada && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      6.{report.torres.length + 1}) {report.areaComum.nome}
                    </label>
                    <textarea
                      rows={2}
                      value={report.areaComum.observacoes || ''}
                      onChange={(e) =>
                        setReport({
                          ...report,
                          areaComum: { ...report.areaComum, observacoes: e.target.value },
                        })
                      }
                      placeholder="Observações técnicas específicas para a Área Comum (deixe em branco se não houver)..."
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 7: RECOMENDAÇÕES PRIORITÁRIAS */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    7) Correções Necessárias &amp; Recomendações Prioritárias
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Edite os títulos, cada recomendação individualmente, exclua as desnecessárias ou adicione novos itens para este cliente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentCustom = [...report.recomendacoesPersonalizadas];
                    currentCustom.push('Nova recomendação técnica para adequação do sistema.');
                    setReport({ ...report, recomendacoesPersonalizadas: currentCustom });
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Recomendação</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Título da Seção 7:
                  </label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.tituloSecao7 ??
                      '7) CORREÇÕES NECESSÁRIAS PARA PROTEÇÃO DAS EDIFICAÇÕES'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: { ...report.modeloTextos, tituloSecao7: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Subtítulo do Banner 7:
                  </label>
                  <input
                    type="text"
                    value={
                      report.modeloTextos.subtituloSecao7 ??
                      'Recomendações Técnicas Prioritárias (NBR 5419:2026)'
                    }
                    onChange={(e) =>
                      setReport({
                        ...report,
                        modeloTextos: { ...report.modeloTextos, subtituloSecao7: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Lista editável de recomendações */}
              <div className="space-y-2 text-xs">
                <div className="space-y-2">
                  {report.modeloTextos.recomendacoesPrioritarias.map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <span className="font-bold text-red-600 shrink-0 text-xs">7.{idx + 1}-</span>
                      <input
                        type="text"
                        value={rec}
                        onChange={(e) => {
                          const copy = [...report.modeloTextos.recomendacoesPrioritarias];
                          copy[idx] = e.target.value;
                          setReport({
                            ...report,
                            modeloTextos: { ...report.modeloTextos, recomendacoesPrioritarias: copy },
                          });
                        }}
                        className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 focus:ring-1 focus:ring-red-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const copy = report.modeloTextos.recomendacoesPrioritarias.filter((_, i) => i !== idx);
                          setReport({
                            ...report,
                            modeloTextos: { ...report.modeloTextos, recomendacoesPrioritarias: copy },
                          });
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Remover esta recomendação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Recomendações personalizadas adicionais */}
                  {report.recomendacoesPersonalizadas.map((rec, idx) => {
                    const num = report.modeloTextos.recomendacoesPrioritarias.length + idx + 1;
                    return (
                      <div key={`custom-${idx}`} className="flex items-center gap-2 bg-amber-50/50 border border-amber-200 rounded-lg p-2">
                        <span className="font-bold text-amber-700 shrink-0 text-xs">7.{num}-</span>
                        <input
                          type="text"
                          value={rec}
                          onChange={(e) => {
                            const copy = [...report.recomendacoesPersonalizadas];
                            copy[idx] = e.target.value;
                            setReport({ ...report, recomendacoesPersonalizadas: copy });
                          }}
                          className="flex-1 bg-white border border-amber-300 rounded px-2.5 py-1 text-xs text-slate-900 focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = report.recomendacoesPersonalizadas.filter((_, i) => i !== idx);
                            setReport({ ...report, recomendacoesPersonalizadas: copy });
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fechamento das Recomendações */}
              <div className="space-y-1.5 text-xs pt-1">
                <label className="block font-semibold text-slate-800">
                  Frase de Fechamento das Recomendações:
                </label>
                <input
                  type="text"
                  value={
                    report.fechamentoRecomendacoesPersonalizado ??
                    (report.modeloTextos.fechamentoRecomendacoes ||
                      'Fazer a correção de todos os itens apontados neste relatório, de forma ao sistema operar em sua perfeita harmonia.')
                  }
                  onChange={(e) => setReport({ ...report, fechamentoRecomendacoesPersonalizado: e.target.value })}
                  placeholder="Frase final do capítulo 7 de recomendações..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-medium focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* SEÇÃO 8: PARECER TÉCNICO CONCLUSIVO & DISPOSIÇÕES FINAIS */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    8) Conclusão, Parecer Técnico Pericial &amp; Disposições Finais
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Parecer conclusivo do engenheiro responsável quanto à conformidade com a NBR 5419:2026.
                  </p>
                </div>

                {/* Modelos rápidos de trechos */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[10.5px] font-bold text-slate-500">Modelos Prontos:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setReport({
                        ...report,
                        conclusaoPersonalizada:
                          'Conforme descrito no decorrer deste relatório e avaliações em campo, concluímos que as áreas inspecionadas encontram-se em condições técnicas adequadas e plenamente satisfatórias no que se refere ao Sistema de Proteção Contra Descargas Atmosféricas (SPDA) conforme preconizado pela norma NBR 5419:2026, quanto aos aspectos de instalação, continuidade e segurança.',
                      })
                    }
                    className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10.5px] font-semibold transition-colors"
                    title="Inserir parecer de laudo aprovado sem pendências"
                  >
                    ✓ Aprovado / Conforme
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReport({
                        ...report,
                        conclusaoPersonalizada:
                          'Conforme descrito no decorrer deste relatório, excluindo-se as observações efetuadas e defeitos pontuais registrados neste documento, podemos concluir que as áreas inspecionadas atendem satisfatoriamente aos requisitos da NBR 5419:2026, condicionando-se a conformidade plena à execução imediata das recomendações prioritárias apontadas no capítulo 7.',
                      })
                    }
                    className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-[10.5px] font-semibold transition-colors"
                    title="Inserir parecer com ressalvas/adequações pendentes"
                  >
                    ⚠ Com Ressalvas
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReport({
                        ...report,
                        conclusaoPersonalizada:
                          'Diante das inconformidades críticas verificadas nas vistorias e ausência de continuidade e proteção adequada, concluímos que o sistema de SPDA existente NÃO se encontra em condições satisfatórias de operação conforme a NBR 5419:2026, exigindo intervenção técnica emergencial de reforma para mitigar riscos de queima de equipamentos e danos às estruturas e ocupantes.',
                      })
                    }
                    className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-[10.5px] font-semibold transition-colors"
                    title="Inserir parecer desfavorável/reprovado"
                  >
                    ✕ Reprovado
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReport({
                        ...report,
                        conclusaoPersonalizada: DEFAULT_FIXED_TEXTS.conclusaoFinal,
                      })
                    }
                    className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 text-[10.5px] font-semibold transition-colors"
                    title="Inserir parecer padrão original da norma"
                  >
                    ↺ Padrão NBR 5419
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-800">Título da Seção 8:</label>
                <input
                  type="text"
                  value={
                    report.modeloTextos.tituloSecao8 ??
                    '8) CONCLUSÃO & PARECER TÉCNICO PERICIAL'
                  }
                  onChange={(e) =>
                    setReport({
                      ...report,
                      modeloTextos: { ...report.modeloTextos, tituloSecao8: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Textarea do Parecer Principal */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-800">
                  Parecer Técnico Principal (Conclusão Geral):
                </label>
                <textarea
                  rows={4}
                  value={report.conclusaoPersonalizada ?? report.modeloTextos.conclusaoFinal}
                  onChange={(e) => setReport({ ...report, conclusaoPersonalizada: e.target.value })}
                  placeholder="Digite aqui o parecer técnico pericial..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Parecer sobre a ART */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-800">
                  Parecer referente à ART &amp; Responsabilidade Técnica:
                </label>
                <textarea
                  rows={2}
                  value={
                    report.parecerArtPersonalizado ??
                    (report.modeloTextos.parecerArt ||
                      'Por fim, concluo que as malhas de aterramento e as malhas superiores do sistema de proteção contra descargas atmosféricas em análise atendem aos requisitos dos projetos executivos e normas vigentes citadas no item 01 deste relatório. Este é meu parecer técnico emitido sob a ART em anexo.')
                  }
                  onChange={(e) => setReport({ ...report, parecerArtPersonalizado: e.target.value })}
                  placeholder="Declaração técnica referente à ART..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Disposições Finais & Validade */}
              <div className="space-y-2 text-xs">
                <label className="block font-semibold text-slate-800">
                  Título &amp; Texto de Disposições Finais e Validade da Inspeção:
                </label>
                <input
                  type="text"
                  value={
                    report.modeloTextos.tituloDisposicoesFinais ??
                    'DISPOSIÇÕES FINAIS & VALIDADE DA INSPEÇÃO:'
                  }
                  onChange={(e) =>
                    setReport({
                      ...report,
                      modeloTextos: {
                        ...report.modeloTextos,
                        tituloDisposicoesFinais: e.target.value,
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900"
                />
                <textarea
                  rows={2}
                  value={report.disposicoesFinaisPersonalizada ?? report.modeloTextos.disposicoesFinais}
                  onChange={(e) => setReport({ ...report, disposicoesFinaisPersonalizada: e.target.value })}
                  placeholder="Ex: Validade de 1 ano conforme NBR 5419-3:2026..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* SEÇÃO 4: RESPONSABILIDADE TÉCNICA & ASSINATURA */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    Responsabilidade Técnica &amp; Assinatura Digital
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dados do Engenheiro e assinatura eletrônica/digitalizada exibida no final do laudo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSignatureOpen(true)}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
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
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
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
                    className="text-xs text-red-600 hover:underline font-medium"
                  >
                    Remover Assinatura
                  </button>
                </div>
              )}
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
                  onClick={() => setIsAdminTemplateOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Editar cabeçalho, rodapé e logotipo do laudo"
                >
                  <Settings className="w-4 h-4 text-slate-600" />
                  Cabeçalho, Rodapé &amp; Logo
                </button>
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
                  onClick={() => setIsSendReportOpen(true)}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Enviar laudo em PDF para cliente via WhatsApp, E-mail ou baixar"
                >
                  <Send className="w-4 h-4" />
                  Enviar / Exportar PDF
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

      <SendReportModal
        isOpen={isSendReportOpen}
        onClose={() => setIsSendReportOpen(false)}
        report={report}
        onOpenR2Sync={() => setIsR2ModalOpen(true)}
        onTriggerBrowserPrint={() => {
          setActiveTab('preview');
          setTimeout(() => window.print(), 300);
        }}
      />

      <OfflineIndicator />
    </div>
  );
}

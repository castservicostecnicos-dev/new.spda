/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SpdaReport } from '../types/spda';
import {
  Send,
  Share2,
  FileDown,
  FileText,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Mail,
  Loader2,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  generateReportPdfBlob,
  getReportFileName,
  downloadPdfBlob,
  PdfExportProgress,
} from '../services/pdfExporter';
import { exportReportToDocx } from '../services/docxExporter';

interface SendReportModalProps {
  report: SpdaReport;
  isOpen: boolean;
  onClose: () => void;
  onOpenR2Sync?: () => void;
  onTriggerBrowserPrint?: () => void;
}

export const SendReportModal: React.FC<SendReportModalProps> = ({
  report,
  isOpen,
  onClose,
  onOpenR2Sync,
  onTriggerBrowserPrint,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfExportProgress | null>(null);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [docxStatus, setDocxStatus] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const condoName = report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Condomínio';
  const emissionDate = report.responsavelTecnico.dataEmissao || new Date().toLocaleDateString('pt-BR');
  const pdfFileName = getReportFileName(report, 'pdf');
  const docxFileName = getReportFileName(report, 'docx');

  // Total photos count
  let totalPhotos = 0;
  report.torres.forEach((t) => {
    totalPhotos += t.fotosEnsaio.length + t.fotosSpda.length + t.fotosQuadros.length;
  });
  if (report.areaComum.habilitada) {
    totalPhotos += report.areaComum.fotosSpda.length + report.areaComum.fotosQuadros.length;
  }

  // Pre-composed professional text message for sharing
  const shareText = `*LAUDO TÉCNICO PERICIAL DE SPDA (NBR 5419:2026)*\n` +
    `Edificação: *${condoName}*\n` +
    `Data de Emissão: ${emissionDate}\n` +
    `Responsável Técnico: ${report.responsavelTecnico.responsavelTecnico} (${report.responsavelTecnico.registroCrea})\n` +
    `ART: ${report.responsavelTecnico.numeroArt || 'Emissão vinculada'}\n` +
    `Status: Inspeção pericial concluída e documentada.`;

  // 1. Share or Send PDF via Web Share API or Direct Download
  const handleSendPdf = async () => {
    setIsGeneratingPdf(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const pdfBlob = await generateReportPdfBlob(report, (prog) => {
        setPdfProgress(prog);
      });

      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // Check if navigator.share supports file sharing (Mobile Android / iOS)
      if (
        navigator.canShare &&
        navigator.canShare({ files: [pdfFile] }) &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      ) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `Laudo SPDA - ${condoName}`,
            text: shareText,
          });
          setSuccessMessage('Laudo em PDF compartilhado com sucesso!');
        } catch (shareErr: any) {
          if (shareErr.name !== 'AbortError') {
            // User did not simply cancel the share sheet; fallback to download
            downloadPdfBlob(pdfBlob, pdfFileName);
            setSuccessMessage('Arquivo PDF baixado no dispositivo!');
          }
        }
      } else {
        // Desktop or browsers without file share: Download directly
        downloadPdfBlob(pdfBlob, pdfFileName);
        setSuccessMessage('Arquivo PDF baixado com sucesso! Você pode enviá-lo pelo WhatsApp ou E-mail.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar PDF para envio:', err);
      setErrorMessage(
        err.message || 'Erro ao gerar o arquivo PDF. Verifique se o laudo está carregado na tela.'
      );
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // 2. Direct WhatsApp Web / App share
  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(
      `${shareText}\n\nO documento oficial em PDF foi gerado e está disponível para download e conferência técnica.`
    );
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // 3. Direct Email client compose
  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Laudo Técnico Pericial de SPDA - ${condoName}`);
    const body = encodeURIComponent(
      `Prezados,\n\nSegue a emissão do Laudo Técnico Pericial de SPDA conforme norma ABNT NBR 5419:2026.\n\n` +
      `Edificação: ${condoName}\n` +
      `Local: ${report.cliente.local} - ${report.cliente.municipioUf}\n` +
      `Responsável Técnico: ${report.responsavelTecnico.responsavelTecnico} (${report.responsavelTecnico.registroCrea})\n` +
      `ART: ${report.responsavelTecnico.numeroArt}\n\n` +
      `O documento completo e autenticado foi emitido e anexado.\n\nAtenciosamente,\n${report.empresa.nome}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // 4. Download Docx
  const handleExportDocx = async () => {
    setIsGeneratingDocx(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await exportReportToDocx(report, (msg) => {
        setDocxStatus(msg);
      });
      setSuccessMessage('Laudo editável em Word (.docx) baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao exportar Word:', err);
      setErrorMessage(err.message || 'Erro ao gerar documento Word.');
    } finally {
      setIsGeneratingDocx(false);
      setDocxStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Exportar &amp; Enviar Laudo Técnico</h2>
              <p className="text-[11px] text-slate-400">
                Gere o arquivo PDF oficial para envio direto ao cliente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Report Overview Box */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Building2 className="w-4 h-4 text-red-600" />
            <span>{condoName}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 text-[11px]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {emissionDate}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              {report.torres.length} torre(s) • {totalPhotos} fotos registradas
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status feedback */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progress loader */}
          {isGeneratingPdf && (
            <div className="p-4 bg-red-50/60 border border-red-200 rounded-xl text-center space-y-2">
              <Loader2 className="w-6 h-6 text-red-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-900">
                {pdfProgress?.status || 'Compilando arquivo PDF em alta resolução...'}
              </p>
              {pdfProgress && (
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-red-600 h-full transition-all duration-300"
                    style={{
                      width: `${(pdfProgress.currentPage / pdfProgress.totalPages) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Primary Action: Send / Download PDF */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              1. Envio em Arquivo PDF (Recomendado)
            </span>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleSendPdf}
              className="w-full p-3.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer group"
            >
              <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              <span>
                {isGeneratingPdf
                  ? 'Gerando arquivo PDF...'
                  : 'Enviar / Baixar Laudo em PDF'}
              </span>
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Gera o arquivo <span className="font-mono font-semibold">{pdfFileName}</span> pronto para envio, sem abrir a impressora.
            </p>
          </div>

          {/* Quick Sharing Channels */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Enviar via WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleShareEmail}
              className="p-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <Mail className="w-4 h-4" />
              <span>Enviar por E-mail</span>
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Outros Formatos &amp; Nuvem
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Word DOCX */}
              <button
                type="button"
                disabled={isGeneratingDocx}
                onClick={handleExportDocx}
                className="p-2.5 border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                title="Gera o arquivo Word idêntico ao laudo do app para edições finais"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>
                  {isGeneratingDocx
                    ? docxStatus || 'Gerando Word...'
                    : 'Baixar Word (.docx)'}
                </span>
              </button>

              {/* Optional Physical Print */}
              {onTriggerBrowserPrint && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTriggerBrowserPrint();
                  }}
                  className="p-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  title="Abrir diálogo de impressão do navegador"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Imprimir em Papel</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

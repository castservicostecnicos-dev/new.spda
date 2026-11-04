/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SpdaReport } from '../types/spda';
import {
  getAllReportsFromDb,
  deleteReportFromDb,
  saveReportToDb,
  checkReportNameExists,
} from '../services/storage';
import {
  FolderArchive,
  Building,
  Calendar,
  Layers,
  Camera,
  Trash2,
  Copy,
  ExternalLink,
  Plus,
  X,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface ReportsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentReportId: string;
  onSelectReport: (report: SpdaReport) => void;
  onOpenCreateNew: () => void;
}

export const ReportsManagerModal: React.FC<ReportsManagerModalProps> = ({
  isOpen,
  onClose,
  currentReportId,
  onSelectReport,
  onOpenCreateNew,
}) => {
  const [reports, setReports] = useState<SpdaReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const list = await getAllReportsFromDb();
      // Sort newest first
      list.sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
      setReports(list);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAll();
      setActionMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredReports = reports.filter((r) => {
    const term = searchQuery.toLowerCase();
    const nome = (r.cliente.nomeEmpreendimento || r.cliente.cliente || '').toLowerCase();
    const cidade = (r.cliente.municipioUf || '').toLowerCase();
    return nome.includes(term) || cidade.includes(term);
  });

  const handleDuplicate = async (sourceReport: SpdaReport) => {
    const originalName = sourceReport.cliente.nomeEmpreendimento || sourceReport.cliente.cliente;
    const newName = prompt(
      `Informe o nome do novo condomínio para a cópia do laudo:\n(Original: ${originalName})`,
      `${originalName} (Cópia)`
    );

    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();

    const exists = await checkReportNameExists(trimmed);
    if (exists) {
      alert(`Já existe um laudo cadastrado com o nome "${trimmed}". Escolha outro nome.`);
      return;
    }

    const newId = `laudo-${Date.now()}`;
    const duplicate: SpdaReport = {
      ...sourceReport,
      id: newId,
      titulo: `Laudo Técnico SPDA - ${trimmed}`,
      criadoEm: Date.now(),
      atualizadoEm: Date.now(),
      cliente: {
        ...sourceReport.cliente,
        cliente: trimmed,
        nomeEmpreendimento: trimmed,
      },
    };

    await saveReportToDb(duplicate);
    await loadAll();
    setActionMessage(`Laudo duplicado com sucesso para "${trimmed}"!`);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleDelete = async (reportId: string, nomeCondominio: string) => {
    if (reports.length <= 1) {
      alert('Não é possível excluir o único laudo existente no sistema.');
      return;
    }

    if (
      !confirm(
        `Tem certeza que deseja excluir permanentemente o laudo de "${nomeCondominio}"?\nEsta ação não poderá ser desfeita.`
      )
    ) {
      return;
    }

    await deleteReportFromDb(reportId);
    if (reportId === currentReportId) {
      // Find another report to activate
      const remaining = reports.filter((r) => r.id !== reportId);
      if (remaining.length > 0) {
        onSelectReport(remaining[0]);
      }
    }
    await loadAll();
    setActionMessage(`Laudo de "${nomeCondominio}" excluído.`);
    setTimeout(() => setActionMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Gerenciador de Laudos SPDA</h2>
              <p className="text-[11px] text-slate-400">
                Selecione um laudo salvo para abrir e editar novamente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateNew();
              }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Laudo</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-4 py-2 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionMessage}</span>
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome do condomínio ou cidade..."
            className="w-full sm:w-80 border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-xs text-slate-800 focus:outline-hidden focus:border-red-600"
          />
          <div className="text-slate-600 font-medium text-[11px]">
            Total de {reports.length} laudo{reports.length !== 1 ? 's' : ''} salvo{reports.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Reports List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Carregando laudos salvos...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs space-y-2">
              <p>Nenhum laudo encontrado.</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateNew();
                }}
                className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Criar Primeiro Laudo
              </button>
            </div>
          ) : (
            filteredReports.map((r) => {
              const isCurrent = r.id === currentReportId;
              const nomeCond = r.cliente.nomeEmpreendimento || r.cliente.cliente || 'Sem nome';
              
              // Count photos
              let countPhotos = 0;
              r.torres?.forEach((t) => {
                countPhotos += (t.fotosEnsaio?.length || 0) + (t.fotosSpda?.length || 0) + (t.fotosQuadros?.length || 0);
              });
              if (r.areaComum?.habilitada) {
                countPhotos += (r.areaComum.fotosSpda?.length || 0) + (r.areaComum.fotosQuadros?.length || 0);
              }

              const dataAtualizado = r.atualizadoEm
                ? new Date(r.atualizadoEm).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                : '—';

              return (
                <div
                  key={r.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isCurrent
                      ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-red-600 shrink-0" />
                        <h3 className="font-bold text-sm text-slate-900">{nomeCond}</h3>
                        {isCurrent && (
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Em Edição
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Emissão: {r.responsavelTecnico?.dataEmissao || '—'}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.torres?.length || 0} Torre(s)</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-slate-400" />
                          <span>{countPhotos} Fotos</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Atualizado: {dataAtualizado}</span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectReport(r);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isCurrent
                            ? 'bg-slate-900 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isCurrent ? 'Continuar Editando' : 'Abrir para Edição'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(r)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Duplicar este laudo com outro nome de condomínio"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(r.id, nomeCond)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir este laudo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <p className="text-[11px]">
            Todas as alterações de textos, fotos e medições são salvas no banco de dados local do seu navegador.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SpdaReport, Tower } from '../types/spda';
import { createInitialReport } from '../data/defaultReport';
import { checkReportNameExists, saveReportToDb } from '../services/storage';
import { Building2, Calendar, Layers, X, AlertTriangle, Plus, Check } from 'lucide-react';

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportCreated: (newReport: SpdaReport) => void;
}

export const CreateReportModal: React.FC<CreateReportModalProps> = ({
  isOpen,
  onClose,
  onReportCreated,
}) => {
  const getTodayFormatted = () => {
    const today = new Date();
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${today.getDate()} de ${meses[today.getMonth()]} de ${today.getFullYear()}`;
  };

  const [nomeCondominio, setNomeCondominio] = useState('');
  const [dataEmissao, setDataEmissao] = useState(getTodayFormatted());
  const [quantidadeTorres, setQuantidadeTorres] = useState(1);
  const [temAreaComum, setTemAreaComum] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedNome = nomeCondominio.trim();
    if (!trimmedNome) {
      setErrorMessage('Por favor, informe o nome do condomínio / empreendimento.');
      return;
    }

    if (!dataEmissao.trim()) {
      setErrorMessage('Por favor, informe a data de emissão do laudo.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Regra obrigatória: não pode ter condomínios com o mesmo nome
      const exists = await checkReportNameExists(trimmedNome);
      if (exists) {
        setErrorMessage(
          `Já existe um laudo cadastrado para "${trimmedNome}". Não é permitido duplicidade de condomínios. Por favor, utilize um nome distinto.`
        );
        setIsSubmitting(false);
        return;
      }

      // Cria a estrutura padrão a partir do modelo de referência oficial
      const base = createInitialReport();
      const reportId = `laudo-${Date.now()}`;

      // Configura torres
      const novasTorres: Tower[] = [];
      const numTorres = Math.max(1, Math.min(20, quantidadeTorres));
      for (let i = 1; i <= numTorres; i++) {
        novasTorres.push({
          id: `t-${reportId}-${i}`,
          nome: `Torre ${i}`,
          numeroOrdem: i,
          fotosEnsaio: [],
          fotosSpda: [],
          fotosQuadros: [],
        });
      }

      const newReport: SpdaReport = {
        ...base,
        id: reportId,
        titulo: `Laudo Técnico SPDA - ${trimmedNome}`,
        criadoEm: Date.now(),
        atualizadoEm: Date.now(),
        cliente: {
          ...base.cliente,
          cliente: trimmedNome,
          nomeEmpreendimento: trimmedNome,
          quantidadeTorres: numTorres,
          temAreaComum: temAreaComum,
        },
        responsavelTecnico: {
          ...base.responsavelTecnico,
          dataEmissao: dataEmissao.trim(),
        },
        torres: novasTorres,
        areaComum: {
          ...base.areaComum,
          habilitada: temAreaComum,
          fotosSpda: [],
          fotosQuadros: [],
        },
        edificacao: {
          ...base.edificacao,
          fotoAereaUrl: undefined,
          fotoFachadaUrl: undefined,
        },
      };

      // Salva imediatamente no banco de dados local
      await saveReportToDb(newReport);
      onReportCreated(newReport);
      onClose();
      // Reset form
      setNomeCondominio('');
      setDataEmissao(getTodayFormatted());
      setQuantidadeTorres(1);
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao salvar o novo laudo no banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Criar Novo Laudo SPDA</h2>
              <p className="text-[11px] text-slate-400">
                Cadastro inicial do condomínio e data de emissão
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-[11.5px] font-medium leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Nome do Condomínio */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-red-600" />
              <span>Nome do Condomínio / Empreendimento *</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nomeCondominio}
              onChange={(e) => {
                setNomeCondominio(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Ex: Condomínio Residencial Vista Bela"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
            <p className="text-[10.5px] text-slate-500 mt-1">
              O nome precisa ser exclusivo. Não é permitido criar mais de um laudo com o mesmo nome de condomínio.
            </p>
          </div>

          {/* Data de Emissão */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-red-600" />
              <span>Data de Emissão do Laudo *</span>
            </label>
            <input
              type="text"
              required
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              placeholder="Ex: 04 de Novembro de 2026"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium focus:outline-hidden focus:border-red-600"
            />
          </div>

          {/* Quantidade de Torres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-red-600" />
                <span>Quantidade de Torres</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={quantidadeTorres}
                  onChange={(e) => setQuantidadeTorres(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-center text-slate-900 focus:outline-hidden focus:border-red-600"
                />
                <span className="text-[11px] text-slate-500">
                  (Criará Torre 1 a Torre {quantidadeTorres})
                </span>
              </div>
            </div>

            {/* Área Comum */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 p-2.5 rounded-lg hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={temAreaComum}
                  onChange={(e) => setTemAreaComum(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-600 w-4 h-4"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Incluir Área Comum</span>
                  <span className="text-[10px] text-slate-500 block">
                    Vistoria de SPDA e quadros da guarita/lazer
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Modelo Técnico Padronizado</span>
            </div>
            <p>
              O novo laudo será iniciado automaticamente com a estrutura pericial completa da norma ABNT NBR 5419:2026, com todos os textos técnicos, critérios e paginação A4.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Iniciar e Salvar Laudo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

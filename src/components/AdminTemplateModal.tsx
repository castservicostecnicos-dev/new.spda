/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FixedTextsTemplate, CompanyProfile } from '../types/spda';
import { DEFAULT_FIXED_TEXTS, DEFAULT_COMPANY } from '../data/defaultReport';
import { Settings, Save, RotateCcw, X, Building, BookOpen, AlertCircle, Plus, Trash2 } from 'lucide-react';

interface AdminTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: CompanyProfile;
  modeloTextos: FixedTextsTemplate;
  onSave: (empresa: CompanyProfile, modeloTextos: FixedTextsTemplate) => void;
}

export const AdminTemplateModal: React.FC<AdminTemplateModalProps> = ({
  isOpen,
  onClose,
  empresa,
  modeloTextos,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'empresa' | 'textos' | 'normas' | 'dicionario'>('empresa');
  const [tempEmpresa, setTempEmpresa] = useState<CompanyProfile>({ ...empresa });
  const [tempTextos, setTempTextos] = useState<FixedTextsTemplate>({ ...modeloTextos });

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTempEmpresa((prev) => ({ ...prev, logoUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleResetDefaults = () => {
    if (confirm('Tem certeza de que deseja restaurar os textos fixos e dados padrão da SJC Engenharia?')) {
      setTempEmpresa({ ...DEFAULT_COMPANY });
      setTempTextos({ ...DEFAULT_FIXED_TEXTS });
    }
  };

  const handleSaveAll = () => {
    onSave(tempEmpresa, tempTextos);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-slate-700" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Gerenciar Modelo do Laudo (Administrativo)
              </h3>
              <p className="text-xs text-slate-500">
                Configuração dos Textos Fixos da NBR 5419:2026 e Dados Institucionais da Empresa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('empresa')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'empresa'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            Empresa &amp; Cabeçalho
          </button>
          <button
            onClick={() => setActiveTab('textos')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'textos'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Textos Fixos (Capa &amp; Introdução)
          </button>
          <button
            onClick={() => setActiveTab('normas')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'normas'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Normas Vigentes
          </button>
          <button
            onClick={() => setActiveTab('dicionario')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'dicionario'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Dicionário Técnico &amp; CREA
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'empresa' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome da Empresa</label>
                  <input
                    type="text"
                    value={tempEmpresa.nome}
                    onChange={(e) => setTempEmpresa({ ...tempEmpresa, nome: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CNPJ da Empresa</label>
                  <input
                    type="text"
                    value={tempEmpresa.cnpj}
                    onChange={(e) => setTempEmpresa({ ...tempEmpresa, cnpj: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone de Contato</label>
                  <input
                    type="text"
                    value={tempEmpresa.telefone}
                    onChange={(e) => setTempEmpresa({ ...tempEmpresa, telefone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={tempEmpresa.endereco}
                    onChange={(e) => setTempEmpresa({ ...tempEmpresa, endereco: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cidade e UF</label>
                  <input
                    type="text"
                    value={tempEmpresa.cidadeUf}
                    onChange={(e) => setTempEmpresa({ ...tempEmpresa, cidadeUf: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Texto da Marca d'Água</label>
                  <input
                    type="text"
                    value={tempEmpresa.marcaDaguaTexto}
                    onChange={(e) => setTempEmpresa({ ...tempEmpresa, marcaDaguaTexto: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Logo customization */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Logotipo Personalizado (opcional - padrão: SJC Engenharia &amp; Soluções)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {tempEmpresa.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setTempEmpresa({ ...tempEmpresa, logoUrl: undefined })}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Restaurar Logotipo SJC
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'textos' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Objeto da Inspeção (Texto Fixo da Capa)
                </label>
                <textarea
                  rows={2}
                  value={tempTextos.objetoInspecao}
                  onChange={(e) => setTempTextos({ ...tempTextos, objetoInspecao: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  1.1) Objetivo do Laudo e Conformidade
                </label>
                <textarea
                  rows={2}
                  value={tempTextos.introducao11}
                  onChange={(e) => setTempTextos({ ...tempTextos, introducao11: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  1.4) Funções do SPDA Externo (NBR 5419-1:2026 Item 9.4.1.2)
                </label>
                {tempTextos.funcoesSpda.map((fn, idx) => (
                  <div key={idx} className="flex gap-2 items-center mb-1.5">
                    <span className="font-bold text-slate-500">
                      {String.fromCharCode(97 + idx)})
                    </span>
                    <input
                      type="text"
                      value={fn}
                      onChange={(e) => {
                        const copy = [...tempTextos.funcoesSpda];
                        copy[idx] = e.target.value;
                        setTempTextos({ ...tempTextos, funcoesSpda: copy });
                      }}
                      className="w-full border border-slate-300 rounded-md p-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Conclusão Final Padrão
                </label>
                <textarea
                  rows={3}
                  value={tempTextos.conclusaoFinal}
                  onChange={(e) => setTempTextos({ ...tempTextos, conclusaoFinal: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Disposições Finais &amp; Validade da Inspeção
                </label>
                <textarea
                  rows={2}
                  value={tempTextos.disposicoesFinais}
                  onChange={(e) =>
                    setTempTextos({ ...tempTextos, disposicoesFinais: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'normas' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700">
                  Referências Normativas Aplicáveis (NBR 5419:2026 e correlatas)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTempTextos({
                      ...tempTextos,
                      referenciasNormativas: [...tempTextos.referenciasNormativas, ''],
                    })
                  }
                  className="text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Norma
                </button>
              </div>

              {tempTextos.referenciasNormativas.map((norma, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={norma}
                    onChange={(e) => {
                      const updated = [...tempTextos.referenciasNormativas];
                      updated[idx] = e.target.value;
                      setTempTextos({ ...tempTextos, referenciasNormativas: updated });
                    }}
                    className="flex-1 border border-slate-300 rounded-md p-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = tempTextos.referenciasNormativas.filter((_, i) => i !== idx);
                      setTempTextos({ ...tempTextos, referenciasNormativas: updated });
                    }}
                    className="text-slate-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dicionario' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">
                    Termos do Dicionário Técnico &amp; Abreviaturas
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTempTextos({
                        ...tempTextos,
                        dicionario: [
                          ...tempTextos.dicionario,
                          { termo: 'NOVO TERMO', definicao: 'Definição técnica' },
                        ],
                      })
                    }
                    className="text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Termo
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {tempTextos.dicionario.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start border border-slate-200 p-2 rounded-md bg-slate-50/50">
                      <input
                        type="text"
                        value={item.termo}
                        onChange={(e) => {
                          const copy = [...tempTextos.dicionario];
                          copy[idx] = { ...copy[idx], termo: e.target.value };
                          setTempTextos({ ...tempTextos, dicionario: copy });
                        }}
                        className="w-1/3 border border-slate-300 rounded p-1 text-xs font-bold"
                        placeholder="Termo"
                      />
                      <input
                        type="text"
                        value={item.definicao}
                        onChange={(e) => {
                          const copy = [...tempTextos.dicionario];
                          copy[idx] = { ...copy[idx], definicao: e.target.value };
                          setTempTextos({ ...tempTextos, dicionario: copy });
                        }}
                        className="flex-1 border border-slate-300 rounded p-1 text-xs"
                        placeholder="Definição"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const copy = tempTextos.dicionario.filter((_, i) => i !== idx);
                          setTempTextos({ ...tempTextos, dicionario: copy });
                        }}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nota Obrigatória CREA / Habilitação Legal
                </label>
                <textarea
                  rows={2}
                  value={tempTextos.notaCrea}
                  onChange={(e) => setTempTextos({ ...tempTextos, notaCrea: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrões da Referência
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações no Modelo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SpdaReport } from '../types/spda';
import {
  CloudflareR2Config,
  loadR2Config,
  saveR2Config,
  testR2Connection,
  syncReportToCloudflareR2,
  downloadR2FolderStructureZip,
} from '../services/cloudflareR2';
import {
  Cloud,
  FolderTree,
  FileText,
  Key,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  UploadCloud,
  X,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';

interface CloudflareR2ModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SpdaReport;
  onSyncComplete?: (message: string) => void;
}

export const CloudflareR2Modal: React.FC<CloudflareR2ModalProps> = ({
  isOpen,
  onClose,
  report,
  onSyncComplete,
}) => {
  const [config, setConfig] = useState<CloudflareR2Config>(() => loadR2Config());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [copiedCors, setCopiedCors] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadR2Config());
      setTestResult(null);
      setSyncProgress(null);
      setSyncSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const condoName = report.cliente.nomeEmpreendimento || report.cliente.cliente || 'Condominio';
  const isSingleTower = report.torres.length === 1;

  const handleSaveConfig = () => {
    saveR2Config(config);
    setTestResult({
      success: true,
      message: 'Configurações do Cloudflare R2 salvas localmente!',
    });
  };

  const handleTestConnection = async () => {
    saveR2Config(config);
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testR2Connection(config);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erro ao conectar no bucket Cloudflare R2.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleStartSync = async () => {
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      alert('Por favor preencha as credenciais do Cloudflare R2 antes de sincronizar.');
      return;
    }

    saveR2Config(config);
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    setTestResult(null);

    try {
      const res = await syncReportToCloudflareR2(report, config, (current, total, label) => {
        setSyncProgress({ current, total, label });
      });

      const successMsg = `Sincronização concluída com sucesso! ${res.totalUploaded} arquivos foram enviados para a pasta "${res.condoFolder}/" no bucket "${config.bucketName}".`;
      setSyncSuccessMessage(successMsg);
      if (onSyncComplete) {
        onSyncComplete(successMsg);
      }
    } catch (err: any) {
      console.error('Erro na sincronização com R2:', err);
      let errMsg = err.message || 'Falha ao sincronizar com Cloudflare R2.';
      if (err.name === 'TypeError' && err.message?.includes('Failed to fetch')) {
        errMsg =
          'Erro de conexão/CORS com o Cloudflare R2. Adicione uma regra CORS no bucket do R2 permitindo esta aplicação. Consulte a aba de instruções abaixo.';
      }
      alert(errMsg);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleDownloadZipFallback = async () => {
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 1, label: 'Gerando estrutura de pastas do R2 em arquivo ZIP...' });
    try {
      await downloadR2FolderStructureZip(report, (current, total, label) => {
        setSyncProgress({ current, total, label });
      });
      setSyncSuccessMessage('Estrutura de pastas do R2 baixada em formato ZIP com sucesso!');
    } catch (err: any) {
      alert('Erro ao gerar arquivo ZIP: ' + err.message);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const corsPolicyJson = JSON.stringify(
    [
      {
        AllowedOrigins: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000,
      },
    ],
    null,
    2
  );

  const handleCopyCors = () => {
    navigator.clipboard.writeText(corsPolicyJson);
    setCopiedCors(true);
    setTimeout(() => setCopiedCors(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 text-xs">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Sincronização Cloudflare R2</h2>
                <span className="text-[10px] bg-orange-600/30 text-orange-300 border border-orange-500/40 px-1.5 py-0.5 rounded font-mono font-semibold">
                  Pages &amp; Storage
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Armazene laudos em .docx e fotos originais organizadas por pastas no bucket R2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"
              title="Ajuda e Instruções de Configuração"
            >
              <HelpCircle className="w-5 h-5" />
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Success Banner */}
          {syncSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs">Sincronização com Cloudflare R2 Concluída!</h4>
                <p className="text-[11.5px] mt-0.5 leading-relaxed">{syncSuccessMessage}</p>
              </div>
            </div>
          )}

          {/* Test Result Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="text-[11.5px] font-medium leading-relaxed">
                {testResult.message}
              </div>
            </div>
          )}

          {/* Sync Progress Bar */}
          {syncProgress && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-800 text-xs">
                <span className="flex items-center gap-1.5 text-orange-700">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Sincronizando com Cloudflare R2...
                </span>
                {syncProgress.total > 0 && (
                  <span className="font-mono text-[11px] text-slate-600">
                    {syncProgress.current} de {syncProgress.total} ({Math.round((syncProgress.current / syncProgress.total) * 100)}%)
                  </span>
                )}
              </div>
              {syncProgress.total > 0 && (
                <div className="w-full bg-orange-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-600 h-full transition-all duration-200"
                    style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                  />
                </div>
              )}
              <p className="text-[11px] text-slate-600 truncate font-mono">
                {syncProgress.label}
              </p>
            </div>
          )}

          {/* Folder Hierarchy Visualizer (Exact User Requirement) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <FolderTree className="w-4 h-4 text-orange-600" />
                <span>Estrutura de Pastas no Bucket do R2 ({isSingleTower ? '1 Torre' : `${report.torres.length} Torres`})</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Criada automaticamente no envio
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-700 space-y-1 overflow-x-auto">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>📁 {condoName}/</span>
              </div>
              <div className="pl-4 text-blue-700 font-medium">
                📄 {condoName} - Laudo Tecnico SPDA.docx
              </div>
              <div className="pl-4 text-slate-500">
                📄 laudo.json (metadados e backup completo)
              </div>

              {isSingleTower ? (
                <>
                  <div className="pl-4 text-emerald-800 font-semibold">📁 SPDA existente/</div>
                  <div className="pl-8 text-slate-400">└─ [fotos_captores_descidas.jpg]</div>
                  <div className="pl-4 text-emerald-800 font-semibold">📁 Quadros/</div>
                  <div className="pl-8 text-slate-400">└─ [fotos_quadros_dps.jpg]</div>
                  <div className="pl-4 text-emerald-800 font-semibold">📁 Pontos de inspeção/</div>
                  <div className="pl-8 text-slate-400">└─ [fotos_ensaio_miliohmimetro.jpg]</div>
                </>
              ) : (
                report.torres.map((t, idx) => (
                  <div key={t.id} className="pl-4 space-y-0.5 pt-1">
                    <div className="font-bold text-slate-800">📁 {t.nome || `Torre ${idx + 1}`}/</div>
                    <div className="pl-4 text-emerald-800 font-semibold">📁 SPDA existente/</div>
                    <div className="pl-4 text-emerald-800 font-semibold">📁 Quadros/</div>
                    <div className="pl-4 text-emerald-800 font-semibold">📁 Pontos de medição/</div>
                  </div>
                ))
              )}

              {report.areaComum.habilitada && (
                <div className="pl-4 space-y-0.5 pt-1">
                  <div className="font-bold text-slate-800">📁 Área Comum/</div>
                  <div className="pl-4 text-emerald-800 font-semibold">📁 SPDA existente/</div>
                  <div className="pl-4 text-emerald-800 font-semibold">📁 Quadros/</div>
                </div>
              )}
            </div>
          </div>

          {/* Credentials Form */}
          <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-600" />
                <span>Credenciais da API S3 / Cloudflare R2</span>
              </h3>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
              >
                Salvar Credenciais
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cloudflare Account ID *
                </label>
                <input
                  type="text"
                  value={config.accountId}
                  onChange={(e) => setConfig({ ...config, accountId: e.target.value })}
                  placeholder="Ex: a1b2c3d4e5f6..."
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome do Bucket R2 *
                </label>
                <input
                  type="text"
                  value={config.bucketName}
                  onChange={(e) => setConfig({ ...config, bucketName: e.target.value })}
                  placeholder="Ex: laudos-spda"
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Access Key ID (Token R2) *
                </label>
                <input
                  type="text"
                  value={config.accessKeyId}
                  onChange={(e) => setConfig({ ...config, accessKeyId: e.target.value })}
                  placeholder="Ex: 8f9a2b1c4d..."
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Secret Access Key *
                </label>
                <input
                  type="password"
                  value={config.secretAccessKey}
                  onChange={(e) => setConfig({ ...config, secretAccessKey: e.target.value })}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 transition-colors text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão R2'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline"
              >
                Como gerar as chaves no Cloudflare?
              </button>
            </div>
          </div>

          {/* Help & Cloudflare Pages Guide */}
          {showHelp && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-[11px] text-slate-700">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-orange-600" />
                <span>Como configurar o Cloudflare R2 e Pages:</span>
              </h4>

              <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                <li>
                  Acesse o painel do <strong>Cloudflare</strong> &gt; <strong>R2 Object Storage</strong> &gt; crie um bucket (ex: <code>laudos-spda</code>).
                </li>
                <li>
                  Em <strong>R2 &gt; Manage R2 API Tokens</strong>, clique em <strong>Create API Token</strong> com permissão <strong>Object Read &amp; Write</strong>.
                </li>
                <li>
                  Copie o <strong>Account ID</strong> (exibido na página do R2), o <strong>Access Key ID</strong> e o <strong>Secret Access Key</strong> para o formulário acima.
                </li>
                <li>
                  <strong>Regra de CORS no Bucket (Essencial para uploads via navegador):</strong> No painel do seu bucket no Cloudflare R2, clique em <strong>Settings &gt; CORS Policy &gt; Edit</strong> e cole a política abaixo:
                </li>
              </ol>

              <div className="relative bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[10px] overflow-x-auto">
                <pre>{corsPolicyJson}</pre>
                <button
                  type="button"
                  onClick={handleCopyCors}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                >
                  {copiedCors ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCors ? 'Copiado!' : 'Copiar CORS'}</span>
                </button>
              </div>

              <div className="pt-1 text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                <strong>Publicação no Cloudflare Pages:</strong> Este aplicativo já está 100% configurado para o Cloudflare Pages.
                Basta conectar seu repositório no Cloudflare Pages com comando de build <code>npm run build</code> e diretório de saída <code>dist</code>. O arquivo <code>_redirects</code> já foi configurado para SPA!
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadZipFallback}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
            title="Gera e baixa um arquivo ZIP contendo exatamente a mesma hierarquia de pastas exigida pelo R2"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Baixar Estrutura R2 (ZIP)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Sincronizar Laudo com R2</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

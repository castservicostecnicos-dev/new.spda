/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Smartphone, X, Share, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Oculta automaticamente quando o app já está rodando instalado em modo standalone
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
        title="Instalar aplicativo no celular ou computador como PWA"
      >
        {isInstallable ? (
          <Download className="w-4 h-4 shrink-0" />
        ) : (
          <Smartphone className="w-4 h-4 shrink-0" />
        )}
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {isIOS ? 'Instalar no iPhone / iPad' : 'Instalar App / Criar Atalho (Chrome)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  No Safari do iPhone/iPad, siga os passos abaixo para adicionar o atalho na tela inicial:
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    Toque no botão <strong>Compartilhar</strong>{' '}
                    <Share className="inline w-3.5 h-3.5 text-blue-600 align-text-bottom" /> na barra do Safari.
                  </li>
                  <li>
                    Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
                  </li>
                  <li>
                    Toque em <strong>Adicionar</strong> no canto superior direito.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Para instalar o <strong>Gerador de Laudos SPDA</strong> como aplicativo no Google Chrome:
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    Abra o endereço do aplicativo diretamente no <strong>Google Chrome</strong> (fora de visualizações embutidas).
                  </li>
                  <li>
                    Toque no menu <strong>⋮</strong>{' '}
                    <MoreVertical className="inline w-3.5 h-3.5 text-slate-600 align-text-bottom" /> no canto superior direito (ou no ícone de instalação na barra de endereços do computador).
                  </li>
                  <li>
                    Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CompanyProfile } from '../types/spda';

interface DocumentFooterProps {
  empresa: CompanyProfile;
  currentPage: number;
  totalPages: number;
}

export const DocumentFooter: React.FC<DocumentFooterProps> = ({
  empresa,
  currentPage,
  totalPages,
}) => {
  return (
    <footer className="relative z-10 w-full mt-auto pt-2 text-[9px] text-slate-800 leading-tight">
      <div className="border-t border-slate-700/80 mb-1.5" />
      <div className="flex items-end justify-between">
        <div className="flex-1 text-center font-bold tracking-tight pr-2">
          <div>
            {empresa.nome} - CNPJ: {empresa.cnpj} – FONE: {empresa.telefone}
          </div>
          <div>
            {empresa.endereco} – {empresa.cidadeUf}
          </div>
        </div>
        <div className="whitespace-nowrap font-medium text-[8.5px] text-slate-600">
          Página {currentPage} de {totalPages}
        </div>
      </div>
    </footer>
  );
};

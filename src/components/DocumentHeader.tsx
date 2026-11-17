/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CompanyProfile } from '../types/spda';
import { CompanyLogo } from './CompanyLogo';

interface DocumentHeaderProps {
  empresa: CompanyProfile;
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({ empresa }) => {
  const linha1 = empresa.cabecalhoLinha1 ?? empresa.nome;
  const linha2 = empresa.cabecalhoLinha2 ?? '';

  return (
    <header className="relative z-10 w-full flex items-center justify-between gap-3 pb-1.5 border-b border-slate-200/80 mb-0.5">
      <div className="flex-1 min-w-0 leading-tight">
        {linha1 && (
          <div className="text-[9.5px] font-extrabold text-slate-800 tracking-tight truncate uppercase">
            {linha1}
          </div>
        )}
        {linha2 && (
          <div className="text-[8px] font-medium text-slate-500 truncate mt-0.5">
            {linha2}
          </div>
        )}
      </div>
      <div className="shrink-0">
        <CompanyLogo customLogoUrl={empresa.logoUrl} height={42} />
      </div>
    </header>
  );
};

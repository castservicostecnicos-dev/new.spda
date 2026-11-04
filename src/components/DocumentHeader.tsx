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
  return (
    <header className="relative z-10 w-full flex items-center justify-end pb-3">
      <CompanyLogo customLogoUrl={empresa.logoUrl} height={44} />
    </header>
  );
};

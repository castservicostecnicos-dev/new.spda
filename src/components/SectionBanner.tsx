/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SectionBannerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SectionBanner: React.FC<SectionBannerProps> = ({
  children,
  className = '',
  size = 'md',
}) => {
  const py = size === 'sm' ? 'py-0.5' : size === 'lg' ? 'py-1.5' : 'py-1';
  const textStyle =
    size === 'sm'
      ? 'text-[10px] font-bold'
      : size === 'lg'
      ? 'text-[12px] font-extrabold'
      : 'text-[10.5px] font-bold';

  return (
    <div
      className={`w-full bg-[#f1f3f6] border border-slate-300/70 rounded-[3px] text-center uppercase tracking-wide text-slate-900 ${py} px-2 mb-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] ${textStyle} ${className}`}
    >
      {children}
    </div>
  );
};

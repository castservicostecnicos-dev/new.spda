/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface DocumentWatermarkProps {
  text?: string;
  opacity?: number;
}

export const DocumentWatermark: React.FC<DocumentWatermarkProps> = ({
  text = 'SPDA 2026',
  opacity = 0.08,
}) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden flex items-center justify-center select-none z-0"
    >
      <div
        className="font-black text-slate-800 tracking-wider whitespace-nowrap transform -rotate-45"
        style={{
          fontSize: '7.5rem',
          opacity: opacity,
          lineHeight: 1,
        }}
      >
        {text}
      </div>
    </div>
  );
};

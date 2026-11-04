/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface CompanyLogoProps {
  customLogoUrl?: string;
  className?: string;
  height?: number;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  customLogoUrl,
  className = '',
  height = 48,
}) => {
  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt="Logotipo da Empresa"
        style={{ height: `${height}px` }}
        className={`object-contain max-w-[200px] ${className}`}
      />
    );
  }

  // Exact vector reproduction of SJC ENGENHARIA & SOLUÇÕES logo from the reference PDF
  return (
    <div
      className={`inline-flex flex-col items-center select-none ${className}`}
      style={{ height: `${height}px`, width: `${height * 2.8}px` }}
    >
      <svg
        viewBox="0 0 240 85"
        className="w-full h-full drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sjcRedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#991b1b" />
            <stop offset="50%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <linearGradient id="sjcMetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2c3038" />
            <stop offset="100%" stopColor="#181a1e" />
          </linearGradient>
          <linearGradient id="silverLetters" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>

        {/* Outer container box */}
        <rect x="2" y="2" width="236" height="81" rx="4" fill="url(#sjcMetalGrad)" stroke="#475569" strokeWidth="1.5" />

        {/* Top Red Header Strip */}
        <path d="M 2 6 Q 2 2 6 2 L 234 2 Q 238 2 238 6 L 238 22 L 2 22 Z" fill="url(#sjcRedGrad)" />
        <text
          x="120"
          y="16"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="1.8"
          textAnchor="middle"
        >
          ENGENHARIA &amp; SOLUÇÕES
        </text>

        {/* Main Stylized SJC text */}
        <g transform="translate(18, 30)">
          {/* Stylized S */}
          <path
            d="M 50 10 C 45 4, 25 3, 15 12 C 5 21, 20 28, 35 32 C 55 36, 52 46, 38 48 C 22 49, 10 44, 5 36 L 15 36 C 18 41, 26 43, 38 42 C 45 41, 46 36, 34 32 C 16 26, 8 20, 18 8 C 28 -2, 50 -1, 58 8 Z"
            fill="url(#silverLetters)"
            stroke="#334155"
            strokeWidth="0.8"
          />
          {/* Stylized J */}
          <path
            d="M 85 2 L 98 2 L 98 34 C 98 44, 90 48, 75 48 C 65 48, 58 43, 56 36 L 68 36 C 69 40, 72 42, 78 42 C 84 42, 86 39, 86 33 L 86 2 Z"
            fill="url(#silverLetters)"
            stroke="#334155"
            strokeWidth="0.8"
          />
          {/* Stylized C */}
          <path
            d="M 155 12 L 145 16 C 142 8, 134 5, 122 5 C 105 5, 100 16, 100 25 C 100 34, 106 45, 124 45 C 135 45, 143 41, 147 34 L 157 37 C 151 47, 139 51, 122 51 C 94 51, 88 35, 88 25 C 88 15, 96 0, 123 0 C 141 0, 152 6, 155 12 Z"
            fill="url(#silverLetters)"
            stroke="#334155"
            strokeWidth="0.8"
          />
        </g>
      </svg>
    </div>
  );
};

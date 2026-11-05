/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SpdaReport, PhotoItem } from '../types/spda';
import { DocumentHeader } from './DocumentHeader';
import { DocumentFooter } from './DocumentFooter';
import { DocumentWatermark } from './DocumentWatermark';
import { SectionBanner } from './SectionBanner';
import { calculateTotalPages } from '../utils/documentPaginator';
import { Smartphone, Monitor } from 'lucide-react';

interface PdfDocumentViewProps {
  report: SpdaReport;
  fotoAereaPreview?: string;
  fotoFachadaPreview?: string;
}

export const PdfDocumentView: React.FC<PdfDocumentViewProps> = ({
  report,
  fotoAereaPreview,
  fotoFachadaPreview,
}) => {
  const { towerPages, totalPages } = calculateTotalPages(report);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(0.5);
  const [isFitToWidth, setIsFitToWidth] = useState<boolean>(true);
  const [customZoom, setCustomZoom] = useState<number | null>(null);

  // Auto-calculate scale on mobile so 794px fits exactly inside mobile screen width without horizontal scroll
  useEffect(() => {
    const updateScale = () => {
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const isSmallScreen = containerWidth < 820;

      if (customZoom !== null) {
        setScale(customZoom);
        return;
      }

      if (isFitToWidth || isSmallScreen) {
        // Reserve 12px margin on mobile screens
        const availableWidth = Math.max(280, containerWidth - 16);
        const a4WidthPx = 794;
        const calculatedScale = Math.min(1.1, availableWidth / a4WidthPx);
        setScale(calculatedScale);
      } else {
        setScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    
    // Also use ResizeObserver for container resizing (e.g. tabs change)
    let ro: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScale());
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      if (ro) ro.disconnect();
    };
  }, [isFitToWidth, customZoom]);

  const a4WidthPx = 794;
  const a4HeightPx = 1123;
  const displayWidth = Math.round(a4WidthPx * scale);
  const displayHeight = Math.round(a4HeightPx * scale);

  // Helper to render a 5-column photo row with maximum usable area
  const renderPhotoRow = (photos: (PhotoItem | null)[], rowIndex: number) => {
    return (
      <div key={rowIndex} className="grid grid-cols-5 gap-1.5 w-full my-0.5">
        {photos.map((photo, colIndex) => {
          if (!photo) {
            // Standardized empty slot: preserved width without stretching other cells!
            return <div key={`empty-${colIndex}`} className="w-full aspect-square" />;
          }

          return (
            <div
              key={photo.id || `photo-${colIndex}`}
              className="flex flex-col items-center w-full"
            >
              {/* Photo Frame - Standard fixed dimension maximizing page area */}
              <div className="w-full aspect-square bg-white border border-slate-300 rounded-[2px] overflow-hidden flex items-center justify-center relative shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                <img
                  src={photo.previewUrl}
                  alt={photo.legenda || 'Registro fotográfico'}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Caption immediately below photo */}
              <div className="w-full text-center mt-0.5 px-0.5 leading-tight">
                {photo.destaqueAlerta || photo.tipoDefeito || photo.legenda.toUpperCase().includes('FALTA EQUIPOTENCIALIZAR') ? (
                  <div className="inline-block bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1 py-0.2 rounded-[2px] text-[7px] font-bold uppercase tracking-tight max-w-full">
                    <span className="truncate block">
                      ⚠ {photo.tipoDefeito || (photo.legenda.toUpperCase().includes('FALTA') ? photo.legenda : 'FALTA EQUIPOTENCIALIZAR')}
                    </span>
                    {photo.observacao && (
                      <div className="text-[6.5px] normal-case font-medium text-amber-900 block truncate">
                        {photo.observacao}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[7.5px] font-medium text-slate-900 block truncate">
                    {photo.legenda}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Reusable page shell with absolute positioning and top-left transform-origin to prevent horizontal scroll
  const renderPageShell = (pageNumber: number, content: React.ReactNode) => (
    <div
      key={`page-outer-${pageNumber}`}
      id={`laudo-page-${pageNumber}`}
      className="page-outer-container relative mx-auto my-3 print:my-0 shadow-md print:shadow-none bg-white rounded-xs"
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        overflow: 'hidden',
      }}
    >
      <div
        className="a4-page relative bg-white p-[10mm] flex flex-col justify-between"
        style={{
          width: `${a4WidthPx}px`,
          height: `${a4HeightPx}px`,
          minHeight: `${a4HeightPx}px`,
          maxHeight: `${a4HeightPx}px`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <DocumentWatermark
          text={report.empresa.marcaDaguaTexto}
          opacity={report.empresa.marcaDaguaOpacidade}
        />
        <DocumentHeader empresa={report.empresa} />
        {content}
        <DocumentFooter
          empresa={report.empresa}
          currentPage={pageNumber}
          totalPages={totalPages}
        />
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="w-full max-w-full overflow-x-hidden flex flex-col items-center py-2 bg-slate-200/90 print:p-0 print:bg-white print:overflow-visible"
    >
      {/* Mobile Fit / Zoom Toolbar */}
      <div className="no-print mb-3 px-3 py-2 bg-white rounded-xl border border-slate-300/80 shadow-xs flex flex-wrap items-center justify-between gap-2 max-w-full w-fit">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Smartphone className="w-4 h-4 text-red-600" />
          <span className="hidden sm:inline">Exibição no Celular:</span>
          <span className="text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono">
            {Math.round(scale * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setCustomZoom(null);
              setIsFitToWidth(true);
            }}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              customZoom === null && isFitToWidth
                ? 'bg-red-600 text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Ajusta o documento exatamente à largura da tela do celular sem scroll horizontal"
          >
            Ajustar à Tela
          </button>

          <button
            type="button"
            onClick={() => {
              setCustomZoom(1);
              setIsFitToWidth(false);
            }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              customZoom === 1
                ? 'bg-slate-900 text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Tamanho real 100% da folha A4"
          >
            <Monitor className="w-3.5 h-3.5 inline mr-1" />
            100%
          </button>

          <button
            type="button"
            onClick={() => {
              const next = Math.max(0.25, Math.round((scale - 0.1) * 10) / 10);
              setCustomZoom(next);
              setIsFitToWidth(false);
            }}
            className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-sm"
            title="Diminuir zoom"
          >
            -
          </button>

          <button
            type="button"
            onClick={() => {
              const next = Math.min(1.5, Math.round((scale + 0.1) * 10) / 10);
              setCustomZoom(next);
              setIsFitToWidth(false);
            }}
            className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-sm"
            title="Aumentar zoom"
          >
            +
          </button>
        </div>
      </div>

      {/* Pages Container - strictly vertical scroll */}
      <div className="w-full flex flex-col items-center">
        {/* ========================================================
            PAGE 1: CAPA E IDENTIFICAÇÃO DO LAUDO
        ======================================================== */}
        {renderPageShell(
          1,
          <div className="relative z-10 flex-1 flex flex-col justify-start pt-4 space-y-5">
            {/* Main Title */}
            <div className="text-center space-y-1">
              <h2 className="text-[#991b1b] font-bold text-[13px] tracking-wide uppercase">
                LAUDO TÉCNICO PERICIAL DE ENGENHARIA ELÉTRICA
              </h2>
              <h1 className="text-slate-900 font-extrabold text-[19px] leading-tight tracking-tight uppercase">
                SISTEMA DE PROTEÇÃO CONTRA
                <br />
                DESCARGAS ATMOSFÉRICAS (SPDA)
              </h1>
              <p className="text-slate-600 text-[10.5px] font-medium pt-0.5">
                Inspeção Visual, Medições de Continuidade Ôhmica &amp; Avaliação NBR 5419:2026
              </p>
            </div>

            {/* Objeto da Inspeção Box */}
            <div className="border border-slate-700/80 p-3 rounded-[2px] bg-white/80">
              <h3 className="font-extrabold text-[10.5px] text-slate-900 mb-1 tracking-tight">
                OBJETO DA INSPEÇÃO:
              </h3>
              <p className="text-[10px] text-slate-800 leading-relaxed font-medium uppercase">
                {report.modeloTextos.objetoInspecao}
              </p>
            </div>

            {/* Dados da Edificação / Cliente */}
            <div className="space-y-1">
              <SectionBanner size="sm">DADOS DA EDIFICAÇÃO / CLIENTE</SectionBanner>
              <div className="text-[10px] space-y-1.5 px-1 font-medium text-slate-900">
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">CLIENTE:</span>
                  <span className="uppercase">{report.cliente.cliente}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">LOCAL:</span>
                  <span>{report.cliente.local}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">MUNICÍPIO / UF:</span>
                  <span className="uppercase">{report.cliente.municipioUf}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">CNPJ:</span>
                  <span>{report.cliente.cnpj}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">RAMO DE ATIVIDADE:</span>
                  <span className="uppercase">{report.cliente.ramoAtividade}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">PERÍODO DE AVALIAÇÃO:</span>
                  <span>{report.cliente.periodoAvaliacao}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">GRAU DE EXPOSIÇÃO:</span>
                  <span>{report.cliente.grauExposicao}</span>
                </div>
              </div>
            </div>

            {/* Responsabilidade Técnica & Registro Profissional */}
            <div className="space-y-1 pt-1">
              <SectionBanner size="sm">
                RESPONSABILIDADE TÉCNICA &amp; REGISTRO PROFISSIONAL
              </SectionBanner>
              <div className="text-[10px] space-y-1.5 px-1 font-medium text-slate-900">
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">RESPONSÁVEL TÉCNICO:</span>
                  <span className="uppercase font-bold">
                    {report.responsavelTecnico.responsavelTecnico}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">QUALIFICAÇÃO PROFISSIONAL:</span>
                  <span>{report.responsavelTecnico.qualificacao}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">REGISTRO CREA / CONFEA:</span>
                  <span className="font-mono">{report.responsavelTecnico.registroCrea}</span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">CIDADE &amp; DATA DE EMISSÃO:</span>
                  <span>
                    {report.responsavelTecnico.cidadeEmissao},{' '}
                    {report.responsavelTecnico.dataEmissao}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-bold w-48 shrink-0">AUTENTICAÇÃO DIGITAL:</span>
                  <span className="text-slate-600 font-bold uppercase">
                    DOCUMENTO ASSINADO DIGITALMENTE (PÁGINA FINAL)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            PAGE 2: INTRODUÇÃO, NORMAS, DICIONÁRIO & CREA
        ======================================================== */}
        {renderPageShell(
          2,
          <div className="relative z-10 flex-1 flex flex-col justify-start space-y-3 pt-1">
            {/* Chapter 1: Introdução */}
            <div className="space-y-1.5 text-[9.5px] leading-relaxed text-slate-900">
              <h3 className="font-bold text-[11px] text-slate-900">1) INTRODUÇÃO</h3>
              <p>
                <span className="font-bold">1.1-</span> {report.modeloTextos.introducao11}
              </p>
              <p>
                <span className="font-bold">1.2-</span> {report.modeloTextos.introducao12}
              </p>
              <p>
                <span className="font-bold">1.3-</span> {report.modeloTextos.introducao13}
              </p>
              <p>
                <span className="font-bold">1.4-</span> {report.modeloTextos.introducao14}
              </p>
              <ul className="pl-4 space-y-0.5">
                {report.modeloTextos.funcoesSpda.map((item, idx) => (
                  <li key={idx} className="flex gap-1.5">
                    <span className="font-bold">{String.fromCharCode(97 + idx)})</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <p className="pt-1 font-medium">
                As inspeções e levantamentos de informações foram efetuados na seguinte ordem:
              </p>
              <ul className="pl-4 space-y-0.5">
                {report.modeloTextos.etapasInspecao.map((item, idx) => (
                  <li key={idx} className="flex gap-1.5">
                    <span className="font-bold">{String.fromCharCode(97 + idx)})</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Normas Banner & List */}
            <div className="space-y-1.5">
              <SectionBanner size="sm">REFERÊNCIAS NORMATIVAS APLICÁVEIS</SectionBanner>
              <p className="text-[9px] text-slate-700 italic">
                Documentos indispensáveis à aplicação deste documento (edições mais recentes e emendas vigentes):
              </p>
              <ul className="space-y-0.5 text-[8.5px] text-slate-800 leading-tight">
                {report.modeloTextos.referenciasNormativas.map((norma, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-slate-900 font-bold">•</span>
                    <span>{norma}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dicionário Banner & Terms */}
            <div className="space-y-1.5">
              <SectionBanner size="sm">
                2) DICIONÁRIO E ABREVIATURAS USADAS NESTE DOCUMENTO
              </SectionBanner>
              <div className="space-y-1 text-[8.5px] text-slate-800 leading-tight">
                {report.modeloTextos.dicionario.map((d, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="font-bold">• {d.termo}:</span>
                    <span>{d.definicao}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CREA Box with thick left blue accent */}
            <div className="border-l-4 border-sky-600 bg-sky-50/40 p-2.5 rounded-r-[2px] mt-1">
              <h4 className="font-bold text-[9.5px] text-slate-900">
                CREA – CONSELHO REGIONAL DE ENGENHARIA E AGRONOMIA
              </h4>
              <p className="text-[8.5px] text-slate-700 mt-0.5 leading-relaxed">
                {report.modeloTextos.notaCrea}
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            PAGE 3: CARACTERÍSTICAS DA EDIFICAÇÃO & HISTÓRICO
        ======================================================== */}
        {renderPageShell(
          3,
          <div className="relative z-10 flex-1 flex flex-col justify-start space-y-3 pt-1">
            <h3 className="font-bold text-[11px] text-slate-900">
              3) CARACTERÍSTICAS DA EDIFICAÇÃO &amp; LOCAL
            </h3>

            {/* 3.1 Vista Aérea */}
            <div className="space-y-1">
              <SectionBanner size="sm">
                3.1) VISTA AÉREA DA EDIFICAÇÃO / IMAGEM SATÉLITE
              </SectionBanner>
              <div className="w-full h-48 bg-slate-100 border border-slate-300 rounded-[2px] overflow-hidden flex flex-col items-center justify-center">
                <img
                  src={fotoAereaPreview || report.edificacao.fotoAereaUrl}
                  alt={report.edificacao.fotoAereaLegenda}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-center text-[8.5px] text-slate-700 font-medium">
                {report.edificacao.fotoAereaLegenda}
              </p>
            </div>

            {/* Parâmetros Construtivos */}
            <div className="space-y-1">
              <SectionBanner size="sm">
                PARÂMETROS CONSTRUTIVOS &amp; INFRAESTRUTURA DA EDIFICAÇÃO (NBR 5419:2026)
              </SectionBanner>
              <div className="text-[9px] space-y-1 px-1 font-medium text-slate-900">
                <div>
                  <span className="font-bold">Tipologia Construtiva: </span>
                  {report.edificacao.tipologiaConstrutiva}
                </div>
                <div>
                  <span className="font-bold">Topografia &amp; Entorno: </span>
                  {report.edificacao.topografiaEntorno}
                </div>
                <div>
                  <span className="font-bold">Nível de Proteção Dimensionado: </span>
                  {report.edificacao.nivelProtecao}
                </div>
                <div>
                  <span className="font-bold">Métodos de Proteção Aplicáveis: </span>
                  {report.edificacao.metodosProtecao}
                </div>
              </div>
            </div>

            {/* 3.2 Fachada Principal */}
            <div className="space-y-1">
              <SectionBanner size="sm">
                3.2) FACHADA PRINCIPAL DA EDIFICAÇÃO / CONDOMÍNIO
              </SectionBanner>
              <div className="w-full h-44 bg-slate-100 border border-slate-300 rounded-[2px] overflow-hidden flex flex-col items-center justify-center">
                <img
                  src={fotoFachadaPreview || report.edificacao.fotoFachadaUrl}
                  alt={report.edificacao.fotoFachadaLegenda}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-center text-[8.5px] text-slate-700 font-medium">
                {report.edificacao.fotoFachadaLegenda}
              </p>
              <p className="text-[9px] text-slate-800 leading-tight pt-1">
                {report.edificacao.descricaoEdificacao}
              </p>
            </div>

            {/* 4) Histórico de Ocorrências */}
            <div className="space-y-1 pt-1 text-[9px] text-slate-900 leading-tight">
              <h3 className="font-bold text-[10.5px]">
                4) HISTÓRICO DE OCORRÊNCIAS &amp; DESCARGAS ATMOSFÉRICAS
              </h3>
              <p>
                <span className="font-bold">4.1- Histórico: </span>
                {report.edificacao.historicoOcorrencias}
              </p>
              <p>
                <span className="font-bold">4.2- </span>
                {report.edificacao.historicoOcorrenciasComplemento}
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            PAGE 4: INSTRUMENTAÇÃO TÉCNICA E CRITÉRIOS DE INSPEÇÃO
        ======================================================== */}
        {renderPageShell(
          4,
          <div className="relative z-10 flex-1 flex flex-col justify-start space-y-3 pt-1">
            {/* Chapter 5 */}
            <div className="space-y-2 text-[9px] text-slate-900 leading-tight">
              <h3 className="font-bold text-[11px]">
                5) INSTRUMENTAÇÃO TÉCNICA E CRITÉRIOS DE INSPEÇÃO
              </h3>
              <p>
                Foram efetuadas medidas de continuidade elétrica e inspeção visual, com o uso do{' '}
                <span className="font-bold">{report.instrumentacao.equipamentoNome}</span>. Os
                certificados de calibração estão em anexo.
              </p>

              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-[2px] space-y-1">
                <h4 className="font-bold text-[9.5px]">
                  {report.instrumentacao.equipamentoNome}
                </h4>
                <p className="text-slate-700">{report.instrumentacao.equipamentoDescricao}</p>
                <div className="pt-1 text-[8.5px] space-y-0.5">
                  <div>
                    <span className="font-bold">Local: </span>
                    {report.instrumentacao.localMedicao}
                  </div>
                  <div>
                    <span className="font-bold">Corrente de Ensaio: </span>
                    {report.instrumentacao.correnteEnsaio}
                  </div>
                  <div>
                    <span className="font-bold">Tipo de Corrente: </span>
                    {report.instrumentacao.tipoCorrente}
                  </div>
                </div>
              </div>
            </div>

            {/* Parâmetros Normativos de Continuidade */}
            <div className="space-y-2">
              <SectionBanner size="sm">
                PARÂMETROS NORMATIVOS DE CONTINUIDADE (ABNT NBR 5419:2026)
              </SectionBanner>
              <div className="space-y-2 text-[9px] text-slate-900 px-1">
                {report.instrumentacao.parametrosContinuidades.map((param) => (
                  <div key={param.id} className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-bold">• {param.item}</span>{' '}
                      <span className="text-slate-600">({param.norma})</span> — Limite:{' '}
                      <span className="font-mono font-semibold">{param.limite}</span>
                    </div>
                    <span
                      className={`font-bold text-[8.5px] px-1.5 py-0.5 rounded-[2px] whitespace-nowrap ${
                        param.status === 'CONFORME'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : param.status === 'APLICADO'
                          ? 'text-blue-700 bg-blue-50 border border-blue-200'
                          : param.status === 'LIMPEZA PENDENTE'
                          ? 'text-red-700 bg-red-50 border border-red-200'
                          : 'text-amber-700 bg-amber-50 border border-amber-200'
                      }`}
                    >
                      [{param.status}]
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Proteção contra surtos em quadros elétricos */}
            <div className="space-y-2 pt-1">
              <SectionBanner size="sm">
                PROTEÇÃO CONTRA SURTOS EM QUADROS ELÉTRICOS (ABNT NBR 5410 / NBR 5419-4)
              </SectionBanner>
              <p className="text-[9px] text-slate-800 leading-relaxed px-1">
                {report.instrumentacao.textoDps}
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            PAGES 5..N: VISTORIAS E ENSAIOS POR TORRE & ÁREA COMUM
        ======================================================== */}
        {towerPages.map((page) =>
          renderPageShell(
            page.pageNumber,
            <div className="relative z-10 flex-1 flex flex-col justify-start">
              {page.blocks.map((block, bIdx) => {
                if (block.type === 'tower_header') {
                  return (
                    <h3
                      key={`th-${bIdx}`}
                      className="font-bold text-[11px] text-slate-900 mb-0.5"
                    >
                      {block.title}
                    </h3>
                  );
                }
                if (block.type === 'sub_header') {
                  return (
                    <SectionBanner key={`sh-${bIdx}`} size="sm" className="mt-0.5 mb-1">
                      {block.title}
                    </SectionBanner>
                  );
                }
                if (block.type === 'photo_row' && block.photos) {
                  return renderPhotoRow(block.photos, bIdx);
                }
                return null;
              })}
            </div>
          )
        )}

        {/* ========================================================
            FINAL PAGE: CORREÇÕES NECESSÁRIAS, CONCLUSÃO & ASSINATURA
        ======================================================== */}
        {renderPageShell(
          totalPages,
          <div className="relative z-10 flex-1 flex flex-col justify-start space-y-3 pt-1">
            {/* Chapter 7 */}
            <div className="space-y-1.5 text-[9px] text-slate-900 leading-tight">
              <h3 className="font-bold text-[11px]">
                7) CORREÇÕES NECESSÁRIAS PARA PROTEÇÃO DAS EDIFICAÇÕES
              </h3>
              <SectionBanner size="sm">
                Recomendações Técnicas Prioritárias (NBR 5419:2026)
              </SectionBanner>
              <div className="space-y-1.5 px-1 pt-0.5">
                {report.modeloTextos.recomendacoesPrioritarias.map((rec, idx) => (
                  <div key={idx} className="text-red-700 font-medium">
                    <span className="font-bold">7.{idx + 1}- </span>
                    {rec}
                  </div>
                ))}
                {report.recomendacoesPersonalizadas.map((rec, idx) => (
                  <div key={`custom-${idx}`} className="text-red-700 font-medium">
                    <span className="font-bold">
                      7.{report.modeloTextos.recomendacoesPrioritarias.length + idx + 1}-{' '}
                    </span>
                    {rec}
                  </div>
                ))}
                <p className="text-slate-900 font-bold pt-1">
                  Fazer a correção de todos os itens apontados neste relatório, de forma ao sistema
                  operar em sua perfeita harmonia.
                </p>
              </div>
            </div>

            {/* Chapter 8: Conclusão Final */}
            <div className="space-y-1.5 text-[9px] text-slate-900 leading-tight pt-1">
              <h3 className="font-bold text-[11px]">
                8) CONCLUSÃO FINAL DESTE RELATÓRIO TÉCNICO
              </h3>
              <p className="leading-relaxed px-1">
                {report.conclusaoPersonalizada || report.modeloTextos.conclusaoFinal}
              </p>
            </div>

            {/* Disposições Finais & Validade */}
            <div className="border border-slate-700/80 p-2.5 rounded-[2px] bg-white/90">
              <h4 className="font-bold text-[9px] text-slate-900 mb-1">
                DISPOSIÇÕES FINAIS &amp; VALIDADE DA INSPEÇÃO:
              </h4>
              <p className="text-[8.5px] text-slate-800 leading-relaxed font-medium">
                {report.modeloTextos.disposicoesFinais}
              </p>
            </div>

            {/* Emission Date & Signature Block */}
            <div className="pt-4 flex flex-col items-center justify-end text-center space-y-1">
              <div className="w-full text-right text-[10px] text-slate-900 font-bold mb-3 pr-4">
                {report.responsavelTecnico.cidadeEmissao},{' '}
                {report.responsavelTecnico.dataEmissao}.
              </div>

              {/* Engineer Signature */}
              <div className="flex flex-col items-center justify-center w-80">
                {report.responsavelTecnico.assinaturaUrl ? (
                  <div className="h-16 flex items-center justify-center">
                    <img
                      src={report.responsavelTecnico.assinaturaUrl}
                      alt="Assinatura do Responsável Técnico"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-10 flex items-center justify-center text-slate-400 italic text-[10px]">
                    (Assinatura digitalizada ou eletrônica)
                  </div>
                )}
                <div className="w-full border-t border-slate-700 mt-1 mb-1" />
                <div className="font-extrabold text-[10.5px] uppercase text-slate-900 tracking-wide">
                  {report.responsavelTecnico.responsavelTecnico}
                </div>
                <div className="text-[9px] text-slate-700 font-medium">
                  {report.responsavelTecnico.qualificacao}
                </div>
                <div className="text-[8.5px] text-slate-600 font-mono">
                  {report.responsavelTecnico.registroCrea} | ART:{' '}
                  {report.responsavelTecnico.numeroArt}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

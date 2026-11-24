import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  ChevronDown,
  Circle,
  Combine,
  Compass,
  Crosshair,
  Download,
  Eraser,
  Grid3X3,
  HelpCircle,
  ImagePlus,
  Magnet,
  Minus,
  Moon,
  MousePointer2,
  Plus,
  Redo2,
  Ruler,
  Shapes,
  Square,
  Star,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { GridConfig } from '../geometry/grid';
import type { DimMode, SvgExportLayers, ToolId } from '../geometry/types';
import { modKey, optKey } from '../geometry/types';

interface ToolbarProps {
  tool: ToolId;
  onSelectTool: (t: ToolId) => void;
  prioMode: boolean;
  backquoteDown: boolean;
  onTogglePrioMode: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  tanSnapEnabled: boolean;
  onToggleTanSnap: () => void;
  snapPx: number;
  onChangeSnapPx: (px: number) => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  gridConfig: GridConfig;
  showGridPanel: boolean;
  onToggleGridPanel: () => void;
  dimMode: DimMode;
  onCycleDimMode: () => void;
  svgOverlap: boolean;
  onToggleSvgOverlap: () => void;
  svgExportLayers: SvgExportLayers;
  onChangeSvgExportLayers: (layers: SvgExportLayers) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onLoadDemo: () => void;
  onClear: () => void;
  onExportSvg: (withBg: boolean) => void;
  onUploadImage: (file: File) => void;
  dark: boolean;
  onToggleDark: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
  onOpenStudio3D: () => void;
}

const TOOLS: Array<{
  id: ToolId;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'move', label: 'Mover', shortcut: 'V', icon: MousePointer2 },
  { id: 'ln', label: 'Reta', shortcut: 'L', icon: Minus },
  { id: 'ci', label: 'Círculo', shortcut: 'C', icon: Circle },
  { id: 'pg', label: 'Polígono', shortcut: 'Q', icon: Square },
  { id: 'shape', label: 'Construtor', shortcut: 'F', icon: Combine },
  { id: 'ruler', label: 'Régua', shortcut: 'U', icon: Ruler },
  { id: 'del', label: 'Apagar', shortcut: 'X', icon: Eraser },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  onSelectTool,
  prioMode,
  backquoteDown,
  onTogglePrioMode,
  snapEnabled,
  onToggleSnap,
  tanSnapEnabled,
  onToggleTanSnap,
  snapPx,
  onChangeSnapPx,
  showRulers,
  onToggleRulers,
  gridConfig,
  showGridPanel,
  onToggleGridPanel,
  dimMode,
  onCycleDimMode,
  svgOverlap,
  onToggleSvgOverlap,
  svgExportLayers,
  onChangeSvgExportLayers,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoomPct,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onLoadDemo,
  onClear,
  onExportSvg,
  onUploadImage,
  dark,
  onToggleDark,
  showHelp,
  onToggleHelp,
  onOpenStudio3D,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const prioOn = prioMode || backquoteDown;
  const dimLabel = dimMode === 'd' ? 'Ø Dim' : dimMode === 'r' ? 'r Dim' : 'Dim off';

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: PointerEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  return (
    <header className="relative z-30 shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 py-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 select-none">
      {/* Brand mark */}
      <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-zinc-800 shrink-0">
        <Compass className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100 whitespace-nowrap">
          Compasso
        </span>
      </div>

      {/* Primary consolidated construction tools (icon-only with tooltips) */}
      <nav aria-label="Ferramentas de construção" className="flex items-center gap-1">
        {TOOLS.map(({ id, label, shortcut, icon: Icon }) => {
          const active = tool === id;
          const isCircle = id === 'ci';
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTool(id)}
              title={`${label} (${shortcut})`}
              aria-pressed={active}
              className={`relative p-2 rounded-lg border transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                active
                  ? id === 'del'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                    : 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {isCircle && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
              )}
            </button>
          );
        })}

        {/* Priority mode toggle */}
        <button
          type="button"
          onClick={onTogglePrioMode}
          title="Priorizar objetos: segure ` + clique (ou ative este modo e clique nos objetos)"
          aria-pressed={prioOn}
          className={`p-2 rounded-lg border transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
            prioOn
              ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Star className="w-4 h-4 shrink-0" aria-hidden="true" />
        </button>
      </nav>

      {/* Snap, Rulers, Grid & Dimension controls */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={onToggleSnap}
          title={`Ativar/Desativar Snap (G) · Segure ${optKey} para ignorar temporariamente`}
          aria-pressed={snapEnabled}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            snapEnabled
              ? 'bg-slate-900 dark:bg-zinc-100 border-slate-900 dark:border-zinc-100 text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Magnet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Snap</span>
        </button>
        <button
          type="button"
          onClick={onToggleTanSnap}
          title={`Ativar/Desativar Snap de Tangência (E) · ${tanSnapEnabled ? 'Ativo' : 'Desativado'}`}
          aria-pressed={tanSnapEnabled}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
            tanSnapEnabled
              ? 'bg-violet-600 border-violet-600 text-white'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <span>Snap tang.</span>
          <kbd
            className={`text-[10px] font-mono px-1 rounded ${
              tanSnapEnabled
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
            }`}
          >
            E
          </kbd>
        </button>
        <div
          className={`inline-flex items-center rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 overflow-hidden ${
            !snapEnabled ? 'opacity-50' : ''
          }`}
          title="Distância máxima de snap em pixels na tela"
        >
          <button
            type="button"
            onClick={() => onChangeSnapPx(Math.max(4, snapPx - 2))}
            disabled={!snapEnabled || snapPx <= 4}
            aria-label="Diminuir raio de snap"
            className="px-1.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
          >
            −
          </button>
          <span className="px-1.5 text-xs font-mono tabular-nums text-slate-800 dark:text-zinc-200 whitespace-nowrap">
            {snapPx}px
          </span>
          <button
            type="button"
            onClick={() => onChangeSnapPx(Math.min(24, snapPx + 2))}
            disabled={!snapEnabled || snapPx >= 24}
            aria-label="Aumentar raio de snap"
            className="px-1.5 py-1.5 text-xs text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleRulers}
          title="Mostrar/Ocultar Réguas nas bordas (R) — arraste da régua para puxar guias"
          aria-pressed={showRulers}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            showRulers
              ? 'bg-cyan-600 border-cyan-600 text-white'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Ruler className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Réguas</span>
        </button>

        <button
          type="button"
          onClick={onToggleGridPanel}
          title="Configurar Grid de Trabalho e Regra de Tamanho (H)"
          aria-expanded={showGridPanel}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            showGridPanel || gridConfig.enabled || gridConfig.sizeRule !== 'free'
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {gridConfig.enabled
              ? gridConfig.kind === 'fibonacci'
                ? 'Grid Fib'
                : gridConfig.kind === 'modular'
                  ? 'Grid Mod'
                  : gridConfig.kind === 'isometric'
                    ? 'Grid Iso'
                    : gridConfig.kind === 'phi'
                      ? 'Grid φ'
                      : 'Grid Polar'
              : gridConfig.sizeRule !== 'free'
                ? `Regra ${gridConfig.sizeRule === 'fibonacci' ? 'Fib' : gridConfig.sizeRule === 'golden' ? 'φ' : 'Mod'}`
                : 'Grid'}
          </span>
          <kbd
            className={`text-[10px] font-mono px-1 rounded ${
              showGridPanel || gridConfig.enabled || gridConfig.sizeRule !== 'free'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
            }`}
          >
            H
          </kbd>
        </button>

        <button
          type="button"
          onClick={onCycleDimMode}
          title="Exibir dimensão no centro de círculos e polígonos (D): Diâmetro/Lado, Raio ou Oculto"
          aria-pressed={dimMode !== 'off'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            dimMode !== 'off'
              ? 'bg-white dark:bg-zinc-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="font-mono tabular-nums">{dimLabel}</span>
        </button>
      </div>

      <div className="flex-1 min-w-2" />

      {/* History, Zoom, Image, Demo, Export Popover */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={`Desfazer (${modKey}+Z)`}
            aria-label="Desfazer"
            className="inline-flex items-center justify-center p-1.5 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={`Refazer (${modKey}+Y / ${modKey}+Shift+Z)`}
            aria-label="Refazer"
            className="inline-flex items-center justify-center p-1.5 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="inline-flex items-center rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 overflow-hidden">
          <button
            type="button"
            onClick={onZoomOut}
            title="Diminuir zoom (-)"
            aria-label="Diminuir zoom"
            className="px-2 py-1.5 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            title="Restaurar zoom 100% (0)"
            className="px-2 py-1.5 text-xs font-mono tabular-nums text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 border-x border-slate-200 dark:border-zinc-700 whitespace-nowrap cursor-pointer"
          >
            {zoomPct}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            title="Aumentar zoom (+)"
            aria-label="Aumentar zoom"
            className="px-2 py-1.5 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadImage(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title={`Carregar imagem de referência (ou use ${modKey}+V)`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ImagePlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Imagem</span>
        </button>

        <button
          type="button"
          onClick={onLoadDemo}
          title="Carregar exemplo de construção"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Shapes className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Exemplo</span>
        </button>

        <button
          type="button"
          onClick={onClear}
          title="Limpar todo o desenho"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Limpar</span>
        </button>

        {/* Consolidated Freeform-style SVG Export Popover */}
        <div ref={exportMenuRef} className="relative pl-1.5 border-l border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setExportOpen((p) => !p)}
            aria-expanded={exportOpen}
            title="Opções de exportação SVG em camadas"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              exportOpen
                ? 'bg-slate-900 border-slate-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900'
                : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Exportar SVG</span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-70" aria-hidden="true" />
          </button>

          {exportOpen && (
            <div
              role="dialog"
              aria-label="Opções de exportação SVG"
              className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200/90 dark:border-zinc-700 bg-slate-50/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl p-3 space-y-2.5 text-xs text-slate-800 dark:text-zinc-100 z-40"
            >
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 px-0.5">
                  Camadas
                </div>
                <div className="grid grid-cols-3 rounded-lg bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5">
                  {(
                    [
                      { id: 'all', label: 'Tudo' },
                      { id: 'paths', label: 'Só Paths' },
                      { id: 'geometry', label: 'Construção' },
                    ] as Array<{ id: SvgExportLayers; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeSvgExportLayers(opt.id)}
                      aria-pressed={svgExportLayers === opt.id}
                      className={`h-7 rounded text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                        svgExportLayers === opt.id
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                  Sobreposição tangencial
                </span>
                <button
                  type="button"
                  onClick={onToggleSvgOverlap}
                  aria-pressed={svgOverlap}
                  title="Adiciona +0,05 px nas tangências para evitar micro-gaps em softwares vetoriais"
                  className={`px-2 py-1 rounded-full text-[11px] font-mono tabular-nums transition cursor-pointer ${
                    svgOverlap
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  {svgOverlap ? '+0,05 px' : '0 px'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onExportSvg(true);
                    setExportOpen(false);
                  }}
                  className="h-8 rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 font-medium whitespace-nowrap cursor-pointer"
                >
                  Fundo branco
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportSvg(false);
                    setExportOpen(false);
                  }}
                  className="h-8 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 font-medium whitespace-nowrap cursor-pointer"
                >
                  Transparente
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenStudio3D}
          title="Abrir Studio 3D (Extrusão tridimensional)"
          aria-label="Abrir Studio 3D"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/80 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
        >
          <Box className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Studio 3D</span>
        </button>

        <button
          type="button"
          onClick={onToggleDark}
          title={dark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          aria-label={dark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          className="inline-flex items-center justify-center p-1.5 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onToggleHelp}
          title="Atalhos e guia rápido (?)"
          aria-expanded={showHelp}
          aria-label="Atalhos e guia rápido"
          className={`inline-flex items-center justify-center p-1.5 rounded-md border transition-colors duration-150 cursor-pointer ${
            showHelp
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

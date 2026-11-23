import React, { useRef } from 'react';
import {
  Circle,
  Combine,
  Compass,
  Crosshair,
  Download,
  Eraser,
  HelpCircle,
  ImagePlus,
  Lock,
  Magnet,
  Minus,
  Moon,
  MousePointer2,
  Plus,
  Redo2,
  Ruler,
  Shapes,
  Star,
  Sun,
  Target,
  Trash2,
  Undo2,
  Unlock,
  Waypoints,
} from 'lucide-react';
import type { DimMode, ToolId } from '../geometry/types';
import { modKey } from '../geometry/types';

interface ToolbarProps {
  tool: ToolId;
  onSelectTool: (t: ToolId) => void;
  tgActive: boolean;
  shiftDown: boolean;
  onToggleTg: () => void;
  prioMode: boolean;
  backquoteDown: boolean;
  onTogglePrioMode: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  snapPx: number;
  onChangeSnapPx: (px: number) => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  guidesLocked: boolean;
  onToggleGuidesLocked: () => void;
  dimMode: DimMode;
  onCycleDimMode: () => void;
  svgOverlap: boolean;
  onToggleSvgOverlap: () => void;
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
  { id: 'cb', label: 'Borda', shortcut: 'B', icon: Compass },
  { id: 'tc', label: 'Tang. comum', shortcut: 'T', icon: Waypoints },
  { id: 'tcir', label: 'Círc. tang.', shortcut: 'A', icon: Target },
  { id: 'shape', label: 'Construtor', shortcut: 'F', icon: Combine },
  { id: 'ruler', label: 'Régua', shortcut: 'U', icon: Ruler },
  { id: 'del', label: 'Apagar', shortcut: 'X', icon: Eraser },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  onSelectTool,
  tgActive,
  shiftDown,
  onToggleTg,
  prioMode,
  backquoteDown,
  onTogglePrioMode,
  snapEnabled,
  onToggleSnap,
  snapPx,
  onChangeSnapPx,
  showRulers,
  onToggleRulers,
  guidesLocked,
  onToggleGuidesLocked,
  dimMode,
  onCycleDimMode,
  svgOverlap,
  onToggleSvgOverlap,
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
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const tgOn = tgActive || shiftDown;
  const prioOn = prioMode || backquoteDown;

  const dimLabel = dimMode === 'd' ? 'Ø Dim' : dimMode === 'r' ? 'r Dim' : 'Dim off';

  return (
    <header className="shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 py-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 select-none">
      {/* Brand mark */}
      <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-zinc-800 shrink-0">
        <Compass className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100 whitespace-nowrap">
          Compasso
        </span>
      </div>

      {/* Primary construction tools */}
      <nav aria-label="Ferramentas de construção" className="flex items-center gap-1 flex-wrap">
        {TOOLS.map(({ id, label, shortcut, icon: Icon }) => {
          const active = tool === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTool(id)}
              title={`${label} (${shortcut})`}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                active
                  ? id === 'del'
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
              <kbd
                className={`text-[10px] font-mono px-1 rounded ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                }`}
              >
                {shortcut}
              </kbd>
            </button>
          );
        })}

        {/* Tangency mode toggle */}
        <button
          type="button"
          onClick={onToggleTg}
          title="Modo Tangente (S ou segure Shift)"
          aria-pressed={tgOn}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            tgOn
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <span>Tangente</span>
          <kbd
            className={`text-[10px] font-mono px-1 rounded ${
              tgOn
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
            }`}
          >
            S
          </kbd>
        </button>

        {/* Priority mode toggle */}
        <button
          type="button"
          onClick={onTogglePrioMode}
          title="Priorizar objetos: segure ` + clique (ou ative este modo e clique nos objetos)"
          aria-pressed={prioOn}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
            prioOn
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Star className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Prioridade</span>
          <kbd
            className={`text-[10px] font-mono px-1 rounded ${
              prioOn
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
            }`}
          >
            `
          </kbd>
        </button>
      </nav>

      {/* Snap, Rulers, Guide Lock & Dimension controls */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={onToggleSnap}
          title="Ativar/Desativar Snap (G) · Segure Alt para ignorar temporariamente"
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
          onClick={onToggleGuidesLocked}
          title="Bloquear/Desbloquear guias (K)"
          aria-pressed={guidesLocked}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
            guidesLocked
              ? 'bg-amber-600 border-amber-600 text-white'
              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          {guidesLocked ? (
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Unlock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{guidesLocked ? 'Guias bloq.' : 'Guias livres'}</span>
        </button>

        <button
          type="button"
          onClick={onCycleDimMode}
          title="Exibir dimensão no centro dos círculos (D): Diâmetro (Ø), Raio (r) ou Oculto"
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

      {/* History, Zoom, Image, Demo, Export */}
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

        {/* SVG Export + 0.05px vector overlap toggle */}
        <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onToggleSvgOverlap}
            title="Sobreposição vetorial no SVG exportado (+0,05 px nas tangências para eliminar gaps entre curvas)"
            aria-pressed={svgOverlap}
            className={`px-2 py-1.5 text-[11px] font-mono tabular-nums rounded-md border transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              svgOverlap
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            {svgOverlap ? '+0,05px SVG' : '0px SVG'}
          </button>
          <button
            type="button"
            onClick={() => onExportSvg(true)}
            title="Exportar SVG com fundo branco"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>SVG</span>
          </button>
          <button
            type="button"
            onClick={() => onExportSvg(false)}
            title="Exportar SVG com fundo transparente"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>SVG transp.</span>
          </button>
        </div>

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

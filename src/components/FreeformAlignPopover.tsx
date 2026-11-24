import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import type { AlignMode, CombineShapeOp, DistributeAxis, MirrorAxis } from '../geometry/types';

interface FreeformAlignPopoverProps {
  open: boolean;
  onToggleOpen: () => void;
  anchorScreenX: number;
  anchorScreenY: number;
  containerW: number;
  unitCount: number;
  canGroup: boolean;
  canUngroup: boolean;
  closedCurveCount: number;
  hasScalableSelection: boolean;
  scaleLockState: 'none' | 'partial' | 'all';
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onCombineShapes: (op: CombineShapeOp) => void;
  onMirror: (axis: MirrorAxis) => void;
  onRadialArray: (count: number) => void;
  onToggleScaleLock: () => void;
}

const AlignLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="3" y1="2.5" x2="3" y2="15.5" strokeLinecap="round" />
    <rect x="5.5" y="4.5" width="7" height="3.2" rx="0.8" />
    <rect x="5.5" y="10.3" width="10" height="3.2" rx="0.8" />
  </svg>
);

const AlignCenterXIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="9" y1="2.5" x2="9" y2="15.5" strokeLinecap="round" />
    <rect x="5" y="4.5" width="8" height="3.2" rx="0.8" fill="var(--panel-bg, transparent)" />
    <rect x="3" y="10.3" width="12" height="3.2" rx="0.8" fill="var(--panel-bg, transparent)" />
  </svg>
);

const AlignRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="15" y1="2.5" x2="15" y2="15.5" strokeLinecap="round" />
    <rect x="5.5" y="4.5" width="7" height="3.2" rx="0.8" />
    <rect x="2.5" y="10.3" width="10" height="3.2" rx="0.8" />
  </svg>
);

const AlignTopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="2.5" y1="3" x2="15.5" y2="3" strokeLinecap="round" />
    <rect x="4.5" y="5.5" width="3.2" height="10" rx="0.8" />
    <rect x="10.3" y="5.5" width="3.2" height="7" rx="0.8" />
  </svg>
);

const AlignMiddleYIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="2.5" y1="9" x2="15.5" y2="9" strokeLinecap="round" />
    <rect x="4.5" y="3" width="3.2" height="12" rx="0.8" fill="var(--panel-bg, transparent)" />
    <rect x="10.3" y="5" width="3.2" height="8" rx="0.8" fill="var(--panel-bg, transparent)" />
  </svg>
);

const AlignBottomIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="2.5" y1="15" x2="15.5" y2="15" strokeLinecap="round" />
    <rect x="4.5" y="2.5" width="3.2" height="10" rx="0.8" />
    <rect x="10.3" y="5.5" width="3.2" height="7" rx="0.8" />
  </svg>
);

const DistributeHorizIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="5.2" y1="2.5" x2="5.2" y2="15.5" strokeLinecap="round" />
    <line x1="12.8" y1="2.5" x2="12.8" y2="15.5" strokeLinecap="round" />
    <rect x="3.5" y="5" width="3.4" height="8" rx="0.7" fill="currentColor" fillOpacity="0.16" />
    <rect x="11.1" y="6" width="3.4" height="6" rx="0.7" fill="currentColor" fillOpacity="0.16" />
  </svg>
);

const DistributeVertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <line x1="2.5" y1="5.2" x2="15.5" y2="5.2" strokeLinecap="round" />
    <line x1="2.5" y1="12.8" x2="15.5" y2="12.8" strokeLinecap="round" />
    <rect x="5" y="3.5" width="8" height="3.4" rx="0.7" fill="currentColor" fillOpacity="0.16" />
    <rect x="6" y="11.1" width="6" height="3.4" rx="0.7" fill="currentColor" fillOpacity="0.16" />
  </svg>
);

const GroupIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
    <rect x="3.5" y="3.5" width="11" height="11" rx="1" strokeDasharray="2.2 1.8" />
    <rect x="2.5" y="2.5" width="2.2" height="2.2" fill="currentColor" stroke="none" />
    <rect x="13.3" y="2.5" width="2.2" height="2.2" fill="currentColor" stroke="none" />
    <rect x="2.5" y="13.3" width="2.2" height="2.2" fill="currentColor" stroke="none" />
    <rect x="13.3" y="13.3" width="2.2" height="2.2" fill="currentColor" stroke="none" />
    <rect x="5.8" y="5.8" width="4.2" height="4.2" rx="0.6" />
    <rect x="8.2" y="8.2" width="4.2" height="4.2" rx="0.6" />
  </svg>
);

const UngroupIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
    <rect x="3.2" y="3.2" width="7.2" height="7.2" rx="0.8" />
    <rect x="7.6" y="7.6" width="7.2" height="7.2" rx="0.8" />
    <rect x="2.2" y="2.2" width="2" height="2" fill="currentColor" stroke="none" />
    <rect x="9.4" y="2.2" width="2" height="2" fill="currentColor" stroke="none" />
    <rect x="13.8" y="13.8" width="2" height="2" fill="currentColor" stroke="none" />
    <rect x="6.6" y="13.8" width="2" height="2" fill="currentColor" stroke="none" />
  </svg>
);

const BoolUnionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
    <path d="M3 4.2C3 3.54 3.54 3 4.2 3H10.8C11.46 3 12 3.54 12 4.2V6H13.8C14.46 6 15 6.54 15 7.2V13.8C15 14.46 14.46 15 13.8 15H7.2C6.54 15 6 14.46 6 13.8V12H4.2C3.54 12 3 11.46 3 10.8V4.2Z" />
  </svg>
);

const BoolIntersectIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
    <rect x="3.2" y="3.2" width="8.2" height="8.2" rx="1.1" />
    <rect x="6.6" y="6.6" width="8.2" height="8.2" rx="1.1" />
    <rect x="6.6" y="6.6" width="4.8" height="4.8" rx="0.4" fill="currentColor" stroke="none" />
  </svg>
);

const BoolSubtractIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
    <path
      d="M4.2 3.2H10.4C10.95 3.2 11.4 3.65 11.4 4.2V6.6H6.6V11.4H4.2C3.65 11.4 3.2 10.95 3.2 10.4V4.2C3.2 3.65 3.65 3.2 4.2 3.2Z"
      fill="currentColor"
      stroke="none"
    />
    <rect x="6.6" y="6.6" width="8.2" height="8.2" rx="1.1" />
  </svg>
);

const BoolExcludeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M4.2 3H10.8C11.46 3 12 3.54 12 4.2V6H13.8C14.46 6 15 6.54 15 7.2V13.8C15 14.46 14.46 15 13.8 15H7.2C6.54 15 6 14.46 6 13.8V12H4.2C3.54 12 3 11.46 3 10.8V4.2C3 3.54 3.54 3 4.2 3ZM6.8 6.8V11.2H11.2V6.8H6.8Z"
    />
  </svg>
);

const MirrorHorizIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
    <line x1="9" y1="2.5" x2="9" y2="15.5" strokeDasharray="2 1.8" strokeLinecap="round" />
    <polygon points="7,4.5 3,9 7,13.5" fill="currentColor" fillOpacity="0.22" />
    <polygon points="11,4.5 15,9 11,13.5" />
  </svg>
);

const MirrorVertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
    <line x1="2.5" y1="9" x2="15.5" y2="9" strokeDasharray="2 1.8" strokeLinecap="round" />
    <polygon points="4.5,7 9,3 13.5,7" fill="currentColor" fillOpacity="0.22" />
    <polygon points="4.5,11 9,15 13.5,11" />
  </svg>
);

const PillAlignTriggerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.45" aria-hidden="true">
    <rect x="3" y="3.5" width="5.5" height="11" rx="1.2" />
    <rect x="10.2" y="5.5" width="4.8" height="7" rx="1.2" />
  </svg>
);

export const FreeformAlignPopover: React.FC<FreeformAlignPopoverProps> = ({
  open,
  onToggleOpen,
  anchorScreenX,
  anchorScreenY,
  containerW,
  unitCount,
  canGroup,
  canUngroup,
  closedCurveCount,
  hasScalableSelection,
  scaleLockState,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
  onCombineShapes,
  onMirror,
  onRadialArray,
  onToggleScaleLock,
}) => {
  const showAlignTrigger = unitCount >= 1 || canUngroup;
  if (!showAlignTrigger && !hasScalableSelection) return null;

  const clampedX = Math.min(Math.max(140, anchorScreenX), Math.max(140, containerW - 140));
  const flipBelow = anchorScreenY < 325;
  const clampedY = Math.max(52, anchorScreenY - 14);

  const canAlign = unitCount >= 2;
  const canDistribute = unitCount >= 3;
  const canCombine = closedCurveCount >= 2;
  const canTransform = unitCount >= 1;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ left: clampedX, top: clampedY }}
      className="absolute z-20 -translate-x-1/2 -translate-y-full pointer-events-auto select-none"
    >
      {/* Floating Popover Card (Freeform-inspired) */}
      {open && showAlignTrigger && (
        <div
          role="dialog"
          aria-label="Alinhar, distribuir, agrupar, combinar e simetria"
          className={`absolute left-1/2 -translate-x-1/2 w-[262px] rounded-2xl border border-slate-200/90 dark:border-zinc-700 bg-slate-50/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl p-3 space-y-2.5 text-xs text-slate-800 dark:text-zinc-100 [--panel-bg:#f8fafc] dark:[--panel-bg:#18181b] ${
            flipBelow ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          }`}
        >
          {/* Caret pointer */}
          <div
            aria-hidden="true"
            className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-50 dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-700 ${
              flipBelow
                ? '-top-1.5 border-l border-t'
                : '-bottom-1.5 border-r border-b'
            }`}
          />

          {/* Section: Alinhar */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 px-0.5">
              Alinhar
            </div>
            <div className="grid grid-cols-6 rounded-lg bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 divide-x divide-slate-300/70 dark:divide-zinc-700/70">
              {(
                [
                  { mode: 'left', label: 'Alinhar à esquerda', icon: <AlignLeftIcon /> },
                  { mode: 'centerX', label: 'Centralizar horizontalmente', icon: <AlignCenterXIcon /> },
                  { mode: 'right', label: 'Alinhar à direita', icon: <AlignRightIcon /> },
                  { mode: 'top', label: 'Alinhar ao topo', icon: <AlignTopIcon /> },
                  { mode: 'middleY', label: 'Centralizar verticalmente', icon: <AlignMiddleYIcon /> },
                  { mode: 'bottom', label: 'Alinhar à base', icon: <AlignBottomIcon /> },
                ] as Array<{ mode: AlignMode; label: string; icon: React.ReactNode }>
              ).map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  disabled={!canAlign}
                  onClick={() => onAlign(item.mode)}
                  title={item.label}
                  aria-label={item.label}
                  className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Distribuir + Agrupar */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 px-0.5">
                Distribuir
              </div>
              <div className="grid grid-cols-2 rounded-lg bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 divide-x divide-slate-300/70 dark:divide-zinc-700/70">
                <button
                  type="button"
                  disabled={!canDistribute}
                  onClick={() => onDistribute('horiz')}
                  title={
                    canDistribute
                      ? 'Distribuir horizontalmente'
                      : 'Selecione pelo menos 3 objetos para distribuir'
                  }
                  aria-label="Distribuir horizontalmente"
                  className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <DistributeHorizIcon />
                </button>
                <button
                  type="button"
                  disabled={!canDistribute}
                  onClick={() => onDistribute('vert')}
                  title={
                    canDistribute
                      ? 'Distribuir verticalmente'
                      : 'Selecione pelo menos 3 objetos para distribuir'
                  }
                  aria-label="Distribuir verticalmente"
                  className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <DistributeVertIcon />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 px-0.5">
                Agrupar
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!canGroup}
                  onClick={onGroup}
                  title="Agrupar objetos selecionados"
                  aria-label="Agrupar"
                  className="h-8 flex items-center justify-center rounded-lg bg-slate-200/75 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <GroupIcon />
                </button>
                <button
                  type="button"
                  disabled={!canUngroup}
                  onClick={onUngroup}
                  title="Desagrupar objetos selecionados"
                  aria-label="Desagrupar"
                  className="h-8 flex items-center justify-center rounded-lg bg-slate-200/75 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <UngroupIcon />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Combinar Formas */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 px-0.5">
              Combinar Formas
            </div>
            <div className="grid grid-cols-4 rounded-lg bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 divide-x divide-slate-300/70 dark:divide-zinc-700/70">
              {(
                [
                  { op: 'union', label: 'Unir formas', icon: <BoolUnionIcon /> },
                  { op: 'intersect', label: 'Intersecar formas', icon: <BoolIntersectIcon /> },
                  { op: 'subtract', label: 'Subtrair do 1º selecionado', icon: <BoolSubtractIcon /> },
                  { op: 'exclude', label: 'Excluir sobreposição', icon: <BoolExcludeIcon /> },
                ] as Array<{ op: CombineShapeOp; label: string; icon: React.ReactNode }>
              ).map((item) => (
                <button
                  key={item.op}
                  type="button"
                  disabled={!canCombine}
                  onClick={() => onCombineShapes(item.op)}
                  title={
                    canCombine
                      ? item.label
                      : 'Selecione ao menos 2 círculos ou polígonos fechados'
                  }
                  aria-label={item.label}
                  className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>
          {/* Section: Simetria */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 px-0.5">
              Simetria
            </div>
            <div className="grid grid-cols-2 rounded-lg bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 divide-x divide-slate-300/70 dark:divide-zinc-700/70">
              <button
                type="button"
                disabled={!canTransform}
                onClick={() => onMirror('h')}
                title="Espelhar horizontalmente (↔)"
                aria-label="Espelhar horizontalmente"
                className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <MirrorHorizIcon />
              </button>
              <button
                type="button"
                disabled={!canTransform}
                onClick={() => onMirror('v')}
                title="Espelhar verticalmente (↕)"
                aria-label="Espelhar verticalmente"
                className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <MirrorVertIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Capsule Trigger Bar */}
      <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
        {showAlignTrigger && (
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={open}
            title="Alinhar, distribuir, agrupar, combinar e simetria"
            aria-label="Organizar seleção"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
              open
                ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <PillAlignTriggerIcon />
          </button>
        )}

        {hasScalableSelection && (
          <button
            type="button"
            onClick={onToggleScaleLock}
            aria-pressed={scaleLockState === 'all'}
            title={
              scaleLockState === 'all'
                ? 'Escala travada — clique para liberar redimensionamento'
                : 'Travar escala dos objetos selecionados'
            }
            className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-full font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
              scaleLockState === 'all'
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : scaleLockState === 'partial'
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70'
                  : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            {scaleLockState === 'all' ? (
              <Lock className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Unlock className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {scaleLockState === 'all'
                ? 'Escala travada'
                : scaleLockState === 'partial'
                  ? 'Travar escala'
                  : 'Travar escala'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

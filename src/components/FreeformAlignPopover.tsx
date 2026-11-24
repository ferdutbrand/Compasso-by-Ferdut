import React, { useState } from 'react';
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
  onDistribute: (axis: DistributeAxis, gapPx?: number) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onCombineShapes: (op: CombineShapeOp) => void;
  onMirror: (axis: MirrorAxis) => void;
  onToggleScaleLock: () => void;
  onStartTan: () => void;
  onDuplicate: () => void;
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
    <rect x="5" y="4.5" width="8" height="3.2" rx="0.8" />
    <rect x="3" y="10.3" width="12" height="3.2" rx="0.8" />
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
    <rect x="4.5" y="3" width="3.2" height="12" rx="0.8" />
    <rect x="10.3" y="5" width="3.2" height="8" rx="0.8" />
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

const GroupMenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const TangentMenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7" cy="12" r="5" />
    <circle cx="17" cy="12" r="5" />
  </svg>
);

const AlignSymmetryMenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="18" rx="1" />
    <rect x="14" y="3" width="7" height="18" rx="1" />
  </svg>
);

const DuplicateMenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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

export const FreeformAlignPopover: React.FC<FreeformAlignPopoverProps> = ({
  open,
  onToggleOpen,
  anchorScreenX,
  anchorScreenY,
  containerW,
  unitCount,
  canGroup,
  canUngroup,
  hasScalableSelection,
  scaleLockState,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
  onMirror,
  onToggleScaleLock,
  onStartTan,
  onDuplicate,
}) => {
  const [distributeGapInput, setDistributeGapInput] = useState('');

  const showTrigger = unitCount >= 1 || canUngroup;
  if (!showTrigger && !hasScalableSelection) return null;

  const clampedX = Math.min(Math.max(150, anchorScreenX), Math.max(150, containerW - 150));
  const flipBelow = anchorScreenY < 340;
  const clampedY = Math.max(52, anchorScreenY - 14);

  const parsedGapRaw = distributeGapInput.trim().replace(',', '.');
  const parsedGapVal = parsedGapRaw === '' ? NaN : Number(parsedGapRaw);
  const hasCustomGap = parsedGapRaw !== '' && Number.isFinite(parsedGapVal) && parsedGapVal >= 0;

  const canAlign = unitCount >= 2;
  const canDistribute = unitCount >= 3 || (unitCount >= 2 && hasCustomGap);
  const canTransform = unitCount >= 1;

  const handleDistributeClick = (axis: DistributeAxis) => {
    onDistribute(axis, hasCustomGap ? parsedGapVal : undefined);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ left: clampedX, top: clampedY }}
      className="absolute z-20 -translate-x-1/2 -translate-y-full pointer-events-auto select-none"
    >
      {/* Floating Popover Panel when Alinhar/Distribuir/Simetria is clicked */}
      {open && (
        <div
          role="dialog"
          aria-label="Alinhar, distribuir e simetria"
          className={`absolute left-1/2 -translate-x-1/2 w-[272px] rounded-2xl border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl p-3.5 space-y-3 text-xs text-slate-800 dark:text-zinc-100 ${
            flipBelow ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          }`}
        >
          {/* Caret pointer */}
          <div
            aria-hidden="true"
            className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-700 ${
              flipBelow
                ? '-top-1.5 border-l border-t'
                : '-bottom-1.5 border-r border-b'
            }`}
          />

          {/* Section: Alinhar */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 px-0.5">
              Alinhar
            </div>
            <div className="grid grid-cols-6 rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 divide-x divide-slate-200 dark:divide-zinc-700">
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
                  title={canAlign ? item.label : 'Selecione ao menos 2 objetos para alinhar'}
                  aria-label={item.label}
                  className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Distribuir com pixel opcional */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                Distribuir (espaçamento px)
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={distributeGapInput}
                  onChange={(e) => setDistributeGapInput(e.target.value)}
                  placeholder="Auto"
                  title="Valor em pixels de espaçamento opcional (vazio = automático)"
                  className="w-14 h-5 text-right font-mono text-[11px] px-1 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 focus-visible:outline-2 focus-visible:outline-blue-600"
                />
                <span className="text-[10px] text-slate-400">px</span>
              </div>
            </div>
            <div className="grid grid-cols-2 rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 divide-x divide-slate-200 dark:divide-zinc-700">
              <button
                type="button"
                disabled={!canDistribute}
                onClick={() => handleDistributeClick('horiz')}
                title={canDistribute ? 'Distribuir horizontalmente' : 'Selecione 3+ objetos (ou 2+ com valor em px)'}
                aria-label="Distribuir horizontalmente"
                className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <DistributeHorizIcon />
              </button>
              <button
                type="button"
                disabled={!canDistribute}
                onClick={() => handleDistributeClick('vert')}
                title={canDistribute ? 'Distribuir verticalmente' : 'Selecione 3+ objetos (ou 2+ com valor em px)'}
                aria-label="Distribuir verticalmente"
                className="h-7 flex items-center justify-center rounded text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <DistributeVertIcon />
              </button>
            </div>
          </div>

          {/* Section: Simetria */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 px-0.5">
              Simetria
            </div>
            <div className="grid grid-cols-2 rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5 divide-x divide-slate-200 dark:divide-zinc-700">
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

      {/* Floating 5-Icon Situational Capsule (matching image_e4c37934.png UI reference) */}
      <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl text-xs">
        {/* 1. Agrupar / Desagrupar */}
        <button
          type="button"
          disabled={!canGroup && !canUngroup}
          onClick={canUngroup ? onUngroup : onGroup}
          title={canUngroup ? 'Desagrupar objetos selecionados' : canGroup ? 'Agrupar objetos selecionados' : 'Selecione 2+ objetos para agrupar'}
          aria-label="Agrupar ou desagrupar"
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <GroupMenuIcon />
        </button>

        {/* 2. Tangência a partir de forma selecionada */}
        <button
          type="button"
          disabled={unitCount === 0}
          onClick={onStartTan}
          title="Tangência a partir de forma selecionada (1 a 4 objetos)"
          aria-label="Tangência a partir de forma selecionada"
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <TangentMenuIcon />
        </button>

        {/* 3. Alinhar, distribuir e simetria */}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          title="Alinhar, distribuir e simetria"
          aria-label="Alinhar, distribuir e simetria"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
            open
              ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <AlignSymmetryMenuIcon />
        </button>

        {/* 4. Duplicar */}
        <button
          type="button"
          disabled={unitCount === 0}
          onClick={onDuplicate}
          title="Duplicar seleção (Ctrl+D / Cmd+D)"
          aria-label="Duplicar seleção"
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <DuplicateMenuIcon />
        </button>

        {/* 5. Bloquear escala */}
        <button
          type="button"
          onClick={onToggleScaleLock}
          aria-pressed={scaleLockState === 'all'}
          title={
            scaleLockState === 'all'
              ? 'Escala travada — clique para liberar redimensionamento'
              : 'Bloquear escala dos objetos selecionados'
          }
          aria-label="Bloquear escala"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
            scaleLockState === 'all'
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : scaleLockState === 'partial'
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70'
                : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          {scaleLockState === 'all' ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Unlock className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

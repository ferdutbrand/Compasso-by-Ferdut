import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Focus,
  Layers,
  Lock,
  Magnet,
  Plus,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import type { Phase } from '../geometry/types';

export const PHASE_COLOR_PALETTE: Array<{ hex: string; label: string }> = [
  { hex: '#111827', label: 'Preto (Silhueta)' },
  { hex: '#059669', label: 'Verde (Vincos)' },
  { hex: '#2563eb', label: 'Azul (Detalhes)' },
  { hex: '#d97706', label: 'Âmbar (Dobras)' },
  { hex: '#9333ea', label: 'Roxo (Construção)' },
  { hex: '#e11d48', label: 'Carmim (Cortes)' },
];

export function phaseDisplayColor(hex: string, dark: boolean): string {
  if (dark && hex.toLowerCase() === '#111827') return '#e4e4e7';
  return hex;
}

export interface PhaseCounts {
  curves: number;
  points: number;
  shapes: number;
}

interface PhaseTimelineProps {
  phases: Phase[];
  activePhaseId: string;
  dark: boolean;
  focusMode: boolean;
  crossPhaseSnap: boolean;
  countsByPhase: Record<string, PhaseCounts>;
  onSelectPhase: (id: string) => void;
  onAddPhase: () => void;
  onUpdatePhase: (id: string, patch: Partial<Phase>) => void;
  onRequestDeletePhase: (id: string) => void;
  onToggleFocusMode: () => void;
  onToggleCrossPhaseSnap: () => void;
}

export const PhaseTimeline: React.FC<PhaseTimelineProps> = ({
  phases,
  activePhaseId,
  dark,
  focusMode,
  crossPhaseSnap,
  countsByPhase,
  onSelectPhase,
  onAddPhase,
  onUpdatePhase,
  onRequestDeletePhase,
  onToggleFocusMode,
  onToggleCrossPhaseSnap,
}) => {
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const [pinnedPhaseId, setPinnedPhaseId] = useState<string | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);

  const openPhaseId = pinnedPhaseId ?? hoveredPhaseId;
  const activeIdx = Math.max(
    0,
    phases.findIndex((p) => p.id === activePhaseId)
  );
  const activePhase = phases[activeIdx] ?? phases[0];

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setPinnedPhaseId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedPhaseId(null);
        setHoveredPhaseId(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const scheduleHoverOpen = (id: string) => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredPhaseId(id);
  };

  const scheduleHoverClose = (id: string) => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredPhaseId((curr) => (curr === id ? null : curr));
      hoverTimerRef.current = null;
    }, 140);
  };

  const activeColor = activePhase ? phaseDisplayColor(activePhase.color, dark) : '#111827';

  return (
    <section
      ref={dockRef}
      aria-label="Linha do tempo de fases"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-24px)] select-none"
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm shadow-lg">
        {/* Active phase summary */}
        {activePhase && (
          <div className="flex items-center gap-2 pr-2.5 border-r border-slate-200 dark:border-zinc-800 shrink-0">
            <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" aria-hidden="true" />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15 dark:border-white/20"
              style={{ backgroundColor: activeColor }}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100 whitespace-nowrap max-w-28 truncate">
              {activeIdx + 1}. {activePhase.name}
            </span>
            {activePhase.locked && (
              <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" aria-label="Fase bloqueada" />
            )}
          </div>
        )}

        {/* Scrubber + Phase Circular Nodes */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="relative flex items-center gap-2">
            {/* Connecting track line behind nodes */}
            {phases.length > 1 && (
              <div
                aria-hidden="true"
                className="absolute left-3.5 right-3.5 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 dark:bg-zinc-700 pointer-events-none"
              />
            )}

            {phases.map((p, idx) => {
              const isActive = p.id === activePhaseId;
              const isOpen = openPhaseId === p.id;
              const dispColor = phaseDisplayColor(p.color, dark);
              const isDarkFill = dark && p.color.toLowerCase() === '#111827';
              const counts = countsByPhase[p.id] ?? { curves: 0, points: 0, shapes: 0 };
              const bothHidden = !p.showGeometry && !p.showPath;

              return (
                <div
                  key={p.id}
                  className="relative flex items-center justify-center"
                  onMouseEnter={() => scheduleHoverOpen(p.id)}
                  onMouseLeave={() => scheduleHoverClose(p.id)}
                >
                  {/* Interactive Hover/Click Tooltip Popover with Geometria + Path sublayers */}
                  {isOpen && (
                    <div
                      role="dialog"
                      aria-label={`Camadas da fase ${p.name}`}
                      onMouseEnter={() => scheduleHoverOpen(p.id)}
                      onMouseLeave={() => scheduleHoverClose(p.id)}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2.5 z-30"
                    >
                      <div className="w-64 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-3 space-y-2.5 text-xs">
                        {/* Phase Name + Lock + Close */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15 dark:border-white/20"
                            style={{ backgroundColor: dispColor }}
                            aria-hidden="true"
                          />
                          <input
                            type="text"
                            aria-label={`Nome da fase ${idx + 1}`}
                            value={p.name}
                            maxLength={28}
                            onChange={(e) => onUpdatePhase(p.id, { name: e.target.value })}
                            onBlur={(e) => {
                              if (!e.target.value.trim()) {
                                onUpdatePhase(p.id, { name: `Fase ${idx + 1}` });
                              }
                            }}
                            className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-medium text-slate-900 dark:text-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() => onUpdatePhase(p.id, { locked: !p.locked })}
                            title={p.locked ? 'Destravar fase para edição' : 'Travar fase contra edições'}
                            aria-pressed={p.locked}
                            aria-label={p.locked ? 'Destravar fase' : 'Travar fase'}
                            className={`p-1.5 rounded border transition-colors cursor-pointer shrink-0 ${
                              p.locked
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {p.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          {pinnedPhaseId === p.id && (
                            <button
                              type="button"
                              onClick={() => setPinnedPhaseId(null)}
                              aria-label="Fechar painel da fase"
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Color swatches */}
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400">Cor</span>
                          <div className="flex items-center gap-1.5" role="group" aria-label="Cor da fase">
                            {PHASE_COLOR_PALETTE.map((sw) => {
                              const selected = p.color.toLowerCase() === sw.hex.toLowerCase();
                              const swDisp = phaseDisplayColor(sw.hex, dark);
                              return (
                                <button
                                  key={sw.hex}
                                  type="button"
                                  title={sw.label}
                                  aria-label={sw.label}
                                  aria-pressed={selected}
                                  onClick={() => onUpdatePhase(p.id, { color: sw.hex })}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                                    selected
                                      ? 'scale-110 ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-zinc-900 border-white/50'
                                      : 'border-black/20 dark:border-white/25 hover:scale-105'
                                  }`}
                                  style={{ backgroundColor: swDisp }}
                                >
                                  {selected && (
                                    <Check
                                      className={`w-3 h-3 ${
                                        dark && sw.hex === '#111827' ? 'text-zinc-900' : 'text-white'
                                      }`}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Sublayers: Geometria & Path */}
                        <div className="space-y-2 border-t border-slate-200 dark:border-zinc-800 pt-2">
                          {/* Sublayer 1: Geometria */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onUpdatePhase(p.id, { showGeometry: !p.showGeometry })}
                                aria-pressed={p.showGeometry}
                                className={`inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer ${
                                  p.showGeometry
                                    ? 'text-slate-800 dark:text-zinc-100'
                                    : 'text-slate-400 dark:text-zinc-500 line-through'
                                }`}
                              >
                                {p.showGeometry ? (
                                  <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                                <span>Geometria</span>
                              </button>
                              <span className="font-mono tabular-nums text-[10.5px] text-slate-500 dark:text-zinc-400">
                                {counts.curves}c · {Math.round(p.geometryOpacity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              aria-label={`Opacidade da geometria da fase ${p.name}`}
                              min={0}
                              max={100}
                              step={5}
                              disabled={!p.showGeometry}
                              value={Math.round(p.geometryOpacity * 100)}
                              onChange={(e) =>
                                onUpdatePhase(p.id, {
                                  geometryOpacity: Number(e.target.value) / 100,
                                })
                              }
                              className="w-full h-1.5 accent-blue-600 cursor-pointer disabled:opacity-40"
                            />
                          </div>

                          {/* Sublayer 2: Path */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onUpdatePhase(p.id, { showPath: !p.showPath })}
                                aria-pressed={p.showPath}
                                className={`inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer ${
                                  p.showPath
                                    ? 'text-slate-800 dark:text-zinc-100'
                                    : 'text-slate-400 dark:text-zinc-500 line-through'
                                }`}
                              >
                                {p.showPath ? (
                                  <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                                <span>Path</span>
                              </button>
                              <span className="font-mono tabular-nums text-[10.5px] text-slate-500 dark:text-zinc-400">
                                {counts.shapes}f · {Math.round(p.pathOpacity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              aria-label={`Opacidade dos paths da fase ${p.name}`}
                              min={0}
                              max={100}
                              step={5}
                              disabled={!p.showPath}
                              value={Math.round(p.pathOpacity * 100)}
                              onChange={(e) =>
                                onUpdatePhase(p.id, {
                                  pathOpacity: Number(e.target.value) / 100,
                                })
                              }
                              className="w-full h-1.5 accent-emerald-600 cursor-pointer disabled:opacity-40"
                            />
                          </div>
                        </div>

                        {/* Delete Phase button (always guarded by safety confirmation dialog) */}
                        <div className="flex items-center justify-between gap-2 border-t border-slate-200 dark:border-zinc-800 pt-2">
                          {!isActive ? (
                            <button
                              type="button"
                              onClick={() => onSelectPhase(p.id)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Ativar fase
                            </button>
                          ) : (
                            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                              Fase ativa
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={phases.length <= 1}
                            onClick={() => {
                              setPinnedPhaseId(null);
                              setHoveredPhaseId(null);
                              onRequestDeletePhase(p.id);
                            }}
                            title={
                              phases.length <= 1
                                ? 'É necessário manter pelo menos 1 fase'
                                : `Excluir fase "${p.name}"`
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-40 disabled:pointer-events-none font-medium whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Circular Phase Node */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPhase(p.id);
                      setPinnedPhaseId((curr) => (curr === p.id ? null : p.id));
                    }}
                    title={`${idx + 1}. ${p.name} — clique para ativar/abrir camadas ([ / ] alterna)`}
                    aria-label={`Fase ${idx + 1}: ${p.name}${isActive ? ' (ativa)' : ''}`}
                    aria-pressed={isActive}
                    aria-expanded={isOpen}
                    className={`relative z-10 w-7 h-7 rounded-full font-mono text-[11px] font-bold flex items-center justify-center border-2 transition-transform duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      isActive
                        ? 'scale-110 ring-2 ring-blue-600/35 dark:ring-blue-400/40 shadow-sm'
                        : 'hover:scale-105 opacity-85 hover:opacity-100'
                    } ${bothHidden ? 'opacity-45' : ''}`}
                    style={
                      isActive
                        ? {
                            backgroundColor: dispColor,
                            borderColor: dark ? '#18181b' : '#ffffff',
                            color: isDarkFill ? '#111827' : '#ffffff',
                          }
                        : {
                            backgroundColor: dark ? '#18181b' : '#ffffff',
                            borderColor: dispColor,
                            color: dispColor,
                          }
                    }
                  >
                    <span>{idx + 1}</span>
                    {p.locked && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center border border-white dark:border-zinc-900"
                      >
                        <Lock className="w-2 h-2" />
                      </span>
                    )}
                    {!p.locked && bothHidden && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-500 text-white flex items-center justify-center border border-white dark:border-zinc-900"
                      >
                        <EyeOff className="w-2 h-2" />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Add new phase (+) button */}
            <button
              type="button"
              onClick={onAddPhase}
              title="Adicionar nova fase"
              aria-label="Adicionar nova fase"
              className="relative z-10 w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Horizontal scrubber slider to slide across phases smoothly */}
          {phases.length > 1 && (
            <input
              type="range"
              aria-label="Deslizar entre fases"
              title="Deslize para navegar entre fases (ou use [ e ])"
              min={0}
              max={phases.length - 1}
              step={1}
              value={activeIdx}
              onChange={(e) => {
                const target = phases[Number(e.target.value)];
                if (target) onSelectPhase(target.id);
              }}
              className="w-full h-1 accent-blue-600 cursor-pointer"
            />
          )}
        </div>

        {/* Focus & Cross-Phase Snap controls */}
        <div className="flex items-center gap-1.5 pl-2.5 border-l border-slate-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onToggleFocusMode}
            aria-pressed={focusMode}
            title="Modo Foco: atenua a geometria das outras fases mantendo os paths legíveis"
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              focusMode
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Focus className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Foco</span>
          </button>

          <button
            type="button"
            onClick={onToggleCrossPhaseSnap}
            aria-pressed={crossPhaseSnap}
            title={
              crossPhaseSnap
                ? 'Snap entre fases ligado (encaixa em curvas e interseções de outras fases visíveis)'
                : 'Snap restrito à fase ativa'
            }
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              crossPhaseSnap
                ? 'bg-slate-900 dark:bg-zinc-100 border-slate-900 dark:border-zinc-100 text-white dark:text-zinc-900'
                : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Magnet className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Snap fases</span>
          </button>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import {
  Circle,
  Crosshair,
  Grid3X3,
  Lock,
  RotateCw,
  Square,
  Unlock,
  X,
} from 'lucide-react';
import type { GridConfig, GridKind, SizeRule } from '../geometry/grid';
import { optKey } from '../geometry/types';

interface GridPopoverProps {
  config: GridConfig;
  onChange: (patch: Partial<GridConfig>) => void;
  onCenterOrigin: () => void;
  onGenerateFibGeometry: (mode: 'squares' | 'circles' | 'both') => void;
  onClose: () => void;
}

const GRID_KINDS: Array<{ id: GridKind; label: string }> = [
  { id: 'fibonacci', label: 'Fibonacci' },
  { id: 'modular', label: 'Modular' },
  { id: 'isometric', label: 'Isométrico' },
  { id: 'phi', label: 'Áureo (φ)' },
  { id: 'polar', label: 'Polar' },
];

const SIZE_RULES: Array<{ id: SizeRule; label: string; hint: string }> = [
  { id: 'free', label: 'Livre', hint: 'Qualquer medida' },
  { id: 'fibonacci', label: 'Fibonacci', hint: '1u, 2u, 3u, 5u, 8u...' },
  { id: 'golden', label: 'Áurea (φ)', hint: 'u × 1,618^k' },
  { id: 'modular', label: 'Modular', hint: 'Múltiplos do módulo u' },
];

export const GridPopover: React.FC<GridPopoverProps> = ({
  config,
  onChange,
  onCenterOrigin,
  onGenerateFibGeometry,
  onClose,
}) => {
  const selectKind = (kind: GridKind) => {
    const patch: Partial<GridConfig> = { kind, enabled: true };
    if (kind === 'fibonacci' && config.sizeRule === 'free') {
      patch.sizeRule = 'fibonacci';
    } else if (kind === 'phi' && config.sizeRule === 'free') {
      patch.sizeRule = 'golden';
    } else if (kind === 'modular' && config.sizeRule === 'free') {
      patch.sizeRule = 'modular';
    }
    onChange(patch);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-3 right-3 z-20 w-[300px] max-w-[calc(100vw-24px)] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm shadow-xl p-3 text-xs text-slate-800 dark:text-zinc-100 space-y-3 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100">
          <Grid3X3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Grid &amp; Regras de Tamanho</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel de grid"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main toggles */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ enabled: !config.enabled })}
          aria-pressed={config.enabled}
          className={`px-2.5 py-1.5 rounded-md border font-medium transition-colors cursor-pointer ${
            config.enabled
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          {config.enabled ? 'Grid visível' : 'Grid oculto'}
        </button>
        <button
          type="button"
          onClick={() => onChange({ snap: !config.snap })}
          disabled={!config.enabled}
          aria-pressed={config.snap}
          className={`px-2.5 py-1.5 rounded-md border font-medium transition-colors cursor-pointer disabled:opacity-40 ${
            config.snap && config.enabled
              ? 'bg-slate-900 dark:bg-zinc-100 border-slate-900 dark:border-zinc-100 text-white dark:text-zinc-900'
              : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          {config.snap ? 'Snap no grid: ON' : 'Snap no grid: OFF'}
        </button>
      </div>

      {/* Grid Kind */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
          Sistema de grid
        </div>
        <div className="grid grid-cols-3 gap-1">
          {GRID_KINDS.map((k) => {
            const active = config.enabled && config.kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => selectKind(k.id)}
                className={`px-2 py-1.5 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Size Rule */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
            Regra de tamanho (Ø / Lado)
          </span>
          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
            {optKey} = livre
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {SIZE_RULES.map((r) => {
            const active = config.sizeRule === r.id;
            return (
              <button
                key={r.id}
                type="button"
                title={r.hint}
                onClick={() => onChange({ sizeRule: r.id })}
                className={`px-2 py-1.5 rounded border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="font-medium leading-tight">{r.label}</div>
                <div
                  className={`text-[10px] font-mono truncate ${
                    active ? 'text-emerald-100' : 'text-slate-400 dark:text-zinc-500'
                  }`}
                >
                  {r.hint}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onChange({ lockScale: !config.lockScale })}
          aria-pressed={config.lockScale}
          title="Quando ativo, novos círculos e polígonos já nascem com escala travada (podem ser movidos sem alterar o tamanho)"
          className={`w-full inline-flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border font-medium transition-colors cursor-pointer ${
            config.lockScale
              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {config.lockScale ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>Travar escala dos novos objetos</span>
          </span>
          <span className="font-mono text-[10px] uppercase">
            {config.lockScale ? 'Ativo' : 'Livre'}
          </span>
        </button>
      </div>

      {/* Base Unit u / M */}
      <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
            Módulo base (u)
          </span>
          <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-zinc-100">
            {config.unit} px
          </span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          step={1}
          value={config.unit}
          onChange={(e) => onChange({ unit: parseInt(e.target.value, 10) })}
          className="w-full accent-blue-600 cursor-pointer"
        />
        <div className="flex items-center justify-between gap-1">
          {[8, 13, 20, 21, 34].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ unit: preset })}
              className={`flex-1 py-1 rounded border font-mono text-[11px] tabular-nums cursor-pointer ${
                config.unit === preset
                  ? 'bg-slate-900 dark:bg-zinc-100 border-slate-900 dark:border-zinc-100 text-white dark:text-zinc-900 font-semibold'
                  : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Subdivisions (for Modular, Isometric, Polar) */}
      {(config.kind === 'modular' || config.kind === 'isometric' || config.kind === 'polar') && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
            Subdivisões
          </span>
          <div className="inline-flex rounded border border-slate-200 dark:border-zinc-700 overflow-hidden">
            {[1, 2, 4].map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => onChange({ subdivisions: sub })}
                className={`px-2.5 py-1 font-mono text-[11px] cursor-pointer ${
                  config.subdivisions === sub
                    ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                    : 'bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                {sub}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fibonacci specific controls */}
      {config.kind === 'fibonacci' && (
        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              Passos Fibonacci ({config.fibSteps})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange({ fibSteps: Math.max(4, config.fibSteps - 1) })}
                className="px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => onChange({ fibSteps: Math.min(11, config.fibSteps + 1) })}
                className="px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                +
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({ fibRotation: ((config.fibRotation + 1) % 4) as 0 | 1 | 2 | 3 })
                }
                title="Rotacionar espiral em 90°"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                <span className="font-mono">{config.fibRotation * 90}°</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.fibShowSpiral}
                onChange={(e) => onChange({ fibShowSpiral: e.target.checked })}
                className="accent-blue-600"
              />
              <span>Espiral áurea</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.fibShowCircles}
                onChange={(e) => onChange({ fibShowCircles: e.target.checked })}
                className="accent-blue-600"
              />
              <span>Círculos inscritos</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.fibShowLabels}
                onChange={(e) => onChange({ fibShowLabels: e.target.checked })}
                className="accent-blue-600"
              />
              <span>Rótulos</span>
            </label>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              Materializar na fase ativa
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onGenerateFibGeometry('squares')}
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30 font-medium cursor-pointer"
              >
                <Square className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>Gerar quadrados</span>
              </button>
              <button
                type="button"
                onClick={() => onGenerateFibGeometry('circles')}
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30 font-medium cursor-pointer"
              >
                <Circle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>Gerar círculos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Origin reset */}
      <div className="pt-1 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCenterOrigin}
          className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-800 font-medium cursor-pointer"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Centralizar origem do grid na tela</span>
        </button>
      </div>
    </div>
  );
};

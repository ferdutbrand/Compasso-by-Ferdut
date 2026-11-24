import React, { memo, useMemo } from 'react';
import {
  ArrowLeftRight,
  Clipboard,
  ClipboardPaste,
  Combine,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Minus,
  Plus,
  Square,
  Target,
  Trash2,
  Unlink,
  Unlock,
  X,
} from 'lucide-react';
import {
  clipLine,
  curve,
  getAlignUnitCount,
  getObj,
  getSelectionBoundingBox,
  guideToCurve,
  type CircleEditInfo,
} from '../geometry/engine';
import {
  computeFibonacciTiles,
  getSizeRuleOptions,
  PHI,
  type GridConfig,
  type SizeRule,
} from '../geometry/grid';
import type { AtomicRegion } from '../geometry/shapeBuilder';
import type {
  AlignMode,
  BuiltShape,
  CircleToolMode,
  CombineShapeOp,
  CreationOrigin,
  Curve,
  DimMode,
  DistributeAxis,
  EditState,
  GeomObj,
  GhostPreview,
  GuideLine,
  LineToolMode,
  MirrorAxis,
  Phase,
  PointObj,
  RefImage,
  SmartGuide,
  SnapResult,
  TanTargetSel,
  TangencyCandidate,
  ToolId,
  ViewState,
} from '../geometry/types';
import { delKey, modKey, optKey } from '../geometry/types';
import { FreeformAlignPopover } from './FreeformAlignPopover';
import { GridPopover } from './GridPopover';
import { PhaseTimeline, phaseDisplayColor, type PhaseCounts } from './PhaseTimeline';

export interface MarqueeBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface CanvasStageProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  objs: GeomObj[];
  curveCache: Array<Curve | null>;
  view: ViewState;
  size: { w: number; h: number };
  tool: ToolId;
  dark: boolean;
  pend: number[];
  tcSel: number[];
  tanSel: TanTargetSel[];
  hoveredTanTarget: number | null;
  tanVariantIdx: number;
  tanVariantCount: number;
  selectedIds: Set<number>;
  selectedShapeIds: Set<string>;
  prio: Set<number>;
  edit: EditState | null;
  hover: SnapResult | null;
  ghost: GhostPreview | null;
  marquee: MarqueeBox | null;
  smartGuides: SmartGuide[];
  dimMode: DimMode;
  hasClipboard: boolean;
  refImgs: RefImage[];
  activeRefId: string | null;
  onSelectRefImg: (id: string) => void;
  onToggleRefLock: (id: string) => void;
  onRemoveRefImage: (id: string) => void;
  onChangeRefOpacity: (id: string, opacity: number) => void;
  showRulers: boolean;
  guides: GuideLine[];
  guidesVisible: boolean;
  guidesLocked: boolean;
  selectedGuideId: string | null;
  hoveredGuideKind: 'h' | 'v' | 'a' | null;
  guidePreview: GuideLine | null;
  rulerStart: { x: number; y: number } | null;
  cursorWorld: { x: number; y: number } | null;
  spaceDown: boolean;
  altDown: boolean;
  isPanning: boolean;
  isDragging: boolean;
  editingDim: { id: number; kind: 'ci' | 'pg'; cx: number; cy: number; val: number } | null;
  dimDraft: string;
  dimError: string | null;
  gridConfig: GridConfig;
  showGridPanel: boolean;
  lineMode: LineToolMode;
  onChangeLineMode: (mode: LineToolMode) => void;
  circleMode: CircleToolMode;
  onChangeCircleMode: (mode: CircleToolMode) => void;
  tgActive: boolean;
  shiftDown: boolean;
  onToggleTg: () => void;
  polySides: number;
  creationOrigin: CreationOrigin;
  onChangeCreationOrigin: (origin: CreationOrigin) => void;
  tanSnapEnabled: boolean;
  phases: Phase[];
  activePhaseId: string;
  focusMode: boolean;
  crossPhaseSnap: boolean;
  countsByPhase: Record<string, PhaseCounts>;
  shapes: BuiltShape[];
  shapeMode: 'add' | 'sub';
  shapeScope: 'phase' | 'all';
  shapeRegions: AtomicRegion[];
  hoveredShapeRegionId: string | null;
  dragShapeRegionIds: Set<string>;
  dragShapePreviewPath: string;
  lockNotice: string | null;
  onOpenDimEditor: (objId: number, kind: 'ci' | 'pg', cx: number, cy: number, val: number) => void;
  onChangeDimDraft: (v: string) => void;
  onCommitDimEdit: (overrideVal?: number) => void;
  onCancelDimEdit: () => void;
  onChangeGridConfig: (patch: Partial<GridConfig>) => void;
  onCenterGridOrigin: () => void;
  onGenerateFibGeometry: (mode: 'squares' | 'circles' | 'both') => void;
  onCloseGridPanel: () => void;
  onChangePolySides: (sides: number) => void;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  onDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  onStartRulerGuide: (kind: 'h' | 'v', e: React.PointerEvent<SVGSVGElement>) => void;
  onToggleGuidesVisible: () => void;
  onToggleGuidesLocked: () => void;
  onDeleteSelectedGuide: () => void;
  onClearGuides: () => void;
  onCopySelected: () => void;
  onPasteClipboard: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onDeleteSelectedShapes: () => void;
  onMoveSelectedShapesToPhase: (phaseId: string) => void;
  onClearShapeSelection: () => void;
  onClearPrio: () => void;

  onCancelEdit: () => void;
  onCreateTanCircle: () => void;
  onCycleTanVariant: () => void;
  onClearTanSel: () => void;
  onStartTanFromSelection: () => void;
  selTanCandidates: TangencyCandidate[];
  hoveredSelTanCand: TangencyCandidate | null;
  dragTanOverlay: { candidates: TangencyCandidate[]; active: TangencyCandidate | null } | null;
  onSwapSelectionOrder: () => void;
  selectedEditInfo: CircleEditInfo | null;
  selectedConstraintInfo: { id: number; parentIds: number[]; constraintCount: number; isLocked: boolean } | null;
  hoveredResizeGrip: boolean;
  onReleaseTangency: (mode: 'one' | 'all') => void;
  onChangeShapeMode: (mode: 'add' | 'sub') => void;
  onChangeShapeScope: (scope: 'phase' | 'all') => void;
  onClearPhaseShapes: () => void;
  onMoveSelectedToPhase: (phaseId: string) => void;
  onUnlockActivePhase: () => void;
  onSelectPhase: (id: string) => void;
  onAddPhase: () => void;
  onUpdatePhase: (id: string, patch: Partial<Phase>) => void;
  onRequestDeletePhase: (id: string) => void;
  onToggleFocusMode: () => void;
  onToggleCrossPhaseSnap: () => void;
  alignPopoverOpen: boolean;
  onToggleAlignPopover: () => void;
  onAlignSelection: (mode: AlignMode) => void;
  onDistributeSelection: (axis: DistributeAxis) => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onCombineSelectedShapes: (op: CombineShapeOp) => void;
  onMirrorSelection: (axis: MirrorAxis) => void;
  onRadialArraySelection: (count: number) => void;
  onToggleScaleLockSelection: () => void;
}

type RenderedCurve =
  | { id: number; phaseId: string; kind: 'c'; cx: number; cy: number; r: number; scaleLocked?: boolean }
  | { id: number; phaseId: string; kind: 'l'; pts: [number, number, number, number] }
  | {
      id: number;
      phaseId: string;
      kind: 'p';
      points: string;
      cx: number;
      cy: number;
      side: number;
      sides: number;
      scaleLocked?: boolean;
    };

function refPt(r: RefImage, lx: number, ly: number): [number, number] {
  const a = ((r.r || 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [r.x + r.w / 2 + lx * c - ly * s, r.y + r.h / 2 + lx * s + ly * c];
}

function formatDim(val: number, prefix: string): string {
  const rounded = Math.round(val * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${prefix} ${str}`;
}

const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];

function pickMajorStep(k: number): number {
  for (const s of NICE_STEPS) {
    if (s * k >= 64) return s;
  }
  return 10000;
}

interface RulerTicks {
  hTicks: Array<{ pos: number; world: number; major: boolean }>;
  vTicks: Array<{ pos: number; world: number; major: boolean }>;
}

const TopRulerTicks = memo(function TopRulerTicks({
  ticks,
}: {
  ticks: RulerTicks['hTicks'];
}) {
  return (
    <>
      {ticks.map((t, i) => (
        <g key={`ht-${i}`} transform={`translate(${t.pos} 0)`}>
          <line
            x1={0}
            y1={t.major ? 4 : 16}
            x2={0}
            y2={24}
            stroke="currentColor"
            className={t.major ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-300 dark:text-zinc-700'}
            strokeWidth={1}
          />
          {t.major && (
            <text
              x={3}
              y={12}
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
              fill="currentColor"
              className="text-slate-600 dark:text-zinc-400"
            >
              {t.world}
            </text>
          )}
        </g>
      ))}
    </>
  );
});

const LeftRulerTicks = memo(function LeftRulerTicks({
  ticks,
}: {
  ticks: RulerTicks['vTicks'];
}) {
  return (
    <>
      {ticks.map((t, i) => (
        <g key={`vt-${i}`} transform={`translate(0 ${t.pos})`}>
          <line
            x1={t.major ? 4 : 16}
            y1={0}
            x2={24}
            y2={0}
            stroke="currentColor"
            className={t.major ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-300 dark:text-zinc-700'}
            strokeWidth={1}
          />
          {t.major && (
            <text
              x={11}
              y={-3}
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
              fill="currentColor"
              transform="rotate(-90 11 -3)"
              className="text-slate-600 dark:text-zinc-400"
            >
              {t.world}
            </text>
          )}
        </g>
      ))}
    </>
  );
});

interface DraftingGuidesLayerProps {
  guides: GuideLine[];
  guidesVisible: boolean;
  guidesLocked: boolean;
  selectedGuideId: string | null;
  guidePreview: GuideLine | null;
  invK: number;
  vpX0: number;
  vpY0: number;
  vpX1: number;
  vpY1: number;
}

const DraftingGuidesLayer = memo(function DraftingGuidesLayer({
  guides,
  guidesVisible,
  guidesLocked,
  selectedGuideId,
  guidePreview,
  invK,
  vpX0,
  vpY0,
  vpX1,
  vpY1,
}: DraftingGuidesLayerProps) {
  const dashPattern = guidesLocked
    ? `${4 * invK} ${4 * invK}`
    : `${7 * invK} ${4 * invK}`;

  const renderGuide = (g: GuideLine, key: string, isPreview: boolean = false) => {
    const isSelected = !isPreview && g.id === selectedGuideId;
    const strokeColor = isSelected ? '#e11d48' : guidesLocked ? '#d97706' : '#0891b2';
    const pts = clipLine(guideToCurve(g), vpX0, vpY0, vpX1, vpY1);
    if (!pts) return null;
    return (
      <g key={key} style={{ pointerEvents: 'none' }}>
        {isSelected && (
          <line
            x1={pts[0]}
            y1={pts[1]}
            x2={pts[2]}
            y2={pts[3]}
            stroke="#e11d48"
            strokeWidth={4 * invK}
            opacity={0.25}
          />
        )}
        <line
          x1={pts[0]}
          y1={pts[1]}
          x2={pts[2]}
          y2={pts[3]}
          stroke={strokeColor}
          strokeWidth={(isPreview ? 1.5 : 1) * invK}
          strokeDasharray={dashPattern}
          opacity={isPreview ? 0.9 : guidesLocked ? 0.6 : 0.78}
        />
      </g>
    );
  };

  return (
    <>
      {guidesVisible && guides.map((g) => renderGuide(g, `guide-${g.id}`, false))}
      {guidePreview && renderGuide(guidePreview, 'guide-preview', true)}
    </>
  );
});

interface WorkGridLayerProps {
  config: GridConfig;
  dark: boolean;
  viewK: number;
  invK: number;
  vpX0: number;
  vpY0: number;
  vpX1: number;
  vpY1: number;
}

const WorkGridLayer = memo(function WorkGridLayer({
  config,
  dark,
  viewK,
  invK,
  vpX0,
  vpY0,
  vpX1,
  vpY1,
}: WorkGridLayerProps) {
  if (!config.enabled || config.kind === 'none') return null;

  const majorStroke = dark ? '#3f3f46' : '#cbd5e1';
  const minorStroke = dark ? '#27272a' : '#e2e8f0';
  const fibStroke = dark ? '#10b981' : '#059669';
  const originColor = dark ? '#34d399' : '#059669';
  const u = Math.max(4, config.unit);

  if (config.kind === 'fibonacci') {
    const tiles = computeFibonacciTiles(config);
    return (
      <g style={{ pointerEvents: 'none' }}>
        {tiles.map((t) => (
          <g key={`fib-tile-${t.index}`}>
            <rect
              x={t.x}
              y={t.y}
              width={t.size}
              height={t.size}
              fill="none"
              stroke={fibStroke}
              strokeOpacity={0.28}
              strokeWidth={1 * invK}
            />
            {config.fibShowCircles && (
              <circle
                cx={t.cx}
                cy={t.cy}
                r={t.size * 0.5}
                fill="none"
                stroke={fibStroke}
                strokeOpacity={0.22}
                strokeWidth={0.9 * invK}
                strokeDasharray={`${3 * invK} ${3 * invK}`}
              />
            )}
            {config.fibShowSpiral && (
              <path
                d={t.arcD}
                fill="none"
                stroke={fibStroke}
                strokeOpacity={0.58}
                strokeWidth={1.6 * invK}
              />
            )}
            {config.fibShowLabels && t.size * viewK >= 22 && (
              <text
                x={t.cx}
                y={t.cy + 4 * invK}
                fontSize={10 * invK}
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
                textAnchor="middle"
                fill={fibStroke}
                opacity={0.45}
              >
                {t.label}
              </text>
            )}
          </g>
        ))}
        <circle cx={config.originX} cy={config.originY} r={3 * invK} fill={originColor} opacity={0.55} />
      </g>
    );
  }

  if (config.kind === 'modular') {
    const sub = Math.max(1, config.subdivisions);
    const step = u / sub;
    if (step * viewK < 6) {
      // Fall back to major step only when zoomed far out
      const startX = Math.floor((vpX0 - config.originX) / u) * u + config.originX;
      const startY = Math.floor((vpY0 - config.originY) / u) * u + config.originY;
      const vLines: number[] = [];
      const hLines: number[] = [];
      for (let x = startX; x <= vpX1 && vLines.length < 220; x += u) vLines.push(x);
      for (let y = startY; y <= vpY1 && hLines.length < 220; y += u) hLines.push(y);
      return (
        <g style={{ pointerEvents: 'none' }}>
          {vLines.map((x, idx) => (
            <line key={`mv-${idx}`} x1={x} y1={vpY0} x2={x} y2={vpY1} stroke={majorStroke} strokeWidth={0.8 * invK} opacity={0.65} />
          ))}
          {hLines.map((y, idx) => (
            <line key={`mh-${idx}`} x1={vpX0} y1={y} x2={vpX1} y2={y} stroke={majorStroke} strokeWidth={0.8 * invK} opacity={0.65} />
          ))}
        </g>
      );
    }
    const minIx = Math.floor((vpX0 - config.originX) / step);
    const maxIx = Math.ceil((vpX1 - config.originX) / step);
    const minIy = Math.floor((vpY0 - config.originY) / step);
    const maxIy = Math.ceil((vpY1 - config.originY) / step);
    const xLines: Array<{ pos: number; major: boolean }> = [];
    const yLines: Array<{ pos: number; major: boolean }> = [];
    for (let ix = minIx; ix <= maxIx && xLines.length < 260; ix++) {
      xLines.push({ pos: config.originX + ix * step, major: ((ix % sub) + sub) % sub === 0 });
    }
    for (let iy = minIy; iy <= maxIy && yLines.length < 260; iy++) {
      yLines.push({ pos: config.originY + iy * step, major: ((iy % sub) + sub) % sub === 0 });
    }
    return (
      <g style={{ pointerEvents: 'none' }}>
        {xLines.map((l, idx) => (
          <line
            key={`gx-${idx}`}
            x1={l.pos}
            y1={vpY0}
            x2={l.pos}
            y2={vpY1}
            stroke={l.major ? majorStroke : minorStroke}
            strokeWidth={(l.major ? 1 : 0.7) * invK}
            opacity={l.major ? 0.8 : 0.55}
          />
        ))}
        {yLines.map((l, idx) => (
          <line
            key={`gy-${idx}`}
            x1={vpX0}
            y1={l.pos}
            x2={vpX1}
            y2={l.pos}
            stroke={l.major ? majorStroke : minorStroke}
            strokeWidth={(l.major ? 1 : 0.7) * invK}
            opacity={l.major ? 0.8 : 0.55}
          />
        ))}
        <circle cx={config.originX} cy={config.originY} r={3 * invK} fill={originColor} opacity={0.55} />
      </g>
    );
  }

  if (config.kind === 'isometric') {
    const dy = (u * Math.sqrt(3)) / 2;
    if (dy * viewK < 6) return null;
    const minRow = Math.floor((vpY0 - config.originY) / dy) - 1;
    const maxRow = Math.ceil((vpY1 - config.originY) / dy) + 1;
    const hLines: number[] = [];
    for (let r = minRow; r <= maxRow && hLines.length < 180; r++) {
      hLines.push(config.originY + r * dy);
    }
    const slope = Math.sqrt(3);
    const lines60: Array<[number, number, number, number]> = [];
    const spanY = vpY1 - vpY0;
    const dxSpan = spanY / slope;
    const minK = Math.floor((vpX0 - dxSpan - config.originX) / u) - 1;
    const maxK = Math.ceil((vpX1 + dxSpan - config.originX) / u) + 1;
    for (let k = minK; k <= maxK && lines60.length < 320; k++) {
      const bx = config.originX + k * u;
      // +60°
      const dyTop = vpY0 - config.originY;
      const dyBot = vpY1 - config.originY;
      lines60.push([bx + dyTop / slope, vpY0, bx + dyBot / slope, vpY1]);
      // -60°
      lines60.push([bx - dyTop / slope, vpY0, bx - dyBot / slope, vpY1]);
    }
    return (
      <g style={{ pointerEvents: 'none' }}>
        {hLines.map((y, idx) => (
          <line key={`ih-${idx}`} x1={vpX0} y1={y} x2={vpX1} y2={y} stroke={minorStroke} strokeWidth={0.8 * invK} opacity={0.7} />
        ))}
        {lines60.map((pts, idx) => (
          <line key={`ia-${idx}`} x1={pts[0]} y1={pts[1]} x2={pts[2]} y2={pts[3]} stroke={minorStroke} strokeWidth={0.8 * invK} opacity={0.65} />
        ))}
        <circle cx={config.originX} cy={config.originY} r={3 * invK} fill={originColor} opacity={0.55} />
      </g>
    );
  }

  if (config.kind === 'phi') {
    const radii = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((k) => u * Math.pow(PHI, k));
    return (
      <g style={{ pointerEvents: 'none' }}>
        <line x1={config.originX} y1={vpY0} x2={config.originX} y2={vpY1} stroke={fibStroke} strokeWidth={1.1 * invK} opacity={0.55} />
        <line x1={vpX0} y1={config.originY} x2={vpX1} y2={config.originY} stroke={fibStroke} strokeWidth={1.1 * invK} opacity={0.55} />
        {radii.map((r, idx) => (
          <g key={`phi-${idx}`}>
            <line x1={config.originX + r} y1={vpY0} x2={config.originX + r} y2={vpY1} stroke={fibStroke} strokeWidth={0.8 * invK} opacity={0.28} />
            <line x1={config.originX - r} y1={vpY0} x2={config.originX - r} y2={vpY1} stroke={fibStroke} strokeWidth={0.8 * invK} opacity={0.28} />
            <line x1={vpX0} y1={config.originY + r} x2={vpX1} y2={config.originY + r} stroke={fibStroke} strokeWidth={0.8 * invK} opacity={0.28} />
            <line x1={vpX0} y1={config.originY - r} x2={vpX1} y2={config.originY - r} stroke={fibStroke} strokeWidth={0.8 * invK} opacity={0.28} />
          </g>
        ))}
      </g>
    );
  }

  if (config.kind === 'polar') {
    const radii =
      config.sizeRule === 'fibonacci'
        ? [1, 2, 3, 5, 8, 13, 21, 34, 55].map((f) => f * u)
        : Array.from({ length: 16 }, (_, idx) => (idx + 1) * u);
    const maxR = radii[radii.length - 1] ?? u * 16;
    const sectors = Math.max(4, config.subdivisions * 4);
    return (
      <g style={{ pointerEvents: 'none' }}>
        {radii.map((r, idx) => (
          <circle
            key={`pr-${idx}`}
            cx={config.originX}
            cy={config.originY}
            r={r}
            fill="none"
            stroke={config.sizeRule === 'fibonacci' ? fibStroke : majorStroke}
            strokeWidth={0.85 * invK}
            opacity={config.sizeRule === 'fibonacci' ? 0.36 : 0.6}
          />
        ))}
        {Array.from({ length: sectors }, (_, i) => {
          const a = (i * Math.PI * 2) / sectors;
          return (
            <line
              key={`pa-${i}`}
              x1={config.originX}
              y1={config.originY}
              x2={config.originX + maxR * Math.cos(a)}
              y2={config.originY + maxR * Math.sin(a)}
              stroke={minorStroke}
              strokeWidth={0.8 * invK}
              opacity={0.65}
            />
          );
        })}
        <circle cx={config.originX} cy={config.originY} r={3 * invK} fill={originColor} opacity={0.65} />
      </g>
    );
  }

  return null;
});

interface StaticGeometryLayerProps {
  objs: GeomObj[];
  curveCache: Array<Curve | null>;
  renderedCurves: RenderedCurve[];
  renderedPoints: PointObj[];
  phaseMap: Map<string, Phase>;
  defaultPhaseId: string;
  activePhaseId: string;
  focusMode: boolean;
  dark: boolean;
  selectedIds: Set<number>;
  prio: Set<number>;
  dimMode: DimMode;
  tool: ToolId;
  viewK: number;
  invK: number;
  vpX0: number;
  vpY0: number;
  vpX1: number;
  vpY1: number;
  onOpenDimEditor: (objId: number, kind: 'ci' | 'pg', cx: number, cy: number, val: number) => void;
}

const StaticGeometryLayer = memo(function StaticGeometryLayer({
  objs,
  curveCache,
  renderedCurves,
  renderedPoints,
  phaseMap,
  defaultPhaseId,
  activePhaseId,
  focusMode,
  dark,
  selectedIds,
  prio,
  dimMode,
  tool,
  viewK,
  invK,
  vpX0,
  vpY0,
  vpX1,
  vpY1,
  onOpenDimEditor,
}: StaticGeometryLayerProps) {
  const styleForPhase = (pid: string | undefined) => {
    const ph = phaseMap.get(pid ?? defaultPhaseId);
    const color = ph ? phaseDisplayColor(ph.color, dark) : dark ? '#e4e4e7' : '#111827';
    let opacity = ph ? ph.geometryOpacity : 1;
    if (focusMode && (pid ?? defaultPhaseId) !== activePhaseId) {
      opacity *= 0.22;
    }
    return { color, opacity };
  };

  return (
    <>
      {/* Priority highlights behind curves */}
      {Array.from(prio).map((id) => {
        const o = objs[id];
        if (!o || o.dead) return null;
        const ph = phaseMap.get(o.phaseId ?? defaultPhaseId);
        if (ph && !ph.showGeometry) return null;
        if (o.t === 'pt') {
          if (!o.ok || o.x < vpX0 || o.x > vpX1 || o.y < vpY0 || o.y > vpY1) return null;
          return (
            <circle
              key={`prio-${id}`}
              cx={o.x}
              cy={o.y}
              r={8 * invK}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={2.5 * invK}
            />
          );
        }
        const c = curve(objs, o, curveCache);
        if (!c) return null;
        if (c.t === 'c') {
          if (c.x + c.r < vpX0 || c.x - c.r > vpX1 || c.y + c.r < vpY0 || c.y - c.r > vpY1) {
            return null;
          }
          return (
            <circle
              key={`prio-${id}`}
              cx={c.x}
              cy={c.y}
              r={c.r}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={4 * invK}
              opacity={0.55}
            />
          );
        }
        if (c.t === 'p') {
          return (
            <polygon
              key={`prio-${id}`}
              points={c.verts.map((v) => `${v.x},${v.y}`).join(' ')}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={4 * invK}
              strokeLinejoin="round"
              opacity={0.55}
            />
          );
        }
        const pts = clipLine(c, vpX0, vpY0, vpX1, vpY1);
        if (!pts) return null;
        return (
          <line
            key={`prio-${id}`}
            x1={pts[0]}
            y1={pts[1]}
            x2={pts[2]}
            y2={pts[3]}
            stroke="#f59e0b"
            strokeWidth={4 * invK}
            opacity={0.55}
          />
        );
      })}

      {/* Selected curve halos */}
      {renderedCurves.map((item) => {
        if (!selectedIds.has(item.id)) return null;
        if (item.kind === 'c') {
          return (
            <circle
              key={`sel-c-${item.id}`}
              cx={item.cx}
              cy={item.cy}
              r={item.r}
              fill="none"
              stroke="var(--ac)"
              strokeWidth={5 * invK}
              opacity={0.32}
            />
          );
        }
        if (item.kind === 'p') {
          return (
            <polygon
              key={`sel-p-${item.id}`}
              points={item.points}
              fill="none"
              stroke="var(--ac)"
              strokeWidth={5 * invK}
              strokeLinejoin="round"
              opacity={0.32}
            />
          );
        }
        return (
          <line
            key={`sel-l-${item.id}`}
            x1={item.pts[0]}
            y1={item.pts[1]}
            x2={item.pts[2]}
            y2={item.pts[3]}
            stroke="var(--ac)"
            strokeWidth={5 * invK}
            opacity={0.32}
          />
        );
      })}

      {/* Main geometric curves colored and attenuated by Phase */}
      {renderedCurves.map((item) => {
        const st = styleForPhase(item.phaseId);
        if (st.opacity <= 0.01) return null;
        if (item.kind === 'c') {
          return (
            <circle
              key={item.id}
              cx={item.cx}
              cy={item.cy}
              r={item.r}
              fill="none"
              stroke={st.color}
              strokeOpacity={st.opacity}
              strokeWidth={1.5 * invK}
            />
          );
        }
        if (item.kind === 'p') {
          return (
            <polygon
              key={item.id}
              points={item.points}
              fill="none"
              stroke={st.color}
              strokeOpacity={st.opacity}
              strokeWidth={1.5 * invK}
              strokeLinejoin="round"
            />
          );
        }
        return (
          <line
            key={item.id}
            x1={item.pts[0]}
            y1={item.pts[1]}
            x2={item.pts[2]}
            y2={item.pts[3]}
            stroke={st.color}
            strokeOpacity={st.opacity}
            strokeWidth={1.5 * invK}
          />
        );
      })}

      {/* Low-opacity circle & polygon dimension labels at center (clickable in Mover mode to edit) */}
      {dimMode !== 'off' &&
        renderedCurves.map((item) => {
          if (item.kind !== 'c' && item.kind !== 'p') return null;
          const sizeMetric = item.kind === 'c' ? item.r : item.side * 0.5;
          if (
            sizeMetric * viewK < 14 ||
            item.cx < vpX0 ||
            item.cx > vpX1 ||
            item.cy < vpY0 ||
            item.cy > vpY1
          ) {
            return null;
          }
          const st = styleForPhase(item.phaseId);
          if (st.opacity <= 0.01) return null;
          const labelBase =
            item.kind === 'c'
              ? dimMode === 'd'
                ? formatDim(item.r * 2, 'Ø')
                : formatDim(item.r, 'r')
              : formatDim(item.side, 'L');
          const label = item.scaleLocked ? `🔒 ${labelBase}` : labelBase;
          const canClick = tool === 'move';
          return (
            <text
              key={`dim-${item.id}`}
              x={item.cx}
              y={item.cy + 12 * invK}
              fontSize={10.5 * invK}
              fontFamily="JetBrains Mono, monospace"
              fontWeight="500"
              textAnchor="middle"
              fill={st.color}
              opacity={(selectedIds.has(item.id) ? 0.72 : 0.36) * st.opacity}
              className={canClick ? 'hover:opacity-90 transition-opacity' : ''}
              style={{
                pointerEvents: canClick ? 'auto' : 'none',
                cursor: canClick ? (item.scaleLocked ? 'not-allowed' : 'text') : 'default',
              }}
              onPointerDown={(e) => {
                if (!canClick || e.button !== 0) return;
                e.stopPropagation();
                if (item.kind === 'c') {
                  onOpenDimEditor(item.id, 'ci', item.cx, item.cy, item.r);
                } else {
                  onOpenDimEditor(item.id, 'pg', item.cx, item.cy, item.side);
                }
              }}
            >
              <title>
                {item.scaleLocked
                  ? 'Escala travada — desbloqueie na barra para alterar a dimensão'
                  : 'Clique para editar a dimensão'}
              </title>
              {label}
            </text>
          );
        })}

      {/* Geometric points (viewport-culled) */}
      {renderedPoints.map((o) => {
        if (o.x < vpX0 || o.x > vpX1 || o.y < vpY0 || o.y > vpY1) return null;
        const st = styleForPhase(o.phaseId);
        if (st.opacity <= 0.01) return null;
        const movable = o.free || o.on !== undefined;
        return (
          <circle
            key={o.id}
            cx={o.x}
            cy={o.y}
            r={(o.free ? 4.2 : 3.4) * invK}
            fill={movable ? 'var(--ac)' : 'var(--pt)'}
            fillOpacity={st.opacity}
          />
        );
      })}

      {/* Selected point rings */}
      {renderedPoints.map((o) =>
        selectedIds.has(o.id) && o.x >= vpX0 && o.x <= vpX1 && o.y >= vpY0 && o.y <= vpY1 ? (
          <circle
            key={`sel-pt-${o.id}`}
            cx={o.x}
            cy={o.y}
            r={9 * invK}
            fill="none"
            stroke="var(--pt)"
            strokeWidth={2 * invK}
          />
        ) : null
      )}
    </>
  );
});

export const CanvasStage: React.FC<CanvasStageProps> = ({
  svgRef,
  objs,
  curveCache,
  view,
  size,
  tool,
  dark,
  pend,
  tcSel,
  tanSel,
  hoveredTanTarget,
  tanVariantIdx,
  tanVariantCount,
  selectedIds,
  selectedShapeIds,
  prio,
  edit,
  hover,
  ghost,
  marquee,
  smartGuides,
  dimMode,
  hasClipboard,
  refImgs,
  activeRefId,
  onSelectRefImg,
  onToggleRefLock,
  onRemoveRefImage,
  onChangeRefOpacity,
  showRulers,
  guides,
  guidesVisible,
  guidesLocked,
  selectedGuideId,
  hoveredGuideKind,
  guidePreview,
  rulerStart,
  cursorWorld,
  spaceDown,
  altDown,
  isPanning,
  isDragging,
  editingDim,
  dimDraft,
  dimError,
  gridConfig,
  showGridPanel,
  lineMode,
  onChangeLineMode,
  circleMode,
  onChangeCircleMode,
  tgActive,
  shiftDown,
  onToggleTg,
  polySides,
  creationOrigin,
  onChangeCreationOrigin,
  tanSnapEnabled: _tanSnapEnabled,
  phases,
  activePhaseId,
  focusMode,
  crossPhaseSnap,
  countsByPhase,
  shapes,
  shapeMode,
  shapeScope,
  shapeRegions,
  hoveredShapeRegionId,
  dragShapeRegionIds,
  dragShapePreviewPath,
  lockNotice,
  onOpenDimEditor,
  onChangeDimDraft,
  onCommitDimEdit,
  onCancelDimEdit,
  onChangeGridConfig,
  onCenterGridOrigin,
  onGenerateFibGeometry,
  onCloseGridPanel,
  onChangePolySides,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onStartRulerGuide,
  onToggleGuidesVisible,
  onToggleGuidesLocked,
  onDeleteSelectedGuide,
  onClearGuides,
  onCopySelected,
  onPasteClipboard,
  onDuplicateSelected,
  onDeleteSelected,
  onClearSelection,
  onDeleteSelectedShapes,
  onMoveSelectedShapesToPhase,
  onClearShapeSelection,
  onClearPrio,

  onCancelEdit,
  onCreateTanCircle,
  onCycleTanVariant,
  onClearTanSel,
  onStartTanFromSelection,
  selTanCandidates,
  hoveredSelTanCand,
  dragTanOverlay,
  onSwapSelectionOrder,
  selectedEditInfo,
  selectedConstraintInfo,
  hoveredResizeGrip,
  onReleaseTangency,
  onChangeShapeMode,
  onChangeShapeScope,
  onClearPhaseShapes,
  onMoveSelectedToPhase,
  onUnlockActivePhase,
  onSelectPhase,
  onAddPhase,
  onUpdatePhase,
  onRequestDeletePhase,
  onToggleFocusMode,
  onToggleCrossPhaseSnap,
  alignPopoverOpen,
  onToggleAlignPopover,
  onAlignSelection,
  onDistributeSelection,
  onGroupSelection,
  onUngroupSelection,
  onCombineSelectedShapes,
  onMirrorSelection,
  onRadialArraySelection,
  onToggleScaleLockSelection,
}) => {
  const vbW = Math.max(1, size.w) / view.k;
  const vbH = Math.max(1, size.h) / view.k;
  const pad = 24 / view.k;
  const vpX0 = view.x - pad;
  const vpY0 = view.y - pad;
  const vpX1 = view.x + vbW + pad;
  const vpY1 = view.y + vbH + pad;

  const defaultPhaseId = phases[0]?.id ?? 'phase-1';
  const phaseMap = useMemo(() => {
    const m = new Map<string, Phase>();
    for (const p of phases) m.set(p.id, p);
    return m;
  }, [phases]);

  const activePhase = phaseMap.get(activePhaseId) ?? phases[0] ?? null;
  const activeDispColor = activePhase ? phaseDisplayColor(activePhase.color, dark) : '#2563eb';
  const effectiveShapeMode = altDown ? 'sub' : shapeMode;

  const renderedCurves = useMemo(() => {
    const items: RenderedCurve[] = [];
    for (const o of objs) {
      if (o.dead || o.t === 'pt') continue;
      const pid = o.phaseId ?? defaultPhaseId;
      const ph = phaseMap.get(pid);
      if (ph && !ph.showGeometry) continue;
      const c = curve(objs, o, curveCache);
      if (!c) continue;
      if (c.t === 'c') {
        if (c.x + c.r < vpX0 || c.x - c.r > vpX1 || c.y + c.r < vpY0 || c.y - c.r > vpY1) {
          continue;
        }
        items.push({
          id: o.id,
          phaseId: pid,
          kind: 'c',
          cx: c.x,
          cy: c.y,
          r: c.r,
          scaleLocked: o.t === 'ci' ? !!o.scaleLocked : undefined,
        });
      } else if (c.t === 'p') {
        if (c.cx + c.r < vpX0 || c.cx - c.r > vpX1 || c.cy + c.r < vpY0 || c.cy - c.r > vpY1) {
          continue;
        }
        items.push({
          id: o.id,
          phaseId: pid,
          kind: 'p',
          points: c.verts.map((v) => `${v.x},${v.y}`).join(' '),
          cx: c.cx,
          cy: c.cy,
          side: c.side,
          sides: c.sides,
          scaleLocked: o.t === 'pg' ? !!o.scaleLocked : undefined,
        });
      } else {
        const pts = clipLine(c, vpX0, vpY0, vpX1, vpY1);
        if (pts) {
          items.push({ id: o.id, phaseId: pid, kind: 'l', pts });
        }
      }
    }
    return items;
  }, [curveCache, defaultPhaseId, objs, phaseMap, vpX0, vpX1, vpY0, vpY1]);

  const renderedPoints = useMemo(
    () =>
      objs.filter((o): o is PointObj => {
        if (o.t !== 'pt' || !o.ok || o.dead) return false;
        const pid = o.phaseId ?? defaultPhaseId;
        const ph = phaseMap.get(pid);
        return !ph || ph.showGeometry;
      }),
    [defaultPhaseId, objs, phaseMap]
  );

  const selectedCircleInfo = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const onlyId = Array.from(selectedIds)[0];
    const o = getObj(objs, onlyId);
    if (!o || o.dead || o.t !== 'ci') return null;
    const cv = curve(objs, o, curveCache);
    if (!cv || cv.t !== 'c') return null;
    return { id: o.id, cx: cv.x, cy: cv.y, r: cv.r, scaleLocked: !!o.scaleLocked };
  }, [curveCache, objs, selectedIds]);

  const selectedPolyInfo = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const onlyId = Array.from(selectedIds)[0];
    const o = getObj(objs, onlyId);
    if (!o || o.dead || o.t !== 'pg') return null;
    const cv = curve(objs, o, curveCache);
    if (!cv || cv.t !== 'p') return null;
    return { id: o.id, cx: cv.cx, cy: cv.cy, side: cv.side, sides: cv.sides, scaleLocked: !!o.scaleLocked };
  }, [curveCache, objs, selectedIds]);

  const selectedCount = useMemo(() => {
    let n = 0;
    for (const id of selectedIds) {
      const o = getObj(objs, id);
      if (o && !o.dead) n++;
    }
    return n;
  }, [objs, selectedIds]);

  const selectionLayoutMeta = useMemo(() => {
    let scalableCount = 0;
    let lockedScalableCount = 0;
    let closedCurveCount = 0;
    let canUngroup = false;
    for (const id of selectedIds) {
      const o = getObj(objs, id);
      if (!o || o.dead) continue;
      if (o.groupId) canUngroup = true;
      if (o.t === 'ci' || o.t === 'pg') {
        scalableCount++;
        if (o.scaleLocked) lockedScalableCount++;
        if (curve(objs, o, curveCache)) closedCurveCount++;
      }
    }
    const unitCount = selectedIds.size > 0 ? getAlignUnitCount(objs, selectedIds, curveCache) : 0;
    const scaleLockState: 'none' | 'partial' | 'all' =
      lockedScalableCount === 0
        ? 'none'
        : lockedScalableCount === scalableCount
          ? 'all'
          : 'partial';
    return {
      unitCount,
      canGroup: unitCount >= 2,
      canUngroup,
      closedCurveCount,
      hasScalableSelection: scalableCount > 0,
      scaleLockState,
    };
  }, [curveCache, objs, selectedIds]);

  const selectionBounds = useMemo(() => {
    if (tool !== 'move' || edit || selectedIds.size === 0) return null;
    return getSelectionBoundingBox(objs, selectedIds, curveCache);
  }, [curveCache, edit, objs, selectedIds, tool]);
  const showGroupBoundingBox =
    !!selectionBounds && (selectionLayoutMeta.unitCount >= 2 || selectionLayoutMeta.canUngroup);

  const activeImg = useMemo(() => {
    return refImgs.find((img) => img.id === activeRefId) ?? refImgs[refImgs.length - 1] ?? null;
  }, [activeRefId, refImgs]);

  const refHandles = useMemo(() => {
    if (!activeImg || activeImg.locked || tool !== 'move') return null;
    const hw = activeImg.w / 2;
    const hh = activeImg.h / 2;
    const corners: Array<[number, number]> = [
      refPt(activeImg, -hw, -hh),
      refPt(activeImg, hw, -hh),
      refPt(activeImg, hw, hh),
      refPt(activeImg, -hw, hh),
    ];
    const topMid = refPt(activeImg, 0, -hh);
    const rotPt = refPt(activeImg, 0, -hh - 30 / view.k);
    return { corners, topMid, rotPt };
  }, [activeImg, tool, view.k]);

  const rulerTicks = useMemo<RulerTicks | null>(() => {
    if (!showRulers) return null;
    const step = pickMajorStep(view.k);
    const subDiv = step % 5 === 0 ? 5 : 4;
    const minor = step / subDiv;

    const minX = view.x;
    const maxX = view.x + size.w / view.k;
    const startX = Math.floor(minX / minor) * minor;
    const hTicks: RulerTicks['hTicks'] = [];
    for (let w = startX; w <= maxX + minor; w += minor) {
      const idx = Math.round(w / minor);
      hTicks.push({
        pos: (w - view.x) * view.k,
        world: Math.round(w * 100) / 100,
        major: idx % subDiv === 0,
      });
    }

    const minY = view.y;
    const maxY = view.y + size.h / view.k;
    const startY = Math.floor(minY / minor) * minor;
    const vTicks: RulerTicks['vTicks'] = [];
    for (let w = startY; w <= maxY + minor; w += minor) {
      const idx = Math.round(w / minor);
      vTicks.push({
        pos: (w - view.y) * view.k,
        world: Math.round(w * 100) / 100,
        major: idx % subDiv === 0,
      });
    }

    return { hTicks, vTicks };
  }, [showRulers, size.h, size.w, view.k, view.x, view.y]);

  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : spaceDown
      ? 'cursor-grab'
      : isDragging
        ? 'cursor-grabbing'
        : tool === 'shape'
          ? hoveredShapeRegionId
            ? 'cursor-pointer'
            : 'cursor-crosshair'
          : hoveredResizeGrip
            ? 'cursor-pointer'
            : hoveredSelTanCand !== null
              ? 'cursor-pointer'
              : hoveredGuideKind === 'h'
                ? 'cursor-ns-resize'
                : hoveredGuideKind === 'v'
                  ? 'cursor-ew-resize'
                  : hoveredGuideKind === 'a'
                    ? 'cursor-move'
                    : tool === 'move'
                      ? 'cursor-default'
                      : 'cursor-crosshair';

  const selectedTanTargetsCount = useMemo(() => {
    let curves = 0;
    for (const id of selectedIds) {
      const o = getObj(objs, id);
      if (o && !o.dead && (o.t === 'ci' || o.t === 'ln' || o.t === 'pg')) curves++;
    }
    return curves;
  }, [objs, selectedIds]);

  const activePhaseShapesCount = useMemo(
    () => shapes.filter((s) => s.phaseId === activePhaseId).length,
    [activePhaseId, shapes]
  );

  const snapTagPos = useMemo(() => {
    if (dragTanOverlay?.active) {
      const act = dragTanOverlay.active;
      return {
        x: act.contact.x,
        y: act.contact.y,
        text: `Tangência possível · ${act.label}`,
        tone: 'purple' as const,
      };
    }
    if (hoveredSelTanCand) {
      return {
        x: hoveredSelTanCand.contact.x,
        y: hoveredSelTanCand.contact.y,
        text: `Conectar 1º → 2º · ${hoveredSelTanCand.label}`,
        tone: 'purple' as const,
      };
    }
    if (tool === 'ci' && circleMode === 'tangent' && hoveredTanTarget !== null && tanSel.length < 4 && cursorWorld) {
      const n = tanSel.length + 1;
      return {
        x: cursorWorld.x,
        y: cursorWorld.y,
        text: `+ ${n}º objeto${n === 4 ? ' (máx)' : ''}`,
        tone: 'cyan' as const,
      };
    }
    if (ghost && ghost.label) {
      if (ghost.contacts && ghost.contacts.length > 0) {
        return { x: ghost.contacts[0].x, y: ghost.contacts[0].y, text: ghost.label, tone: 'blue' as const };
      }
      if (cursorWorld) {
        return { x: cursorWorld.x, y: cursorWorld.y, text: ghost.label, tone: 'blue' as const };
      }
    }
    if (hover) {
      if (hover.k === 'pt') return { x: hover.x, y: hover.y, text: 'Ponto', tone: 'rose' as const };
      if (hover.k === 'in') return { x: hover.x, y: hover.y, text: 'Interseção', tone: 'rose' as const };
      if (hover.k === 'on') return { x: hover.x, y: hover.y, text: 'Sobre curva', tone: 'blue' as const };
      if (hover.k === 'free' && hover.guideTag) {
        return { x: hover.x, y: hover.y, text: hover.guideTag, tone: 'cyan' as const };
      }
    }
    return null;
  }, [circleMode, cursorWorld, dragTanOverlay, ghost, hover, hoveredSelTanCand, hoveredTanTarget, tanSel.length, tool]);

  const invK = 1 / view.k;
  const tgOn = tgActive || shiftDown;
  const showContextBar =
    selectedCount > 0 ||
    selectedShapeIds.size > 0 ||
    hasClipboard ||
    prio.size > 0 ||
    refImgs.length > 0 ||
    edit !== null ||
    guides.length > 0 ||
    tool === 'shape' ||
    tool === 'ln' ||
    tool === 'ci' ||
    tool === 'pg' ||
    Boolean(lockNotice) ||
    Boolean(activePhase?.locked && tool !== 'move');

  const rulerMeasure = useMemo(() => {
    if (tool !== 'ruler' || !rulerStart || !hover) return null;
    const dx = hover.x - rulerStart.x;
    const dy = hover.y - rulerStart.y;
    const dist = Math.hypot(dx, dy);
    const deg = (((Math.atan2(-dy, dx) * 180) / Math.PI) + 360) % 360;
    return {
      x1: rulerStart.x,
      y1: rulerStart.y,
      x2: hover.x,
      y2: hover.y,
      mx: (rulerStart.x + hover.x) / 2,
      my: (rulerStart.y + hover.y) / 2,
      label: `${dist.toFixed(1)} px · ${deg.toFixed(1)}°`,
    };
  }, [hover, rulerStart, tool]);

  return (
    <main className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* Top ruler row */}
      {showRulers && (
        <div className="shrink-0 h-6 flex border-b border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 select-none">
          <div
            className="w-6 shrink-0 border-r border-slate-200 dark:border-zinc-800 flex items-center justify-center text-[9px] font-mono text-slate-500 dark:text-zinc-400"
            title="Arraste da régua superior ou esquerda para criar guias"
          >
            px
          </div>
          <svg
            className="flex-1 h-6 cursor-row-resize touch-none"
            onPointerDown={(e) => onStartRulerGuide('h', e)}
          >
            <title>Arraste para baixo para criar uma guia horizontal</title>
            {rulerTicks && <TopRulerTicks ticks={rulerTicks.hTicks} />}
            {cursorWorld && (
              <line
                x1={(cursorWorld.x - view.x) * view.k}
                y1={0}
                x2={(cursorWorld.x - view.x) * view.k}
                y2={24}
                stroke="#0891b2"
                strokeWidth={1.5}
              />
            )}
          </svg>
        </div>
      )}

      {/* Middle row: optional Left Ruler + SVG Canvas */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {showRulers && (
          <svg
            className="w-6 shrink-0 h-full border-r border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 cursor-col-resize touch-none select-none"
            onPointerDown={(e) => onStartRulerGuide('v', e)}
          >
            <title>Arraste para a direita para criar uma guia vertical</title>
            {rulerTicks && <LeftRulerTicks ticks={rulerTicks.vTicks} />}
            {cursorWorld && (
              <line
                x1={0}
                y1={(cursorWorld.y - view.y) * view.k}
                x2={24}
                y2={(cursorWorld.y - view.y) * view.k}
                stroke="#0891b2"
                strokeWidth={1.5}
              />
            )}
          </svg>
        )}

        <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Unified Freeform-inspired floating contextual capsules */}
          {showContextBar && (
            <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
              {edit && (
                <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-300/90 dark:border-rose-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs text-slate-800 dark:text-zinc-100">
                  <span className="font-medium text-rose-600 dark:text-rose-400">Editando círculo</span>
                  <span className="text-slate-500 dark:text-zinc-400">
                    Clique para definir diâmetro ou Shift para tangente
                  </span>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Esc</span>
                  </button>
                </div>
              )}

              {(selectedCount > 0 || selectedShapeIds.size > 0 || hasClipboard) && !edit && (
                <div className="pointer-events-auto inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  {selectedCount > 0 && (
                    <>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-zinc-200 pl-1 pr-0.5">
                        {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={onCopySelected}
                        title={`Copiar seleção (${modKey}+C)`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={onDuplicateSelected}
                        title={`Duplicar seleção (${modKey}+D)`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium cursor-pointer"
                      >
                        <Clipboard className="w-3 h-3" />
                        <span>Duplicar</span>
                      </button>
                      <button
                        type="button"
                        onClick={onDeleteSelected}
                        title={`Excluir seleção (${delKey})`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-600 text-white hover:bg-rose-700 font-medium cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir</span>
                      </button>
                      {selectedCircleInfo && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDimEditor(
                              selectedCircleInfo.id,
                              'ci',
                              selectedCircleInfo.cx,
                              selectedCircleInfo.cy,
                              selectedCircleInfo.r
                            )
                          }
                          title={
                            selectedCircleInfo.scaleLocked
                              ? 'Escala travada — desbloqueie na cápsula flutuante para alterar a medida'
                              : 'Editar dimensão do círculo mantendo tangências conectadas'
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-mono tabular-nums cursor-pointer ${
                            selectedCircleInfo.scaleLocked
                              ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                              : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                          }`}
                        >
                          {selectedCircleInfo.scaleLocked && <Lock className="w-3 h-3" />}
                          <span>
                            {selectedCircleInfo.scaleLocked ? '' : 'Editar '}
                            {dimMode === 'r'
                              ? formatDim(selectedCircleInfo.r, 'r')
                              : formatDim(selectedCircleInfo.r * 2, 'Ø')}
                          </span>
                        </button>
                      )}
                      {selectedPolyInfo && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDimEditor(
                              selectedPolyInfo.id,
                              'pg',
                              selectedPolyInfo.cx,
                              selectedPolyInfo.cy,
                              selectedPolyInfo.side
                            )
                          }
                          title={
                            selectedPolyInfo.scaleLocked
                              ? 'Escala travada — desbloqueie na cápsula flutuante para alterar o lado'
                              : 'Editar comprimento do lado'
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-mono tabular-nums cursor-pointer ${
                            selectedPolyInfo.scaleLocked
                              ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                              : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                          }`}
                        >
                          {selectedPolyInfo.scaleLocked && <Lock className="w-3 h-3" />}
                          <span>
                            {selectedPolyInfo.scaleLocked ? '' : 'Editar '}
                            {formatDim(selectedPolyInfo.side, 'L')}
                          </span>
                        </button>
                      )}
                      {selectedCount > 0 && phases.length > 1 && (
                        <select
                          aria-label="Mover seleção para fase"
                          title="Mover os objetos selecionados para outra fase"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) onMoveSelectedToPhase(e.target.value);
                          }}
                          className="px-2 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                        >
                          <option value="" disabled>
                            Mover p/ fase...
                          </option>
                          {phases.map((ph, idx) => (
                            <option key={ph.id} value={ph.id}>
                              {idx + 1}. {ph.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {selectedTanTargetsCount >= 2 && selectedTanTargetsCount <= 4 && (
                        <button
                          type="button"
                          onClick={onStartTanFromSelection}
                          title="Construir círculo tangente aos objetos selecionados"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 font-medium cursor-pointer"
                        >
                          <Target className="w-3 h-3" />
                          <span>Círculo tangente</span>
                        </button>
                      )}
                      {selectedConstraintInfo && selectedConstraintInfo.constraintCount > 0 && (
                        <>
                          <span className="font-mono tabular-nums text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                            {selectedConstraintInfo.isLocked
                              ? `${selectedConstraintInfo.constraintCount}× travado`
                              : selectedEditInfo?.canSlideTan2
                                ? '2× desliza/edita'
                                : `${selectedConstraintInfo.constraintCount}× tangente`}
                          </span>
                          <button
                            type="button"
                            onClick={() => onReleaseTangency('one')}
                            title="Remover uma restrição de tangência para editar livremente"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-medium cursor-pointer"
                          >
                            <Unlink className="w-3 h-3" />
                            <span>Soltar tangência</span>
                          </button>
                          {selectedConstraintInfo.constraintCount >= 2 && (
                            <button
                              type="button"
                              onClick={() => onReleaseTangency('all')}
                              title="Soltar todas as tangências deste objeto"
                              className="px-2 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium cursor-pointer"
                            >
                              Liberar tudo
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {selectedCount === 0 && selectedShapeIds.size > 0 && (
                    <>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-zinc-200 pl-1 pr-0.5">
                        {selectedShapeIds.size} forma{selectedShapeIds.size > 1 ? 's' : ''}
                      </span>
                      {phases.length > 1 && (
                        <select
                          aria-label="Mover formas selecionadas para fase"
                          title="Mover formas selecionadas para outra fase"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) onMoveSelectedShapesToPhase(e.target.value);
                          }}
                          className="px-2 py-1 rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 font-medium cursor-pointer"
                        >
                          <option value="" disabled>
                            Mover p/ fase...
                          </option>
                          {phases.map((ph, idx) => (
                            <option key={ph.id} value={ph.id}>
                              {idx + 1}. {ph.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={onDeleteSelectedShapes}
                        title={`Excluir forma(s) selecionada(s) (${delKey})`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-600 text-white hover:bg-rose-700 font-medium cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Excluir</span>
                      </button>
                      <button
                        type="button"
                        onClick={onClearShapeSelection}
                        title="Limpar seleção de formas (Esc)"
                        aria-label="Limpar seleção de formas"
                        className="p-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}

                  {hasClipboard && (
                    <button
                      type="button"
                      onClick={onPasteClipboard}
                      title={`Colar elementos copiados (${modKey}+V)`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 font-medium cursor-pointer"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>Colar</span>
                    </button>
                  )}
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={onClearSelection}
                      title="Limpar seleção (Esc)"
                      aria-label="Limpar seleção"
                      className="p-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Unified Line (L) Freeform Inspector Capsule */}
              {tool === 'ln' && !edit && (
                <div className="pointer-events-auto inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  <span className="font-semibold text-slate-800 dark:text-zinc-100 pl-1 whitespace-nowrap">
                    Reta
                  </span>
                  <div
                    role="group"
                    aria-label="Modo da ferramenta Reta"
                    className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                  >
                    {(
                      [
                        { id: 'free', label: 'Livre', title: 'Reta livre entre 2 pontos (L)' },
                        { id: 'tangent', label: 'Tangente (S)', title: 'Reta tangente a círculo ou vértice (S)' },
                        { id: 'common', label: 'Tang. comum (T)', title: 'Tangente comum entre 2 círculos (T)' },
                      ] as Array<{ id: LineToolMode; label: string; title: string }>
                    ).map((opt) => {
                      const active = opt.id === 'tangent' ? lineMode === 'tangent' || (lineMode === 'free' && tgOn) : lineMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onChangeLineMode(opt.id)}
                          aria-pressed={active}
                          title={opt.title}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                            active
                              ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unified Circle (C) Freeform Inspector Capsule */}
              {tool === 'ci' && !edit && (
                <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  <span className="font-semibold text-slate-800 dark:text-zinc-100 pl-1 whitespace-nowrap">
                    Círculo
                  </span>
                  <div
                    role="group"
                    aria-label="Modo de criação de círculo"
                    className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                  >
                    {(
                      [
                        { id: 'center', label: 'Centro', title: 'Centro + raio (C)' },
                        { id: 'top-left', label: 'Sup. esq.', title: 'Canto superior esquerdo + caixa' },
                        { id: 'diameter', label: 'Borda (B)', title: 'Diâmetro por 2 pontos da borda (B)' },
                        { id: 'tangent', label: 'Tang. 2–4 (A)', title: 'Círculo tangente a 2–4 objetos (A)' },
                      ] as Array<{ id: CircleToolMode; label: string; title: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeCircleMode(opt.id)}
                        aria-pressed={circleMode === opt.id}
                        title={opt.title}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                          circleMode === opt.id
                            ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                            : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {(circleMode === 'center' || circleMode === 'diameter') && (
                    <button
                      type="button"
                      onClick={onToggleTg}
                      aria-pressed={tgOn}
                      title="Modo Tangente (S ou segure Shift)"
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                        tgOn
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200/75 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      Tang. (S)
                    </button>
                  )}

                  {circleMode !== 'tangent' ? (
                    <>
                      <div
                        role="group"
                        aria-label="Regra de tamanho"
                        className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                      >
                        {(
                          [
                            { id: 'free', label: 'Livre' },
                            { id: 'fibonacci', label: 'Fib' },
                            { id: 'golden', label: 'φ' },
                            { id: 'modular', label: 'Mod' },
                          ] as Array<{ id: SizeRule; label: string }>
                        ).map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => onChangeGridConfig({ sizeRule: r.id })}
                            aria-pressed={gridConfig.sizeRule === r.id}
                            title={`Regra de tamanho ${r.label} (${optKey} libera temporariamente)`}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                              gridConfig.sizeRule === r.id
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => onChangeGridConfig({ lockScale: !gridConfig.lockScale })}
                        aria-pressed={gridConfig.lockScale}
                        title="Travar escala dos novos círculos ao criar"
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                          gridConfig.lockScale
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-200/75 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {gridConfig.lockScale ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>Travar novos</span>
                      </button>
                    </>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-zinc-700">
                      <span className="font-mono tabular-nums font-medium text-blue-700 dark:text-blue-300">
                        {tanSel.length}/4
                      </span>
                      {tanSel.length < 2 && (
                        <span className="text-slate-500 dark:text-zinc-400">
                          {tanSel.length === 0 ? 'Clique nos alvos' : '2º alvo'}
                        </span>
                      )}
                      {tanSel.length >= 2 && ghost && (
                        <button
                          type="button"
                          onClick={onCreateTanCircle}
                          title="Criar círculo tangente agora (Enter)"
                          className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium cursor-pointer"
                        >
                          Criar (Enter)
                        </button>
                      )}
                      {tanSel.length >= 2 && tanVariantCount > 1 && (
                        <button
                          type="button"
                          onClick={onCycleTanVariant}
                          title="Alternar variação de tangência (Tab)"
                          className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-mono tabular-nums cursor-pointer"
                        >
                          {(tanVariantIdx % tanVariantCount) + 1}/{tanVariantCount} (Tab)
                        </button>
                      )}
                      {tanSel.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearTanSel}
                          title="Limpar alvos (Esc)"
                          className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Unified Polygon (Q) Freeform Inspector Capsule */}
              {tool === 'pg' && !edit && (
                <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  <Square className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-0.5" />
                  <div
                    role="group"
                    aria-label="Forma do polígono"
                    className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                  >
                    {[
                      { s: 4, label: 'Quad', full: 'Quadrado' },
                      { s: 3, label: 'Tri', full: 'Triângulo' },
                      { s: 5, label: 'Pent', full: 'Pentágono' },
                      { s: 6, label: 'Hex', full: 'Hexágono' },
                      { s: 8, label: 'Oct', full: 'Octógono' },
                    ].map((opt) => (
                      <button
                        key={opt.s}
                        type="button"
                        onClick={() => onChangePolySides(opt.s)}
                        aria-pressed={polySides === opt.s}
                        title={opt.full}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                          polySides === opt.s
                            ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                            : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div
                    role="group"
                    aria-label="Origem da criação"
                    className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeCreationOrigin('center')}
                      aria-pressed={creationOrigin === 'center'}
                      title="Primeiro clique define o centro"
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                        creationOrigin === 'center'
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Centro
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeCreationOrigin('top-left')}
                      aria-pressed={creationOrigin === 'top-left'}
                      title="Primeiro clique ancora o canto superior esquerdo"
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                        creationOrigin === 'top-left'
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Sup. esq.
                    </button>
                  </div>

                  <div
                    role="group"
                    aria-label="Regra de tamanho"
                    className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                  >
                    {(
                      [
                        { id: 'free', label: 'Livre' },
                        { id: 'fibonacci', label: 'Fib' },
                        { id: 'golden', label: 'φ' },
                        { id: 'modular', label: 'Mod' },
                      ] as Array<{ id: SizeRule; label: string }>
                    ).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onChangeGridConfig({ sizeRule: r.id })}
                        aria-pressed={gridConfig.sizeRule === r.id}
                        title={`Regra de tamanho ${r.label} (${optKey} libera temporariamente)`}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                          gridConfig.sizeRule === r.id
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onChangeGridConfig({ lockScale: !gridConfig.lockScale })}
                    aria-pressed={gridConfig.lockScale}
                    title="Travar escala dos novos polígonos ao criar"
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                      gridConfig.lockScale
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-200/75 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {gridConfig.lockScale ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>Travar novos</span>
                  </button>
                </div>
              )}

              {/* Unified Shape Builder (F) Freeform Capsule */}
              {tool === 'shape' && !edit && (
                <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15 dark:border-white/20 ml-0.5"
                    style={{ backgroundColor: activeDispColor }}
                    aria-hidden="true"
                  />
                  <Combine className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300 shrink-0" />

                  <div
                    role="group"
                    aria-label="Operação do construtor de forma"
                    className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeShapeMode('add')}
                      aria-pressed={effectiveShapeMode === 'add'}
                      title="Unir regiões fechadas em um path (clique ou arraste)"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                        effectiveShapeMode === 'add'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Unir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeShapeMode('sub')}
                      aria-pressed={effectiveShapeMode === 'sub'}
                      title="Subtrair regiões de um path existente (ou segure Alt)"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                        effectiveShapeMode === 'sub'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Minus className="w-3 h-3" />
                      <span>Subtrair ({optKey})</span>
                    </button>
                  </div>

                  <div
                    role="group"
                    aria-label="Origem das curvas para regiões"
                    className="inline-flex rounded-full bg-slate-200/75 dark:bg-zinc-800/80 p-0.5 gap-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeShapeScope('all')}
                      aria-pressed={shapeScope === 'all'}
                      title="Usa geometria visível desta fase e das anteriores sem interferir nas formas já criadas"
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                        shapeScope === 'all'
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      + Anteriores
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeShapeScope('phase')}
                      aria-pressed={shapeScope === 'phase'}
                      title="Usa somente a geometria da fase ativa"
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                        shapeScope === 'phase'
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm'
                          : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Só fase ativa
                    </button>
                  </div>

                  <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                    {shapeRegions.length} regiões · {activePhaseShapesCount} formas
                  </span>

                  {activePhaseShapesCount > 0 && !activePhase?.locked && (
                    <button
                      type="button"
                      onClick={onClearPhaseShapes}
                      title="Remover formas construídas nesta fase"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 font-medium whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Limpar formas</span>
                    </button>
                  )}
                </div>
              )}

              {(lockNotice || (activePhase?.locked && tool !== 'move')) && (
                <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-300/90 dark:border-amber-700 bg-amber-50/95 dark:bg-amber-950/90 backdrop-blur-md shadow-lg text-xs text-amber-900 dark:text-amber-200">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium">
                    {lockNotice ?? `Fase "${activePhase?.name}" bloqueada`}
                  </span>
                  {activePhase?.locked && (
                    <button
                      type="button"
                      onClick={onUnlockActivePhase}
                      className="px-2 py-0.5 rounded-full bg-amber-600 text-white hover:bg-amber-700 font-medium whitespace-nowrap cursor-pointer"
                    >
                      Destravar
                    </button>
                  )}
                </div>
              )}

              {tool === 'move' && selTanCandidates.length > 0 && !edit && (
                <div className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-300/90 dark:border-purple-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400" />
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    Tangência possível (1º → 2º):
                  </span>
                  <span className="text-slate-600 dark:text-zinc-300">
                    toque em um ponto roxo
                  </span>
                  <button
                    type="button"
                    onClick={onSwapSelectionOrder}
                    title="Inverter ordem de seleção (2º conecta ao 1º)"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 font-medium cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Inverter (1º ↔ 2º)</span>
                  </button>
                </div>
              )}

              {guides.length > 0 && (
                <div className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-cyan-200/90 dark:border-cyan-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-300 font-medium pl-1">
                    Guias: {guides.length}
                  </span>
                  <button
                    type="button"
                    onClick={onToggleGuidesVisible}
                    title={guidesVisible ? 'Ocultar guias' : 'Mostrar guias'}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer"
                  >
                    {guidesVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{guidesVisible ? 'Visíveis' : 'Ocultas'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleGuidesLocked}
                    title="Bloquear/Desbloquear guias (K)"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                      guidesLocked
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {guidesLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{guidesLocked ? 'Bloqueadas' : 'Bloquear'}</span>
                  </button>
                  {selectedGuideId && !guidesLocked && (
                    <button
                      type="button"
                      onClick={onDeleteSelectedGuide}
                      title="Excluir guia selecionada (Delete)"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remover guia</span>
                    </button>
                  )}
                  {!guidesLocked && (
                    <button
                      type="button"
                      onClick={onClearGuides}
                      title="Remover todas as guias"
                      className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}

              {prio.size > 0 && (
                <div className="pointer-events-auto inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-amber-300/90 dark:border-amber-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs">
                  <span className="font-mono tabular-nums font-medium text-amber-700 dark:text-amber-400 pl-1">
                    Prioridade: {prio.size} objeto{prio.size > 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={onClearPrio}
                    className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70 font-medium cursor-pointer"
                  >
                    Limpar (Esc)
                  </button>
                </div>
              )}

              {activeImg && (
                <div className="pointer-events-auto inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200/90 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg text-xs text-slate-700 dark:text-zinc-200">
                  {refImgs.length > 1 && (
                    <div className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-zinc-400 pl-1 pr-1.5 border-r border-slate-200 dark:border-zinc-700">
                      <span>Img {refImgs.findIndex((i) => i.id === activeImg.id) + 1}/{refImgs.length}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const idx = refImgs.findIndex((i) => i.id === activeImg.id);
                          const next = refImgs[(idx + 1) % refImgs.length];
                          if (next) onSelectRefImg(next.id);
                        }}
                        title="Alternar para próxima imagem de referência"
                        className="px-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 cursor-pointer"
                      >
                        ⇄
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleRefLock(activeImg.id)}
                    title={activeImg.locked ? 'Imagem bloqueada (clique para desbloquear)' : 'Bloquear imagem de referência'}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                      activeImg.locked
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {activeImg.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{activeImg.locked ? 'Bloqueada' : 'Bloquear'}</span>
                  </button>
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                    <span>Opacidade</span>
                    <input
                      type="range"
                      min={0.05}
                      max={0.85}
                      step={0.05}
                      value={activeImg.opacity}
                      onChange={(e) => onChangeRefOpacity(activeImg.id, parseFloat(e.target.value))}
                      className="w-16 accent-blue-600 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums w-8 text-right">
                      {Math.round(activeImg.opacity * 100)}%
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemoveRefImage(activeImg.id)}
                    title="Remover esta imagem de referência"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Remover</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <svg
            ref={svgRef}
            className={`compasso-canvas absolute inset-0 w-full h-full bg-white dark:bg-zinc-950 touch-none select-none ${cursorClass} [--ln:#111827] dark:[--ln:#e4e4e7] [--ac:#2563eb] dark:[--ac:#60a5fa] [--pt:#e11d48] dark:[--pt:#fb7185] [--tcand:#9333ea] dark:[--tcand:#c084fc] [--mut:#64748b] dark:[--mut:#a1a1aa]`}
            viewBox={`${view.x} ${view.y} ${vbW} ${vbH}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Reference images */}
            {refImgs.map((img) => (
              <image
                key={img.id}
                href={img.src}
                x={img.x}
                y={img.y}
                width={img.w}
                height={img.h}
                opacity={img.opacity}
                preserveAspectRatio="none"
                transform={`rotate(${img.r || 0} ${img.x + img.w / 2} ${img.y + img.h / 2})`}
                style={{ pointerEvents: img.locked ? 'none' : 'auto' }}
              />
            ))}

            {/* Modular / Fibonacci / Golden / Polar Work Grid Layer */}
            <WorkGridLayer
              config={gridConfig}
              dark={dark}
              viewK={view.k}
              invK={invK}
              vpX0={vpX0}
              vpY0={vpY0}
              vpX1={vpX1}
              vpY1={vpY1}
            />

            {/* Memoized drafting guides layer */}
            <DraftingGuidesLayer
              guides={guides}
              guidesVisible={guidesVisible}
              guidesLocked={guidesLocked}
              selectedGuideId={selectedGuideId}
              guidePreview={guidePreview}
              invK={invK}
              vpX0={vpX0}
              vpY0={vpY0}
              vpX1={vpX1}
              vpY1={vpY1}
            />

            {/* Built closed SVG paths per phase (rendered under construction lines) */}
            {phases.map((ph) => {
              if (!ph.showPath || ph.pathOpacity <= 0.01) return null;
              const phaseShapes = shapes.filter((sh) => sh.phaseId === ph.id && sh.d);
              if (phaseShapes.length === 0) return null;
              const dispColor = phaseDisplayColor(ph.color, dark);
              return (
                <g
                  key={`paths-layer-${ph.id}`}
                  fill={dispColor}
                  fillOpacity={ph.pathOpacity}
                  fillRule="evenodd"
                  style={{ pointerEvents: 'none' }}
                >
                  {phaseShapes.map((sh) => {
                    const isSel = selectedShapeIds.has(sh.id);
                    return (
                      <path
                        key={sh.id}
                        d={sh.d}
                        stroke={isSel ? '#2563eb' : undefined}
                        strokeWidth={isSel ? 2.2 * invK : undefined}
                        strokeDasharray={isSel ? `${5 * invK} ${3 * invK}` : undefined}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Shape Builder interactive closed regions & live drag preview */}
            {tool === 'shape' && shapeRegions.length > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                {shapeRegions.map((reg) => {
                  const isDragged = dragShapeRegionIds.has(reg.id);
                  const isHovered = hoveredShapeRegionId === reg.id && !isDragged;
                  const fillTone = effectiveShapeMode === 'sub' ? '#e11d48' : activeDispColor;
                  return (
                    <path
                      key={reg.id}
                      d={reg.d}
                      fillRule="evenodd"
                      fill={isHovered ? fillTone : 'transparent'}
                      fillOpacity={isHovered ? 0.2 : 0}
                      stroke={isHovered || isDragged ? fillTone : activeDispColor}
                      strokeOpacity={isHovered || isDragged ? 0.55 : 0.14}
                      strokeWidth={(isHovered || isDragged ? 1.8 : 0.9) * invK}
                      strokeDasharray={isHovered || isDragged ? undefined : `${3 * invK} ${3 * invK}`}
                    />
                  );
                })}
                {dragShapePreviewPath && (
                  <path
                    d={dragShapePreviewPath}
                    fillRule="evenodd"
                    fill={effectiveShapeMode === 'sub' ? '#e11d48' : activeDispColor}
                    fillOpacity={0.34}
                    stroke={effectiveShapeMode === 'sub' ? '#e11d48' : activeDispColor}
                    strokeWidth={2.2 * invK}
                    strokeLinejoin="round"
                  />
                )}
              </g>
            )}

            {/* Memoized static geometry layer (does not re-render on pointermove) */}
            <StaticGeometryLayer
              objs={objs}
              curveCache={curveCache}
              renderedCurves={renderedCurves}
              renderedPoints={renderedPoints}
              phaseMap={phaseMap}
              defaultPhaseId={defaultPhaseId}
              activePhaseId={activePhaseId}
              focusMode={focusMode}
              dark={dark}
              selectedIds={selectedIds}
              prio={prio}
              dimMode={dimMode}
              tool={tool}
              viewK={view.k}
              invK={invK}
              vpX0={vpX0}
              vpY0={vpY0}
              vpX1={vpX1}
              vpY1={vpY1}
              onOpenDimEditor={onOpenDimEditor}
            />

            {/* Selected common-tangent & multi-tangent source objects */}
            {[...tcSel, ...tanSel.map((s) => s.id)].map((id) => {
              const o = getObj(objs, id);
              if (!o || o.dead) return null;
              if (o.t === 'pt') {
                if (!o.ok) return null;
                return (
                  <circle
                    key={`tcsel-pt-${id}`}
                    cx={o.x}
                    cy={o.y}
                    r={9 * invK}
                    fill="none"
                    stroke="var(--ac)"
                    strokeWidth={2.5 * invK}
                  />
                );
              }
              const c = curve(objs, o, curveCache);
              if (!c) return null;
              if (c.t === 'c') {
                return (
                  <circle
                    key={`tcsel-c-${id}`}
                    cx={c.x}
                    cy={c.y}
                    r={c.r}
                    fill="none"
                    stroke="var(--ac)"
                    strokeWidth={4 * invK}
                    opacity={0.38}
                  />
                );
              }
              if (c.t === 'p') {
                return (
                  <polygon
                    key={`tcsel-p-${id}`}
                    points={c.verts.map((v) => `${v.x},${v.y}`).join(' ')}
                    fill="none"
                    stroke="var(--ac)"
                    strokeWidth={4 * invK}
                    strokeLinejoin="round"
                    opacity={0.38}
                  />
                );
              }
              if (c.t !== 'l') return null;
              const pts = clipLine(c, vpX0, vpY0, vpX1, vpY1);
              if (!pts) return null;
              return (
                <line
                  key={`tcsel-l-${id}`}
                  x1={pts[0]}
                  y1={pts[1]}
                  x2={pts[2]}
                  y2={pts[3]}
                  stroke="var(--ac)"
                  strokeWidth={4 * invK}
                  opacity={0.38}
                />
              );
            })}

            {/* Hovered candidate target in multi-tangent circle mode */}
            {tool === 'ci' &&
              circleMode === 'tangent' &&
              hoveredTanTarget !== null &&
              tanSel.length < 4 &&
              (() => {
                const o = getObj(objs, hoveredTanTarget);
                if (!o || o.dead) return null;
                if (o.t === 'pt') {
                  if (!o.ok) return null;
                  return (
                    <circle
                      cx={o.x}
                      cy={o.y}
                      r={9 * invK}
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth={2.5 * invK}
                    />
                  );
                }
                const c = curve(objs, o, curveCache);
                if (!c) return null;
                if (c.t === 'c') {
                  return (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={c.r}
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth={4 * invK}
                      opacity={0.45}
                    />
                  );
                }
                if (c.t === 'p') {
                  return (
                    <polygon
                      points={c.verts.map((v) => `${v.x},${v.y}`).join(' ')}
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth={4 * invK}
                      strokeLinejoin="round"
                      opacity={0.45}
                    />
                  );
                }
                if (c.t !== 'l') return null;
                const pts = clipLine(c, vpX0, vpY0, vpX1, vpY1);
                if (!pts) return null;
                return (
                  <line
                    x1={pts[0]}
                    y1={pts[1]}
                    x2={pts[2]}
                    y2={pts[3]}
                    stroke="#0891b2"
                    strokeWidth={4 * invK}
                    opacity={0.45}
                  />
                );
              })()}

            {/* Editing circle highlight */}
            {edit &&
              (() => {
                const c = curve(objs, getObj(objs, edit.id), curveCache);
                return (
                  <>
                    {c && c.t === 'c' && (
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={c.r}
                        fill="none"
                        stroke="var(--pt)"
                        strokeWidth={3 * invK}
                        opacity={0.35}
                      />
                    )}
                    <circle
                      cx={edit.ax}
                      cy={edit.ay}
                      r={7 * invK}
                      fill="none"
                      stroke="var(--pt)"
                      strokeWidth={2 * invK}
                    />
                  </>
                );
              })()}

            {/* Target curves highlighted during tangent snap */}
            {ghost &&
              [ghost.tan, ghost.tan2, ...(ghost.tanTargets ?? [])].map((gid, idx) => {
                if (gid === undefined) return null;
                const c = curve(objs, getObj(objs, gid), curveCache);
                if (!c) return null;
                if (c.t === 'c') {
                  return (
                    <circle
                      key={`gtan-${gid}-${idx}`}
                      cx={c.x}
                      cy={c.y}
                      r={c.r}
                      fill="none"
                      stroke="var(--ac)"
                      strokeWidth={4 * invK}
                      opacity={0.35}
                    />
                  );
                }
                if (c.t === 'p') {
                  return (
                    <polygon
                      key={`gtan-${gid}-${idx}`}
                      points={c.verts.map((v) => `${v.x},${v.y}`).join(' ')}
                      fill="none"
                      stroke="var(--ac)"
                      strokeWidth={4 * invK}
                      strokeLinejoin="round"
                      opacity={0.35}
                    />
                  );
                }
                if (c.t !== 'l') return null;
                const pts = clipLine(c, vpX0, vpY0, vpX1, vpY1);
                if (!pts) return null;
                return (
                  <line
                    key={`gtan-${gid}-${idx}`}
                    x1={pts[0]}
                    y1={pts[1]}
                    x2={pts[2]}
                    y2={pts[3]}
                    stroke="var(--ac)"
                    strokeWidth={4 * invK}
                    opacity={0.35}
                  />
                );
              })}

            {/* Ghost preview + Shift tangency guidelines */}
            {ghost &&
              (pend.length === 1 ||
                (tool === 'ln' && lineMode === 'common') ||
                (tool === 'ci' && circleMode === 'tangent') ||
                edit !== null) && (
              <>
                {ghost.guidelines?.map((gl, idx) => (
                  <line
                    key={`guide-${idx}`}
                    x1={gl.x1}
                    y1={gl.y1}
                    x2={gl.x2}
                    y2={gl.y2}
                    stroke="var(--ac)"
                    strokeWidth={1 * invK}
                    strokeDasharray={`${3 * invK} ${3 * invK}`}
                    opacity={0.65}
                  />
                ))}

                {ghost.box && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={ghost.box.x}
                      y={ghost.box.y}
                      width={ghost.box.w}
                      height={ghost.box.h}
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth={1 * invK}
                      strokeDasharray={`${3.5 * invK} ${3 * invK}`}
                      opacity={0.75}
                    />
                    <rect
                      x={ghost.box.x - 3 * invK}
                      y={ghost.box.y - 3 * invK}
                      width={6 * invK}
                      height={6 * invK}
                      fill="#0891b2"
                      stroke="#fff"
                      strokeWidth={1 * invK}
                    />
                  </g>
                )}

                {ghost.pg ? (
                  <>
                    <polygon
                      points={ghost.pg.verts.map((v) => `${v.x},${v.y}`).join(' ')}
                      fill="none"
                      stroke="var(--ac)"
                      strokeWidth={1.5 * invK}
                      strokeDasharray={`${5 * invK} ${4 * invK}`}
                      strokeLinejoin="round"
                    />
                    {dimMode !== 'off' && ghost.pg.side * view.k >= 18 && (
                      <text
                        x={ghost.pg.cx}
                        y={ghost.pg.cy + 12 * invK}
                        fontSize={10.5 * invK}
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="500"
                        textAnchor="middle"
                        fill="var(--ac)"
                        opacity={0.65}
                        style={{ pointerEvents: 'none' }}
                      >
                        {formatDim(ghost.pg.side, 'L')}
                      </text>
                    )}
                  </>
                ) : ghost.ln ? (
                  (() => {
                    const pts = clipLine(ghost.ln, vpX0, vpY0, vpX1, vpY1);
                    if (!pts) return null;
                    return (
                      <line
                        x1={pts[0]}
                        y1={pts[1]}
                        x2={pts[2]}
                        y2={pts[3]}
                        stroke="var(--ac)"
                        strokeWidth={1.5 * invK}
                        strokeDasharray={`${5 * invK} ${4 * invK}`}
                      />
                    );
                  })()
                ) : ghost.x !== undefined && ghost.y !== undefined && ghost.r !== undefined ? (
                  <>
                    <circle
                      cx={ghost.x}
                      cy={ghost.y}
                      r={ghost.r}
                      fill="none"
                      stroke="var(--ac)"
                      strokeWidth={1.5 * invK}
                      strokeDasharray={`${5 * invK} ${4 * invK}`}
                    />
                    {dimMode !== 'off' && ghost.r * view.k >= 14 && (
                      <text
                        x={ghost.x}
                        y={ghost.y + 12 * invK}
                        fontSize={10.5 * invK}
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="500"
                        textAnchor="middle"
                        fill="var(--ac)"
                        opacity={0.55}
                        style={{ pointerEvents: 'none' }}
                      >
                        {dimMode === 'd' ? formatDim(ghost.r * 2, 'Ø') : formatDim(ghost.r, 'r')}
                      </text>
                    )}
                  </>
                ) : null}

                {/* Tangency contact markers */}
                {ghost.contacts?.map((pt, idx) => (
                  <g key={`contact-${idx}`} transform={`translate(${pt.x} ${pt.y}) rotate(45)`}>
                    <rect
                      x={-4 * invK}
                      y={-4 * invK}
                      width={8 * invK}
                      height={8 * invK}
                      fill="var(--ac)"
                      stroke="#fff"
                      strokeWidth={1.5 * invK}
                    />
                  </g>
                ))}
              </>
            )}

            {/* Possible tangency preview layer (distinct purple color: during drag OR 1º→2º ordered selection) */}
            {(() => {
              const cands = dragTanOverlay ? dragTanOverlay.candidates : selTanCandidates;
              const activeCand = dragTanOverlay ? dragTanOverlay.active : hoveredSelTanCand;
              if (cands.length === 0) return null;

              const targetIds = Array.from(new Set(cands.map((c) => c.secondId)));
              const orderedPair =
                !dragTanOverlay && selTanCandidates.length > 0
                  ? [selTanCandidates[0].firstId, selTanCandidates[0].secondId]
                  : [];

              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Target object purple halo */}
                  {targetIds.map((tid) => {
                    const tc = curve(objs, getObj(objs, tid), curveCache);
                    if (!tc) return null;
                    if (tc.t === 'c') {
                      return (
                        <circle
                          key={`tcand-t-${tid}`}
                          cx={tc.x}
                          cy={tc.y}
                          r={tc.r}
                          fill="none"
                          stroke="var(--tcand)"
                          strokeWidth={4 * invK}
                          opacity={0.32}
                        />
                      );
                    }
                    if (tc.t === 'p') {
                      return (
                        <polygon
                          key={`tcand-t-${tid}`}
                          points={tc.verts.map((v) => `${v.x},${v.y}`).join(' ')}
                          fill="none"
                          stroke="var(--tcand)"
                          strokeWidth={4 * invK}
                          strokeLinejoin="round"
                          opacity={0.32}
                        />
                      );
                    }
                    if (tc.t !== 'l') return null;
                    const pts = clipLine(tc, vpX0, vpY0, vpX1, vpY1);
                    if (!pts) return null;
                    return (
                      <line
                        key={`tcand-t-${tid}`}
                        x1={pts[0]}
                        y1={pts[1]}
                        x2={pts[2]}
                        y2={pts[3]}
                        stroke="var(--tcand)"
                        strokeWidth={4 * invK}
                        opacity={0.32}
                      />
                    );
                  })}

                  {/* Active / hovered candidate preview curve + guideline */}
                  {activeCand && (
                    <>
                      {activeCand.guideline && (
                        <line
                          x1={activeCand.guideline.x1}
                          y1={activeCand.guideline.y1}
                          x2={activeCand.guideline.x2}
                          y2={activeCand.guideline.y2}
                          stroke="var(--tcand)"
                          strokeWidth={1.2 * invK}
                          strokeDasharray={`${3 * invK} ${3 * invK}`}
                          opacity={0.75}
                        />
                      )}
                      {activeCand.previewCurve.t === 'c' ? (
                        <circle
                          cx={activeCand.previewCurve.x}
                          cy={activeCand.previewCurve.y}
                          r={activeCand.previewCurve.r}
                          fill="none"
                          stroke="var(--tcand)"
                          strokeWidth={2 * invK}
                          strokeDasharray={`${5 * invK} ${3.5 * invK}`}
                        />
                      ) : activeCand.previewCurve.t === 'p' ? (
                        <polygon
                          points={activeCand.previewCurve.verts.map((v) => `${v.x},${v.y}`).join(' ')}
                          fill="none"
                          stroke="var(--tcand)"
                          strokeWidth={2 * invK}
                          strokeDasharray={`${5 * invK} ${3.5 * invK}`}
                          strokeLinejoin="round"
                        />
                      ) : activeCand.previewCurve.t === 'l' ? (
                        (() => {
                          const pts = clipLine(activeCand.previewCurve, vpX0, vpY0, vpX1, vpY1);
                          if (!pts) return null;
                          return (
                            <line
                              x1={pts[0]}
                              y1={pts[1]}
                              x2={pts[2]}
                              y2={pts[3]}
                              stroke="var(--tcand)"
                              strokeWidth={2 * invK}
                              strokeDasharray={`${5 * invK} ${3.5 * invK}`}
                            />
                          );
                        })()
                      ) : null}
                    </>
                  )}

                  {/* Selection order badges (1 and 2) when connecting in order */}
                  {orderedPair.map((oid, idx) => {
                    const oc = curve(objs, getObj(objs, oid), curveCache);
                    if (!oc) return null;
                    let bx = 0;
                    let by = 0;
                    if (oc.t === 'c') {
                      bx = oc.x;
                      by = oc.y - oc.r - 12 * invK;
                    } else if (oc.t === 'p') {
                      bx = oc.cx;
                      by = oc.cy - oc.r - 12 * invK;
                    } else {
                      const pts = clipLine(oc, vpX0, vpY0, vpX1, vpY1);
                      if (!pts) return null;
                      bx = (pts[0] + pts[2]) / 2;
                      by = (pts[1] + pts[3]) / 2 - 12 * invK;
                    }
                    return (
                      <g key={`order-badge-${oid}`} transform={`translate(${bx} ${by})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={8.5 * invK}
                          fill={idx === 0 ? 'var(--ac)' : 'var(--tcand)'}
                          stroke="#fff"
                          strokeWidth={1.5 * invK}
                        />
                        <text
                          x={0}
                          y={3.5 * invK}
                          fontSize={10 * invK}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="700"
                          textAnchor="middle"
                          fill="#ffffff"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}

                  {/* Specific candidate tangency points on target object */}
                  {cands.map((cand) => {
                    const isAct = activeCand?.key === cand.key;
                    return (
                      <g key={cand.key} transform={`translate(${cand.contact.x} ${cand.contact.y})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={(isAct ? 12 : 9.5) * invK}
                          fill="var(--tcand)"
                          opacity={isAct ? 0.24 : 0.14}
                        />
                        {isAct ? (
                          <g transform="rotate(45)">
                            <rect
                              x={-5 * invK}
                              y={-5 * invK}
                              width={10 * invK}
                              height={10 * invK}
                              fill="var(--tcand)"
                              stroke="#fff"
                              strokeWidth={1.8 * invK}
                            />
                          </g>
                        ) : (
                          <>
                            <circle
                              cx={0}
                              cy={0}
                              r={5.5 * invK}
                              fill="#ffffff"
                              stroke="var(--tcand)"
                              strokeWidth={2 * invK}
                            />
                            <circle cx={0} cy={0} r={2.3 * invK} fill="var(--tcand)" />
                          </>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* Participating parent highlight + temporary rim resize handle (for circles without blue edge points) */}
            {tool === 'move' && !edit && selectedConstraintInfo && selectedConstraintInfo.parentIds.length > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                {selectedConstraintInfo.parentIds.map((pid) => {
                  const po = getObj(objs, pid);
                  if (!po || po.dead) return null;
                  if (po.t === 'pt') {
                    if (!po.ok) return null;
                    return (
                      <circle
                        key={`parent-pt-${pid}`}
                        cx={po.x}
                        cy={po.y}
                        r={8 * invK}
                        fill="none"
                        stroke="#d97706"
                        strokeWidth={2 * invK}
                        strokeDasharray={`${3 * invK} ${2.5 * invK}`}
                        opacity={0.75}
                      />
                    );
                  }
                  const pc = curve(objs, po, curveCache);
                  if (!pc) return null;
                  if (pc.t === 'c') {
                    return (
                      <circle
                        key={`parent-c-${pid}`}
                        cx={pc.x}
                        cy={pc.y}
                        r={pc.r}
                        fill="none"
                        stroke="#d97706"
                        strokeWidth={2.5 * invK}
                        strokeDasharray={`${6 * invK} ${4 * invK}`}
                        opacity={0.58}
                      />
                    );
                  }
                  if (pc.t === 'p') {
                    return (
                      <polygon
                        key={`parent-p-${pid}`}
                        points={pc.verts.map((v) => `${v.x},${v.y}`).join(' ')}
                        fill="none"
                        stroke="#d97706"
                        strokeWidth={2.5 * invK}
                        strokeDasharray={`${6 * invK} ${4 * invK}`}
                        strokeLinejoin="round"
                        opacity={0.58}
                      />
                    );
                  }
                  if (pc.t !== 'l') return null;
                  const pts = clipLine(pc, vpX0, vpY0, vpX1, vpY1);
                  if (!pts) return null;
                  return (
                    <line
                      key={`parent-l-${pid}`}
                      x1={pts[0]}
                      y1={pts[1]}
                      x2={pts[2]}
                      y2={pts[3]}
                      stroke="#d97706"
                      strokeWidth={2.5 * invK}
                      strokeDasharray={`${6 * invK} ${4 * invK}`}
                      opacity={0.58}
                    />
                  );
                })}
              </g>
            )}

            {tool === 'move' &&
              !edit &&
              selectedEditInfo?.resizeHandle &&
              !selectedEditInfo.resizeHandle.hasFreeEdgePt &&
              selectedCircleInfo && (
                <g style={{ pointerEvents: 'none' }}>
                  <line
                    x1={selectedCircleInfo.cx}
                    y1={selectedCircleInfo.cy}
                    x2={selectedEditInfo.resizeHandle.x}
                    y2={selectedEditInfo.resizeHandle.y}
                    stroke="var(--ac)"
                    strokeWidth={1 * invK}
                    strokeDasharray={`${3 * invK} ${3 * invK}`}
                    opacity={hoveredResizeGrip ? 0.75 : 0.4}
                  />
                  <g
                    transform={`translate(${selectedEditInfo.resizeHandle.x} ${selectedEditInfo.resizeHandle.y})`}
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={(hoveredResizeGrip ? 11 : 9) * invK}
                      fill="var(--ac)"
                      opacity={hoveredResizeGrip ? 0.22 : 0.12}
                    />
                    <circle
                      cx={0}
                      cy={0}
                      r={(hoveredResizeGrip ? 6 : 5) * invK}
                      fill="#ffffff"
                      stroke="var(--ac)"
                      strokeWidth={2 * invK}
                    />
                    <circle cx={0} cy={0} r={2 * invK} fill="var(--ac)" />
                  </g>
                </g>
              )}

            {/* Active Ruler measurement & angled guide preview */}
            {rulerMeasure && (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={rulerMeasure.x1}
                  y1={rulerMeasure.y1}
                  x2={rulerMeasure.x2}
                  y2={rulerMeasure.y2}
                  stroke="#0891b2"
                  strokeWidth={2 * invK}
                />
                <circle cx={rulerMeasure.x1} cy={rulerMeasure.y1} r={4.5 * invK} fill="#0891b2" />
                <circle cx={rulerMeasure.x2} cy={rulerMeasure.y2} r={4.5 * invK} fill="#0891b2" />
                <g transform={`translate(${rulerMeasure.mx} ${rulerMeasure.my - 14 * invK})`}>
                  <rect
                    x={-((rulerMeasure.label.length * 6.4 + 12) * invK) / 2}
                    y={-12 * invK}
                    width={(rulerMeasure.label.length * 6.4 + 12) * invK}
                    height={17 * invK}
                    rx={3 * invK}
                    fill="#0891b2"
                  />
                  <text
                    x={0}
                    y={0}
                    fontSize={10.5 * invK}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="600"
                    textAnchor="middle"
                    fill="#ffffff"
                  >
                    {rulerMeasure.label}
                  </text>
                </g>
              </g>
            )}

            {/* Pending point rings */}
            {pend.map((id) => {
              const o = getObj(objs, id);
              if (!o || o.t !== 'pt' || !o.ok) return null;
              return (
                <circle
                  key={`pend-${id}`}
                  cx={o.x}
                  cy={o.y}
                  r={9 * invK}
                  fill="none"
                  stroke="var(--ac)"
                  strokeWidth={2 * invK}
                />
              );
            })}

            {/* Smart alignment snap guides during drag */}
            {isDragging && smartGuides.length > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                {smartGuides.map((sg, idx) => (
                  <line
                    key={`sg-${idx}`}
                    x1={sg.x1}
                    y1={sg.y1}
                    x2={sg.x2}
                    y2={sg.y2}
                    stroke="#ec4899"
                    strokeWidth={1.15 * invK}
                    strokeDasharray={`${3.5 * invK} ${3 * invK}`}
                    opacity={0.88}
                  />
                ))}
              </g>
            )}

            {/* Marquee selection box */}
            {marquee && (
              <rect
                x={Math.min(marquee.x0, marquee.x1)}
                y={Math.min(marquee.y0, marquee.y1)}
                width={Math.abs(marquee.x1 - marquee.x0)}
                height={Math.abs(marquee.y1 - marquee.y0)}
                fill="var(--ac)"
                fillOpacity={0.08}
                stroke="var(--ac)"
                strokeWidth={1 * invK}
                strokeDasharray={`${4 * invK} ${3 * invK}`}
              />
            )}

            {/* Freeform-style Selection Bounding Box (when 2+ units or group selected) */}
            {showGroupBoundingBox && selectionBounds && !isDragging && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={selectionBounds.minX}
                  y={selectionBounds.minY}
                  width={Math.max(1e-3, selectionBounds.width)}
                  height={Math.max(1e-3, selectionBounds.height)}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={1.15 * invK}
                  opacity={0.85}
                />
                {[
                  [selectionBounds.minX, selectionBounds.minY],
                  [selectionBounds.maxX, selectionBounds.minY],
                  [selectionBounds.maxX, selectionBounds.maxY],
                  [selectionBounds.minX, selectionBounds.maxY],
                ].map(([cx, cy], idx) => (
                  <circle
                    key={`sel-bbox-dot-${idx}`}
                    cx={cx}
                    cy={cy}
                    r={3.8 * invK}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={1.1 * invK}
                  />
                ))}
              </g>
            )}

            {/* Reference image transform handles */}
            {refHandles && (
              <g>
                <polygon
                  points={refHandles.corners.map((p) => p.join(',')).join(' ')}
                  fill="none"
                  stroke="var(--ac)"
                  strokeWidth={1 * invK}
                  strokeDasharray={`${4 * invK} ${3 * invK}`}
                />
                <line
                  x1={refHandles.topMid[0]}
                  y1={refHandles.topMid[1]}
                  x2={refHandles.rotPt[0]}
                  y2={refHandles.rotPt[1]}
                  stroke="var(--ac)"
                  strokeWidth={1 * invK}
                />
                <circle cx={refHandles.rotPt[0]} cy={refHandles.rotPt[1]} r={6 * invK} fill="var(--ac)" />
                {refHandles.corners.map((p, idx) => (
                  <rect
                    key={`rh-${idx}`}
                    x={p[0] - 5 * invK}
                    y={p[1] - 5 * invK}
                    width={10 * invK}
                    height={10 * invK}
                    fill="#fff"
                    stroke="var(--ac)"
                    strokeWidth={1.5 * invK}
                  />
                ))}
              </g>
            )}
          </svg>

          {/* Freeform-style Floating Selection Capsule + Align/Distribute/Group/Combine/Symmetry Popover */}
          {selectionBounds && !isDragging && !editingDim && (
            <FreeformAlignPopover
              open={alignPopoverOpen}
              onToggleOpen={onToggleAlignPopover}
              anchorScreenX={(selectionBounds.cx - view.x) * view.k}
              anchorScreenY={(selectionBounds.minY - view.y) * view.k}
              containerW={size.w}
              unitCount={selectionLayoutMeta.unitCount}
              canGroup={selectionLayoutMeta.canGroup}
              canUngroup={selectionLayoutMeta.canUngroup}
              closedCurveCount={selectionLayoutMeta.closedCurveCount}
              hasScalableSelection={selectionLayoutMeta.hasScalableSelection}
              scaleLockState={selectionLayoutMeta.scaleLockState}
              onAlign={onAlignSelection}
              onDistribute={onDistributeSelection}
              onGroup={onGroupSelection}
              onUngroup={onUngroupSelection}
              onCombineShapes={onCombineSelectedShapes}
              onMirror={onMirrorSelection}
              onRadialArray={onRadialArraySelection}
              onToggleScaleLock={onToggleScaleLockSelection}
            />
          )}

          {/* GPU-composited cursor / snap reticle & label overlay (avoids SVG dirty-rect paint trails) */}
          {hover && (
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute top-0 left-0 will-change-transform"
              style={{
                transform: `translate3d(${(hover.x - view.x) * view.k}px, ${(hover.y - view.y) * view.k}px, 0)`,
              }}
            >
              {hover.k === 'free' && !hover.guideTag ? (
                <div className="w-[11px] h-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-slate-500/75 dark:border-zinc-400/75" />
              ) : (
                <div className="relative -translate-x-1/2 -translate-y-1/2 w-[17px] h-[17px] flex items-center justify-center">
                  <div
                    className={`w-[17px] h-[17px] rounded-full border-2 ${
                      hover.k === 'on'
                        ? 'border-blue-600 dark:border-blue-400'
                        : hover.k === 'free' && hover.guideTag
                          ? 'border-cyan-600'
                          : 'border-rose-600 dark:border-rose-400'
                    }`}
                  />
                  <div
                    className={`absolute w-[5px] h-[5px] rounded-full ${
                      hover.k === 'on'
                        ? 'bg-blue-600 dark:bg-blue-400'
                        : hover.k === 'free' && hover.guideTag
                          ? 'bg-cyan-600'
                          : 'bg-rose-600 dark:bg-rose-400'
                    }`}
                  />
                </div>
              )}
            </div>
          )}

          {snapTagPos && (
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute top-0 left-0 will-change-transform"
              style={{
                transform: `translate3d(${(snapTagPos.x - view.x) * view.k + 13}px, ${(snapTagPos.y - view.y) * view.k - 24}px, 0)`,
              }}
            >
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] leading-none font-mono font-semibold text-white shadow-sm ${
                  snapTagPos.tone === 'blue'
                    ? 'bg-blue-600'
                    : snapTagPos.tone === 'cyan'
                      ? 'bg-cyan-600'
                      : snapTagPos.tone === 'purple'
                        ? 'bg-purple-600'
                        : 'bg-rose-600'
                }`}
              >
                {snapTagPos.text}
              </span>
            </div>
          )}

          {/* Inline dimension editor overlay at circle/polygon center */}
          {editingDim &&
            (() => {
              const sx = (editingDim.cx - view.x) * view.k;
              const sy = (editingDim.cy - view.y) * view.k;
              const left = Math.min(Math.max(12, sx - 96), Math.max(12, size.w - 220));
              const top = Math.min(Math.max(12, sy - 20), Math.max(12, size.h - 140));
              const unitPrefix = editingDim.kind === 'pg' ? 'L' : dimMode === 'r' ? 'r' : 'Ø';
              const rulePresets =
                gridConfig.sizeRule !== 'free'
                  ? getSizeRuleOptions(gridConfig.sizeRule, gridConfig.unit, gridConfig.subdivisions).slice(0, 6)
                  : [];
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onCommitDimEdit();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ left, top }}
                  className="absolute z-20 w-52 rounded-md border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 shadow-lg p-2 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <span>
                      {editingDim.kind === 'pg'
                        ? 'Lado (L)'
                        : dimMode === 'r'
                          ? 'Raio (r) · tangentes fixas'
                          : 'Diâmetro (Ø) · tangentes fixas'}
                    </span>
                    <button
                      type="button"
                      onClick={onCancelDimEdit}
                      aria-label="Cancelar edição de dimensão"
                      className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-semibold text-slate-600 dark:text-zinc-300">
                      {unitPrefix}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      value={dimDraft}
                      onChange={(e) => onChangeDimDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          onCancelDimEdit();
                        }
                      }}
                      className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono tabular-nums text-slate-900 dark:text-zinc-100 focus:outline-2 focus:outline-blue-600"
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium cursor-pointer shrink-0"
                    >
                      OK
                    </button>
                  </div>
                  {rulePresets.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {rulePresets.map((opt) => (
                        <button
                          key={opt.tag}
                          type="button"
                          onClick={() => onCommitDimEdit(opt.value)}
                          title={`Aplicar ${opt.tag} (${opt.value} px)`}
                          className="px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-mono text-[10px] cursor-pointer"
                        >
                          {opt.tag}: {opt.value}
                        </button>
                      ))}
                    </div>
                  )}
                  {dimError && (
                    <p className="text-[11px] leading-snug text-rose-600 dark:text-rose-400">
                      {dimError}
                    </p>
                  )}
                </form>
              );
            })()}

          {showGridPanel && (
            <GridPopover
              config={gridConfig}
              onChange={onChangeGridConfig}
              onCenterOrigin={onCenterGridOrigin}
              onGenerateFibGeometry={onGenerateFibGeometry}
              onClose={onCloseGridPanel}
            />
          )}

          {/* Floating Bottom Phase Timeline Dock */}
          <PhaseTimeline
            phases={phases}
            activePhaseId={activePhaseId}
            dark={dark}
            focusMode={focusMode}
            crossPhaseSnap={crossPhaseSnap}
            countsByPhase={countsByPhase}
            onSelectPhase={onSelectPhase}
            onAddPhase={onAddPhase}
            onUpdatePhase={onUpdatePhase}
            onRequestDeletePhase={onRequestDeletePhase}
            onToggleFocusMode={onToggleFocusMode}
            onToggleCrossPhaseSnap={onToggleCrossPhaseSnap}
          />
        </div>
      </div>
    </main>
  );
};

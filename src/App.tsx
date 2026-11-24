import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { CanvasStage, type MarqueeBox } from './components/CanvasStage';
import { PHASE_COLOR_PALETTE, type PhaseCounts } from './components/PhaseTimeline';
import { Toolbar } from './components/Toolbar';
import {
  DEFAULT_SNAP_PX,
  DEFAULT_SVG_OVERLAP_PX,
  addObj,
  allInter,
  alignObjects,
  applyDragTangencySnap,
  applyTangencyConnection,
  buildCopySubgraph,
  buildCurveCache,
  cloneObjs,
  commitSnap,
  commonTanFor,
  computeTangencyCandidates,
  createDemoObjs,
  curve,
  descOf,
  distToCurve,
  distToGuide,
  distributeObjects,
  findDragTangencySnap,
  findSmartAlignSnap,
  getAlignUnitCount,
  getCircleEditInfo,
  getObj,
  getSelectionBoundingBox,
  getTangentConstraintInfo,
  groupObjects,
  guideToCurve,
  isPrioritized,
  killObj,
  makeSVG,
  mirrorObjects,
  movableRootPointsForSelection,
  nearestPolyEdge,
  pasteSubgraph,
  polyEdgeLine,
  projectOnCurve,
  radialArrayObjects,
  recalc,
  refsOf,
  releaseTangency,
  safeSnap,
  setCircleRadius,
  setPolygonSide,
  snap,
  solveMultiTangent,
  tanFields,
  tanIds,
  tanSolve,
  tangentFor,
  tangentLineFor,
  ungroupObjects,
  type CircleEditInfo,
} from './geometry/engine';
import {
  DEFAULT_GRID_CONFIG,
  computeFibonacciTiles,
  snapSizeByRule,
  snapToGrid,
  type GridConfig,
} from './geometry/grid';
import { buildPlanarArrangement, combineClosedCurvesAsShape } from './geometry/shapeBuilder';
import type {
  AlignMode,
  BuiltShape,
  CircleCurve,
  CircleObj,
  CircleToolMode,
  CombineShapeOp,
  CopiedSubgraph,
  CreationOrigin,
  Curve,
  DimMode,
  DistributeAxis,
  EditState,
  GeomObj,
  GhostPreview,
  GuideLine,
  Guideline,
  LineToolMode,
  MirrorAxis,
  MultiTanSolution,
  Phase,
  PointObj,
  PolyCurve,
  RefImage,
  SmartGuide,
  SnapResult,
  SvgExportLayers,
  TanTargetSel,
  TangencyCandidate,
  ToolId,
  ViewState,
} from './geometry/types';
import { delKey, modKey, optKey } from './geometry/types';

const TOOL_MSGS: Record<ToolId, string> = {
  move: 'Arraste no vazio para seleção em caixa (Espaço+arrastar move a tela). Selecione 1+ objetos para alinhar/travar escala/espelhar ou Shift+clique em 2 para conectar tangência.',
  ln: 'Reta (L): alterne entre Reta livre, Tangente (S) ou Tang. comum (T) na cápsula contextual.',
  ci: 'Círculo (C): alterne entre Centro, Sup. esq., Borda/Diâm. (B) ou Círc. tang. (A) na cápsula contextual.',
  pg: 'Quadrado/Polígono (Q): defina por Centro ou Sup. esq. na cápsula contextual. Shift fixa ângulos de 15° e Alt/⌥ ignora snap.',
  shape: 'Construtor de Forma (F): clique ou arraste sobre regiões fechadas para criar um path na fase ativa. Segure Alt/⌥ para subtrair.',
  ruler: 'Régua / Guia (U): clique em 2 pontos para medir distância/ângulo e criar guia inclinada, ou arraste das réguas superior/esquerda para guias H/V.',
  del: 'Apagar (X): clique em um ponto, curva, polígono, forma construída ou guia destravada para apagá-lo.',
};

const INITIAL_PHASES: Phase[] = [
  {
    id: 'phase-1',
    name: 'Silhueta',
    color: '#111827',
    showGeometry: true,
    geometryOpacity: 1,
    showPath: true,
    pathOpacity: 0.45,
    locked: false,
  },
  {
    id: 'phase-2',
    name: 'Vincos',
    color: '#059669',
    showGeometry: true,
    geometryOpacity: 1,
    showPath: true,
    pathOpacity: 0.6,
    locked: false,
  },
];

const NEW_PHASE_PRESETS: Array<{ name: string; color: string }> = [
  { name: 'Cortes', color: '#e11d48' },
  { name: 'Detalhes', color: '#2563eb' },
  { name: 'Dobras', color: '#d97706' },
  { name: 'Construção', color: '#9333ea' },
];

type HistorySnapshot = {
  objs: GeomObj[];
  shapes: BuiltShape[];
  phases: Phase[];
  activePhaseId: string;
  refImgs: RefImage[];
  guides: GuideLine[];
};

type ConfirmDialogState =
  | {
      kind: 'phase-delete';
      phaseId: string;
      phaseName: string;
      objCount: number;
      shapeCount: number;
      crossDepsCount: number;
    }
  | { kind: 'clear' }
  | { kind: 'demo' };

type ShapeDragState = {
  mode: 'add' | 'sub';
  regionIds: Set<string>;
  lastX: number;
  lastY: number;
};

function cloneShapes(shapes: BuiltShape[]): BuiltShape[] {
  return shapes.map((s) => ({
    ...s,
    seeds: s.seeds.map((pt) => ({ x: pt.x, y: pt.y })),
  }));
}

function clonePhases(phases: Phase[]): Phase[] {
  return phases.map((p) => ({ ...p }));
}

function cloneRefImgs(imgs: RefImage[]): RefImage[] {
  return imgs.map((img) => ({ ...img }));
}

function cloneGuides(guides: GuideLine[]): GuideLine[] {
  return guides.map((g) => ({ ...g }));
}

type ImgDragState =
  | { id: string; m: 'rot' }
  | { id: string; m: 'sc'; d0: number; w0: number; h0: number; cx: number; cy: number }
  | { id: string; m: 'mv'; sx: number; sy: number; x0: number; y0: number };

type DragState =
  | { kind: 'point'; id: number; saved: boolean }
  | {
      kind: 'group';
      sx: number;
      sy: number;
      origins: Array<{ id: number; x: number; y: number }>;
      saved: boolean;
      modifiedCurveId?: number;
      fixedCenter?: boolean;
      anchorEnd?: 'a' | 'b';
      pgCornerEdit?: {
        polyId: number;
        cx: number;
        cy: number;
        sides: number;
        lockedRadius?: number;
      };
    }
  | {
      kind: 'resize';
      id: number;
      baseObjs: GeomObj[];
      origCx: number;
      origCy: number;
      origR: number;
      sx: number;
      sy: number;
      ux: number;
      uy: number;
      isTanOffset: boolean;
      saved: boolean;
    }
  | {
      kind: 'tan2';
      id: number;
      baseObjs: GeomObj[];
      origCx: number;
      origCy: number;
      origR: number;
      sx: number;
      sy: number;
      saved: boolean;
    }
  | {
      kind: 'edgeTan';
      id: number;
      baseObjs: GeomObj[];
      ex: number;
      ey: number;
      origCx: number;
      origCy: number;
      sx: number;
      sy: number;
      saved: boolean;
    };

type GuideDragState = {
  id: string;
  kind: 'h' | 'v' | 'a';
  sx: number;
  sy: number;
  orig: GuideLine;
  saved: boolean;
};

function circleContactPoint(
  objs: GeomObj[],
  cx: number,
  cy: number,
  r: number,
  targetId: number,
  curveCache?: ReturnType<typeof buildCurveCache>,
  edgeIdx?: number
): { x: number; y: number } | null {
  const T = curve(objs, getObj(objs, targetId), curveCache);
  if (!T) return null;
  if (T.t === 'p') {
    const edgeL =
      edgeIdx !== undefined ? polyEdgeLine(T, edgeIdx) : nearestPolyEdge(T, cx, cy)?.line ?? null;
    if (!edgeL) return null;
    const p = projectOnCurve(edgeL, cx, cy);
    return { x: p.x, y: p.y };
  }
  if (T.t === 'l') {
    const p = projectOnCurve(T, cx, cy);
    return { x: p.x, y: p.y };
  }
  if (T.t !== 'c') return null;
  const D = Math.hypot(cx - T.x, cy - T.y);
  if (D < 1e-9) return null;
  const dExt = Math.abs(D - (r + T.r));
  const dInt1 = Math.abs(D - (r - T.r));
  const dInt2 = Math.abs(D - (T.r - r));
  if (dInt1 < dExt && dInt1 < dInt2) {
    return { x: T.x - (T.r * (cx - T.x)) / D, y: T.y - (T.r * (cy - T.y)) / D };
  }
  return { x: T.x + (T.r * (cx - T.x)) / D, y: T.y + (T.r * (cy - T.y)) / D };
}

function buildTangencyGuidelines(
  cx: number,
  cy: number,
  contacts: Array<{ x: number; y: number }>,
  edgeAnchor?: { x: number; y: number }
): Guideline[] {
  const lines: Guideline[] = [];
  for (const pt of contacts) {
    lines.push({ x1: cx, y1: cy, x2: pt.x, y2: pt.y, kind: 'normal' });
  }
  if (edgeAnchor) {
    const oppX = 2 * cx - edgeAnchor.x;
    const oppY = 2 * cy - edgeAnchor.y;
    lines.push({ x1: edgeAnchor.x, y1: edgeAnchor.y, x2: oppX, y2: oppY, kind: 'align' });
  }
  return lines;
}

function formatNumForInput(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function snapAxisCoordinate(
  objs: GeomObj[],
  inters: ReturnType<typeof allInter>,
  prio: Set<number>,
  axis: 'h' | 'v',
  coord: number,
  tol: number
): number {
  let best = coord;
  let bestD = tol;
  for (const o of objs) {
    if (o.t === 'pt' && o.ok && !o.dead && isPrioritized(prio, o.id)) {
      const val = axis === 'h' ? o.y : o.x;
      const d = Math.abs(val - coord);
      if (d <= bestD) {
        bestD = d;
        best = val;
      }
    }
  }
  for (const pt of inters) {
    const val = axis === 'h' ? pt.y : pt.x;
    const d = Math.abs(val - coord);
    if (d <= bestD) {
      bestD = d;
      best = val;
    }
  }
  return best;
}

function resolvePolyCorner(
  cx: number,
  cy: number,
  hx: number,
  hy: number,
  isFreeSnap: boolean,
  sides: number,
  sh: boolean,
  alt: boolean,
  effSnap: boolean,
  gCfg: GridConfig
): { px: number; py: number; r: number; rot: number; side: number; tag: string | null } | null {
  const dx = hx - cx;
  const dy = hy - cy;
  const rawR = Math.hypot(dx, dy);
  if (rawR <= 1e-4) return null;
  let rot = Math.atan2(dy, dx);
  if (isFreeSnap && !alt) {
    if (sh) {
      const step = Math.PI / 12;
      rot = Math.round(rot / step) * step;
    } else if (effSnap && sides === 4) {
      const step = Math.PI / 4;
      const nearest = Math.round(rot / step) * step;
      if (Math.abs(rot - nearest) < 0.22) {
        rot = nearest;
      }
    }
  }
  const rawSide = 2 * rawR * Math.sin(Math.PI / sides);
  let side = rawSide;
  let r = rawR;
  let tag: string | null = null;
  if (isFreeSnap && !alt && gCfg.sizeRule !== 'free') {
    const rule = snapSizeByRule(rawSide, gCfg);
    side = rule.snapped;
    r = side / (2 * Math.sin(Math.PI / sides));
    tag = rule.tag;
  }
  return {
    px: cx + r * Math.cos(rot),
    py: cy + r * Math.sin(rot),
    r,
    rot,
    side,
    tag,
  };
}

export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [objs, setObjs] = useState<GeomObj[]>([]);
  const [tool, setTool] = useState<ToolId>('move');
  const [lineMode, setLineMode] = useState<LineToolMode>('free');
  const [circleMode, setCircleMode] = useState<CircleToolMode>('center');
  const [pend, setPend] = useState<number[]>([]);
  const [tcSel, setTcSel] = useState<number[]>([]);
  const [tanSel, setTanSel] = useState<TanTargetSel[]>([]);
  const [hoveredTanTarget, setHoveredTanTarget] = useState<number | null>(null);
  const [tanVariantIdx, setTanVariantIdx] = useState(0);
  const [tanVariantCount, setTanVariantCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());
  const [hoveredSelTanCand, setHoveredSelTanCand] = useState<TangencyCandidate | null>(null);
  const [hoveredResizeGrip, setHoveredResizeGrip] = useState(false);
  const [dragTanOverlay, setDragTanOverlay] = useState<{
    candidates: TangencyCandidate[];
    active: TangencyCandidate | null;
  } | null>(null);
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);
  const [prio, setPrio] = useState<Set<number>>(new Set());
  const [prioMode, setPrioMode] = useState(false);
  const [backquoteDown, setBackquoteDown] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [hover, setHover] = useState<SnapResult | null>(null);
  const [ghost, setGhost] = useState<GhostPreview | null>(null);
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const [tgOn, setTgOn] = useState(false);
  const [shiftDown, setShiftDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [tanSnapEnabled, setTanSnapEnabled] = useState(true);
  const [snapPx, setSnapPx] = useState(DEFAULT_SNAP_PX);
  const [dimMode, setDimMode] = useState<DimMode>('d');
  const [svgOverlap, setSvgOverlap] = useState(true);
  const [svgExportLayers, setSvgExportLayers] = useState<SvgExportLayers>('all');
  const [hasClipboard, setHasClipboard] = useState(false);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 1200, h: 720 });
  const [refImgs, setRefImgs] = useState<RefImage[]>([]);
  const [activeRefId, setActiveRefId] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [histLen, setHistLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Rulers & Lockable Drafting Guides
  const [showRulers, setShowRulers] = useState(true);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [guidesVisible, setGuidesVisible] = useState(true);
  const [guidesLocked, setGuidesLocked] = useState(false);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [hoveredGuideKind, setHoveredGuideKind] = useState<'h' | 'v' | 'a' | null>(null);
  const [guidePreview, setGuidePreview] = useState<GuideLine | null>(null);
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);

  // Editable circle / polygon reference dimension & Work Grids
  const [editingDim, setEditingDim] = useState<{
    id: number;
    kind: 'ci' | 'pg';
    cx: number;
    cy: number;
    val: number;
  } | null>(null);
  const [dimDraft, setDimDraft] = useState('');
  const [dimError, setDimError] = useState<string | null>(null);
  const [gridConfig, setGridConfig] = useState<GridConfig>(() => ({ ...DEFAULT_GRID_CONFIG }));
  const [showGridPanel, setShowGridPanel] = useState(false);
  const [polySides, setPolySides] = useState(4);
  const [creationOrigin, setCreationOrigin] = useState<CreationOrigin>('center');

  // Phases & Shape Builder state
  const [phases, setPhases] = useState<Phase[]>(() => clonePhases(INITIAL_PHASES));
  const [activePhaseId, setActivePhaseId] = useState<string>(INITIAL_PHASES[0].id);
  const [focusMode, setFocusMode] = useState(false);
  const [crossPhaseSnap, setCrossPhaseSnap] = useState(true);
  const [shapes, setShapes] = useState<BuiltShape[]>([]);
  const [shapeMode, setShapeMode] = useState<'add' | 'sub'>('add');
  const [shapeScope, setShapeScope] = useState<'phase' | 'all'>('all');
  const [hoveredShapeRegionId, setHoveredShapeRegionId] = useState<string | null>(null);
  const [dragShapeRegionIds, setDragShapeRegionIds] = useState<Set<string>>(new Set());
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [alignPopoverOpen, setAlignPopoverOpen] = useState(false);

  const defaultPhaseId = phases[0]?.id ?? 'phase-1';
  const phaseMap = useMemo(() => {
    const m = new Map<string, Phase>();
    for (const p of phases) m.set(p.id, p);
    return m;
  }, [phases]);
  const phaseIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    phases.forEach((p, idx) => m.set(p.id, idx));
    return m;
  }, [phases]);

  const activePhase = phaseMap.get(activePhaseId) ?? phases[0];

  const visibleHitIds = useMemo(() => {
    const ids = new Set<number>();
    for (const o of objs) {
      if (o.dead) continue;
      const pid = o.phaseId ?? defaultPhaseId;
      const ph = phaseMap.get(pid);
      if (!ph || ph.showGeometry) ids.add(o.id);
    }
    return ids;
  }, [defaultPhaseId, objs, phaseMap]);

  const allowedSnapIds = useMemo(() => {
    const ids = new Set<number>();
    for (const o of objs) {
      if (o.dead) continue;
      const pid = o.phaseId ?? defaultPhaseId;
      const ph = phaseMap.get(pid);
      if (ph && !ph.showGeometry) continue;
      if (!crossPhaseSnap && pid !== activePhaseId) continue;
      ids.add(o.id);
    }
    return ids;
  }, [activePhaseId, crossPhaseSnap, defaultPhaseId, objs, phaseMap]);

  const countsByPhase = useMemo<Record<string, PhaseCounts>>(() => {
    const counts: Record<string, PhaseCounts> = {};
    for (const ph of phases) counts[ph.id] = { curves: 0, points: 0, shapes: 0 };
    for (const o of objs) {
      if (o.dead) continue;
      const pid = o.phaseId ?? defaultPhaseId;
      if (!counts[pid]) continue;
      if (o.t === 'pt') counts[pid].points++;
      else counts[pid].curves++;
    }
    for (const sh of shapes) {
      if (counts[sh.phaseId]) counts[sh.phaseId].shapes++;
    }
    return counts;
  }, [defaultPhaseId, objs, phases, shapes]);

  // O(N) curve resolution cache & deferred O(N^2) intersections while dragging
  const curveCache = useMemo(() => buildCurveCache(objs), [objs]);
  const cachedIntersRef = useRef<ReturnType<typeof allInter>>([]);
  const cachedInters = useMemo(
    () => (isDragging ? cachedIntersRef.current : allInter(objs, prio, curveCache, allowedSnapIds)),
    [allowedSnapIds, objs, prio, isDragging, curveCache]
  );

  // Planar arrangement for Shape Builder (causal: never lets later phases cut earlier phases)
  const shapeArrangement = useMemo(() => {
    if (tool !== 'shape' || isDragging) return null;
    const activeIdx = phaseIndexMap.get(activePhaseId) ?? 0;
    const curves: Curve[] = [];
    for (const o of objs) {
      if (o.dead || (o.t !== 'ln' && o.t !== 'ci' && o.t !== 'pg')) continue;
      const pid = o.phaseId ?? defaultPhaseId;
      const ph = phaseMap.get(pid);
      if (ph && !ph.showGeometry) continue;
      if (shapeScope === 'phase') {
        if (pid !== activePhaseId) continue;
      } else {
        const pidx = phaseIndexMap.get(pid) ?? 0;
        if (pidx > activeIdx) continue;
      }
      const cv = curve(objs, o, curveCache);
      if (cv) curves.push(cv);
    }
    if (curves.length === 0) return null;
    return buildPlanarArrangement(curves);
  }, [activePhaseId, curveCache, defaultPhaseId, isDragging, objs, phaseIndexMap, phaseMap, shapeScope, tool]);

  const dragShapePreviewPath = useMemo(() => {
    if (!shapeArrangement || dragShapeRegionIds.size === 0) return '';
    return shapeArrangement.buildUnionSvgPath(dragShapeRegionIds);
  }, [dragShapeRegionIds, shapeArrangement]);

  const selTanCandidates = useMemo(() => {
    if (tool !== 'move' || isDragging || edit !== null || marquee !== null || selectedIds.size !== 2) {
      return [];
    }
    const [firstId, secondId] = Array.from(selectedIds);
    return computeTangencyCandidates(objs, firstId, secondId, { curveCache });
  }, [curveCache, edit, isDragging, marquee, objs, selectedIds, tool]);

  const selectedEditInfo = useMemo<CircleEditInfo | null>(() => {
    if (tool !== 'move' || edit !== null || selectedIds.size !== 1) return null;
    const onlyId = Array.from(selectedIds)[0];
    const o = getObj(objs, onlyId);
    if (!o || o.dead || o.t !== 'ci') return null;
    return getCircleEditInfo(objs, onlyId, curveCache);
  }, [curveCache, edit, objs, selectedIds, tool]);

  const selectedConstraintInfo = useMemo(() => {
    if (tool !== 'move' || edit !== null || selectedIds.size !== 1) return null;
    const onlyId = Array.from(selectedIds)[0];
    const o = getObj(objs, onlyId);
    if (!o || o.dead || (o.t !== 'ci' && o.t !== 'ln')) return null;
    const info = getTangentConstraintInfo(objs, onlyId);
    if (info.constraintCount === 0) return null;
    return { id: onlyId, ...info };
  }, [edit, objs, selectedIds, tool]);

  // Synced refs for zero-lag pointer math
  const objsRef = useRef(objs);
  objsRef.current = objs;
  const curveCacheRef = useRef(curveCache);
  curveCacheRef.current = curveCache;
  cachedIntersRef.current = cachedInters;
  const phasesRef = useRef(phases);
  phasesRef.current = phases;
  const phaseMapRef = useRef(phaseMap);
  phaseMapRef.current = phaseMap;
  const activePhaseIdRef = useRef(activePhaseId);
  activePhaseIdRef.current = activePhaseId;
  const defaultPhaseIdRef = useRef(defaultPhaseId);
  defaultPhaseIdRef.current = defaultPhaseId;
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const shapeModeRef = useRef(shapeMode);
  shapeModeRef.current = shapeMode;
  const shapeScopeRef = useRef(shapeScope);
  shapeScopeRef.current = shapeScope;
  const shapeArrangementRef = useRef(shapeArrangement);
  shapeArrangementRef.current = shapeArrangement;
  const visibleHitIdsRef = useRef(visibleHitIds);
  visibleHitIdsRef.current = visibleHitIds;
  const allowedSnapIdsRef = useRef(allowedSnapIds);
  allowedSnapIdsRef.current = allowedSnapIds;
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const lineModeRef = useRef(lineMode);
  lineModeRef.current = lineMode;
  const circleModeRef = useRef(circleMode);
  circleModeRef.current = circleMode;
  const pendRef = useRef(pend);
  pendRef.current = pend;
  const tcSelRef = useRef(tcSel);
  tcSelRef.current = tcSel;
  const tanSelRef = useRef(tanSel);
  tanSelRef.current = tanSel;
  const tanVariantIdxRef = useRef(tanVariantIdx);
  tanVariantIdxRef.current = tanVariantIdx;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const selectedShapeIdsRef = useRef(selectedShapeIds);
  selectedShapeIdsRef.current = selectedShapeIds;
  const selTanCandidatesRef = useRef(selTanCandidates);
  selTanCandidatesRef.current = selTanCandidates;
  const selectedEditInfoRef = useRef(selectedEditInfo);
  selectedEditInfoRef.current = selectedEditInfo;
  const prioRef = useRef(prio);
  prioRef.current = prio;
  const prioModeRef = useRef(prioMode);
  prioModeRef.current = prioMode;
  const backquoteRef = useRef(backquoteDown);
  backquoteRef.current = backquoteDown;
  const editRef = useRef(edit);
  editRef.current = edit;
  const tgOnRef = useRef(tgOn);
  tgOnRef.current = tgOn;
  const snapEnabledRef = useRef(snapEnabled);
  snapEnabledRef.current = snapEnabled;
  const tanSnapEnabledRef = useRef(tanSnapEnabled);
  tanSnapEnabledRef.current = tanSnapEnabled;
  const snapPxRef = useRef(snapPx);
  snapPxRef.current = snapPx;
  const refImgsRef = useRef(refImgs);
  refImgsRef.current = refImgs;
  const activeRefIdRef = useRef(activeRefId);
  activeRefIdRef.current = activeRefId;
  const guidesRef = useRef(guides);
  guidesRef.current = guides;
  const guidesVisibleRef = useRef(guidesVisible);
  guidesVisibleRef.current = guidesVisible;
  const guidesLockedRef = useRef(guidesLocked);
  guidesLockedRef.current = guidesLocked;
  const selectedGuideIdRef = useRef(selectedGuideId);
  selectedGuideIdRef.current = selectedGuideId;
  const rulerStartRef = useRef(rulerStart);
  rulerStartRef.current = rulerStart;
  const dimModeRef = useRef(dimMode);
  dimModeRef.current = dimMode;
  const editingDimRef = useRef(editingDim);
  editingDimRef.current = editingDim;
  const gridConfigRef = useRef(gridConfig);
  gridConfigRef.current = gridConfig;
  const polySidesRef = useRef(polySides);
  polySidesRef.current = polySides;
  const creationOriginRef = useRef(creationOrigin);
  creationOriginRef.current = creationOrigin;

  const histRef = useRef<HistorySnapshot[]>([]);
  const redoRef = useRef<HistorySnapshot[]>([]);
  const copiedRef = useRef<CopiedSubgraph | null>(null);
  const copyCursorRef = useRef<[number, number] | null>(null);
  const pasteCountRef = useRef(0);
  const lastNativePasteAtRef = useRef(0);
  const lastWorldRef = useRef<[number, number]>([0, 0]);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const activeDragTanRef = useRef<TangencyCandidate | null>(null);
  const guideDragRef = useRef<GuideDragState | null>(null);
  const guideCounterRef = useRef(0);
  const phaseCounterRef = useRef(2);
  const shapeCounterRef = useRef(0);
  const groupCounterRef = useRef(0);
  const lockTimerRef = useRef<number | null>(null);
  const shapeDragRef = useRef<ShapeDragState | null>(null);
  const marqueeRef = useRef<MarqueeBox | null>(null);
  const marqueeShiftRef = useRef(false);
  const imgDragRef = useRef<ImgDragState | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<{
    clientX: number;
    clientY: number;
    shiftKey: boolean;
    altKey: boolean;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (lockTimerRef.current !== null) {
        window.clearTimeout(lockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ w: width, h: height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recompute non-destructive BuiltShapes per phase/scope (later phases NEVER cut earlier phases' shapes)
  useEffect(() => {
    if (isDragging || shapesRef.current.length === 0) return;
    const curShapes = shapesRef.current;
    const arrCache = new Map<string, ReturnType<typeof buildPlanarArrangement> | null>();

    const getArrangementFor = (phaseId: string, scope: 'phase' | 'all') => {
      const key = `${phaseId}::${scope}`;
      if (arrCache.has(key)) return arrCache.get(key) ?? null;
      const targetIdx = phaseIndexMap.get(phaseId) ?? 0;
      const groupCurves: Curve[] = [];
      for (const o of objs) {
        if (o.dead || (o.t !== 'ln' && o.t !== 'ci' && o.t !== 'pg')) continue;
        const pid = o.phaseId ?? defaultPhaseId;
        if (scope === 'phase') {
          if (pid !== phaseId) continue;
        } else {
          const pidx = phaseIndexMap.get(pid) ?? 0;
          if (pidx > targetIdx) continue;
        }
        const cv = curve(objs, o, curveCache);
        if (cv) groupCurves.push(cv);
      }
      const arr = groupCurves.length > 0 ? buildPlanarArrangement(groupCurves) : null;
      arrCache.set(key, arr);
      return arr;
    };

    let changed = false;
    const nextShapes = curShapes.map((sh) => {
      const arr = getArrangementFor(sh.phaseId, sh.scope ?? 'all');
      if (!arr) {
        if (!sh.stale) {
          changed = true;
          return { ...sh, stale: true };
        }
        return sh;
      }
      const updated = arr.recomputeShape(sh);
      if (updated.d !== sh.d || updated.stale !== sh.stale) {
        changed = true;
      }
      return updated;
    });
    if (changed) {
      setShapes(nextShapes);
    }
  }, [curveCache, defaultPhaseId, isDragging, objs, phaseIndexMap]);

  useEffect(() => {
    if (selectedIds.size === 0 || tool !== 'move') {
      setAlignPopoverOpen(false);
    }
  }, [selectedIds.size, tool]);

  const notifyNotice = useCallback((msg: string) => {
    setLockNotice(msg);
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
    }
    lockTimerRef.current = window.setTimeout(() => {
      setLockNotice(null);
      lockTimerRef.current = null;
    }, 3200);
  }, []);

  const notifyLocked = useCallback(
    (phaseId?: string) => {
      const pid = phaseId ?? activePhaseIdRef.current;
      const ph = phaseMapRef.current.get(pid);
      const name = ph ? ph.name : 'Fase atual';
      notifyNotice(`Fase "${name}" está bloqueada para edição`);
    },
    [notifyNotice]
  );

  const isPhaseLocked = useCallback((phaseId?: string): boolean => {
    const pid = phaseId ?? defaultPhaseIdRef.current;
    return phaseMapRef.current.get(pid)?.locked ?? false;
  }, []);

  const isObjLocked = useCallback(
    (curObjs: GeomObj[], id: number): boolean => {
      const o = getObj(curObjs, id);
      if (!o || o.dead) return false;
      return isPhaseLocked(o.phaseId ?? defaultPhaseIdRef.current);
    },
    [isPhaseLocked]
  );

  const syncHistoryCounts = useCallback(() => {
    setHistLen(histRef.current.length);
    setRedoLen(redoRef.current.length);
  }, []);

  const pushHistory = useCallback(
    (
      snapshotObjs: GeomObj[],
      snapshotShapes: BuiltShape[] = shapesRef.current,
      snapshotPhases: Phase[] = phasesRef.current,
      snapshotActivePhaseId: string = activePhaseIdRef.current,
      snapshotGuides: GuideLine[] = guidesRef.current
    ) => {
      const h = histRef.current;
      h.push({
        objs: cloneObjs(snapshotObjs),
        shapes: cloneShapes(snapshotShapes),
        phases: clonePhases(snapshotPhases),
        activePhaseId: snapshotActivePhaseId,
        refImgs: cloneRefImgs(refImgsRef.current),
        guides: cloneGuides(snapshotGuides),
      });
      if (h.length > 200) h.shift();
      redoRef.current = [];
      syncHistoryCounts();
    },
    [syncHistoryCounts]
  );

  const restoreSnapshot = useCallback(
    (snapShot: HistorySnapshot) => {
      const nextObjs = cloneObjs(snapShot.objs);
      recalc(nextObjs);
      setObjs(nextObjs);
      setShapes(cloneShapes(snapShot.shapes));
      setPhases(clonePhases(snapShot.phases));
      setActivePhaseId(snapShot.activePhaseId);
      setRefImgs(cloneRefImgs(snapShot.refImgs));
      setGuides(cloneGuides(snapShot.guides ?? []));
      setSelectedGuideId(null);
      setSelectedIds(new Set());
      setSelectedShapeIds(new Set());
      setHoveredSelTanCand(null);
      setHoveredResizeGrip(false);
      setDragTanOverlay(null);
      setSmartGuides([]);
      activeDragTanRef.current = null;
      setPend([]);
      setTcSel([]);
      setTanSel([]);
      setHoveredTanTarget(null);
      setTanVariantIdx(0);
      setTanVariantCount(0);
      setHoveredShapeRegionId(null);
      setDragShapeRegionIds(new Set());
      shapeDragRef.current = null;
      setEdit(null);
      setGhost(null);
      setEditingDim(null);
      setDimError(null);
      syncHistoryCounts();
    },
    [syncHistoryCounts]
  );

  const undo = useCallback(() => {
    if (!histRef.current.length) return;
    redoRef.current.push({
      objs: cloneObjs(objsRef.current),
      shapes: cloneShapes(shapesRef.current),
      phases: clonePhases(phasesRef.current),
      activePhaseId: activePhaseIdRef.current,
      refImgs: cloneRefImgs(refImgsRef.current),
      guides: cloneGuides(guidesRef.current),
    });
    restoreSnapshot(histRef.current.pop()!);
  }, [restoreSnapshot]);

  const redoF = useCallback(() => {
    if (!redoRef.current.length) return;
    histRef.current.push({
      objs: cloneObjs(objsRef.current),
      shapes: cloneShapes(shapesRef.current),
      phases: clonePhases(phasesRef.current),
      activePhaseId: activePhaseIdRef.current,
      refImgs: cloneRefImgs(refImgsRef.current),
      guides: cloneGuides(guidesRef.current),
    });
    restoreSnapshot(redoRef.current.pop()!);
  }, [restoreSnapshot]);

  const findTanTargetAt = useCallback(
    (
      curObjs: GeomObj[],
      cCache: ReturnType<typeof buildCurveCache>,
      x: number,
      y: number,
      vK: number,
      excludeIds: Set<number>
    ): number | null => {
      const vis = visibleHitIdsRef.current;
      let bestId: number | null = null;
      let bestD = 11 / vK;
      for (const o of curObjs) {
        if (
          o.dead ||
          !vis.has(o.id) ||
          excludeIds.has(o.id) ||
          (o.t !== 'ci' && o.t !== 'ln' && o.t !== 'pg')
        ) {
          continue;
        }
        const cv = curve(curObjs, o, cCache);
        if (!cv) continue;
        const d = distToCurve(cv, x, y);
        if (d < bestD) {
          bestD = d;
          bestId = o.id;
        }
      }
      if (bestId !== null) return bestId;

      let bestPtId: number | null = null;
      let bestPtD = 9 / vK;
      for (const o of curObjs) {
        if (o.dead || !vis.has(o.id) || o.t !== 'pt' || !o.ok || excludeIds.has(o.id)) continue;
        const d = Math.hypot(o.x - x, o.y - y);
        if (d < bestPtD) {
          bestPtD = d;
          bestPtId = o.id;
        }
      }
      return bestPtId;
    },
    []
  );

  const commitTanCircle = useCallback(
    (sel: TanTargetSel[], sol: MultiTanSolution) => {
      if (isPhaseLocked(activePhaseIdRef.current)) {
        notifyLocked(activePhaseIdRef.current);
        return;
      }
      const pid = activePhaseIdRef.current;
      pushHistory(objsRef.current);
      const next = cloneObjs(objsRef.current);
      const hasEdges = sol.edges && sol.edges.some((e) => e !== undefined);
      const ci = addObj(next, {
        t: 'ci',
        phaseId: pid,
        tanSet: sel.map((s) => s.id),
        ...(hasEdges ? { tanEdges: sol.edges!.map((e) => e ?? -1) } : {}),
        tanSigns: [...sol.signs],
        tanRef: { x: sol.cx, y: sol.cy, r: sol.r },
        ...(gridConfigRef.current.lockScale ? { scaleLocked: true } : {}),
      });
      for (const s of sel) {
        const targetObj = getObj(next, s.id);
        if (targetObj && (targetObj.t === 'ci' || targetObj.t === 'ln' || targetObj.t === 'pg')) {
          addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci, tg: s.id, phaseId: pid });
        }
      }
      recalc(next);
      setObjs(next);
      setTanSel([]);
      setHoveredTanTarget(null);
      setTanVariantIdx(0);
      setTanVariantCount(0);
      setGhost(null);
    },
    [isPhaseLocked, notifyLocked, pushHistory]
  );

  const toWorld = useCallback((clientX: number, clientY: number): [number, number] => {
    const el = svgRef.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    return [v.x + (clientX - r.left) / v.k, v.y + (clientY - r.top) / v.k];
  }, []);

  const computePreview = useCallback((x: number, y: number, sh: boolean, alt: boolean) => {
    lastWorldRef.current = [x, y];
    setCursorWorld({ x, y });

    const curObjs = objsRef.current;
    const cCache = curveCacheRef.current;
    const inters = cachedIntersRef.current;
    const vK = viewRef.current.k;
    const curPrio = prioRef.current;
    const curSnapPx = snapPxRef.current;
    const effSnap = snapEnabledRef.current && !alt;
    const curEdit = editRef.current;
    const curTool = toolRef.current;
    const curLineMode = lineModeRef.current;
    const curCircleMode = circleModeRef.current;
    const curPend = pendRef.current;
    const curTcSel = tcSelRef.current;
    const tgMode =
      (sh || tgOnRef.current || (curTool === 'ln' && curLineMode === 'tangent')) &&
      tanSnapEnabledRef.current;
    const activeGuides = guidesVisibleRef.current ? guidesRef.current : undefined;
    const snapIds = allowedSnapIdsRef.current;

    if (curEdit) {
      setHoveredGuideKind(null);
      setHoveredResizeGrip(false);
      const h = safeSnap(
        curObjs,
        x,
        y,
        curEdit.bad,
        vK,
        curPrio,
        curSnapPx,
        effSnap,
        inters,
        activeGuides,
        cCache,
        snapIds,
        !alt ? gridConfigRef.current : undefined
      );
      const A = { x: curEdit.ax, y: curEdit.ay };
      const tg = tgMode
        ? tanSolve(curObjs, A, x, y, curEdit.bad, vK, curPrio, curSnapPx, cCache, snapIds)
        : null;
      if (tg) {
        const contacts: Array<{ x: number; y: number }> = [];
        const c1 = circleContactPoint(curObjs, tg.cx, tg.cy, tg.r, tg.tan, cCache, tg.tanEdge);
        if (c1) contacts.push(c1);
        if (tg.tan2 !== undefined) {
          const c2 = circleContactPoint(curObjs, tg.cx, tg.cy, tg.r, tg.tan2, cCache, tg.tan2Edge);
          if (c2) contacts.push(c2);
        }
        setGhost({
          x: tg.cx,
          y: tg.cy,
          r: tg.r,
          tan: tg.tan,
          tan2: tg.tan2,
          contacts,
          guidelines: buildTangencyGuidelines(tg.cx, tg.cy, contacts, A),
          label: tg.tan2 !== undefined ? '2× Tangente' : 'Tangente',
        });
        setHover(null);
      } else {
        setGhost({
          x: (A.x + h.x) / 2,
          y: (A.y + h.y) / 2,
          r: Math.hypot(h.x - A.x, h.y - A.y) / 2,
        });
        setHover(h);
      }
      return;
    }

    if (curTool === 'shape') {
      setHoveredGuideKind(null);
      setHoveredSelTanCand(null);
      setHoveredResizeGrip(false);
      setHoveredTanTarget(null);
      setHover(null);
      setGhost(null);
      const arr = shapeArrangementRef.current;
      const hit = arr ? arr.hitRegion(x, y) : null;
      setHoveredShapeRegionId(hit ? hit.id : null);
      return;
    }

    setHoveredShapeRegionId(null);

    if (curTool !== 'move' && curTool !== 'del') {
      setHoveredGuideKind(null);
      setHoveredSelTanCand(null);
      setHoveredResizeGrip(false);

      if (curTool === 'ci' && curCircleMode === 'tangent') {
        const curTan = tanSelRef.current;
        const exclude = new Set(curTan.map((s) => s.id));
        const hitId = curTan.length < 4 ? findTanTargetAt(curObjs, cCache, x, y, vK, exclude) : null;
        setHoveredTanTarget(hitId);

        if (curTan.length >= 2) {
          const sols = solveMultiTangent(curObjs, curTan, x, y, cCache);
          setTanVariantCount(sols.length);
          if (sols.length > 0) {
            const sol = sols[tanVariantIdxRef.current % sols.length];
            const label =
              curTan.length === 2
                ? '2× Tangente'
                : curTan.length === 3
                  ? '3× Tangente (Apolônio)'
                  : sol.exact
                    ? '4× Tangente'
                    : `4× Tangente (~${sol.maxError.toFixed(1)}px)`;
            setGhost({
              x: sol.cx,
              y: sol.cy,
              r: sol.r,
              tanTargets: curTan.map((s) => s.id),
              contacts: sol.contacts,
              guidelines: buildTangencyGuidelines(sol.cx, sol.cy, sol.contacts),
              label,
            });
          } else {
            setGhost(null);
          }
        } else {
          setTanVariantCount(0);
          setGhost(null);
        }
        setHover(null);
        return;
      }

      setHoveredTanTarget(null);
      const gCfg = gridConfigRef.current;
      const h = snap(
        curObjs,
        x,
        y,
        vK,
        curPrio,
        curSnapPx,
        effSnap,
        inters,
        activeGuides,
        cCache,
        snapIds,
        !alt ? gCfg : undefined
      );

      let nextGhost: GhostPreview | null = null;
      let nextHover: SnapResult | null = h;
      const originMode = creationOriginRef.current;

      if (curTool === 'ln' && curLineMode === 'common' && curTcSel.length === 2) {
        const g = commonTanFor(curObjs, curTcSel[0], curTcSel[1], x, y, cCache);
        if (g) nextGhost = { ln: g.line, label: 'Tangente comum' };
      } else if (curTool === 'ln' && curLineMode !== 'common' && curPend.length === 1) {
        const tg = tgMode
          ? tangentLineFor(curObjs, curPend[0], x, y, vK, curPrio, curSnapPx, cCache, snapIds)
          : null;
        if (tg) {
          const targetCurve = curve(curObjs, getObj(curObjs, tg.to), cCache);
          const guidelines: Guideline[] =
            targetCurve && targetCurve.t === 'c'
              ? [{ x1: targetCurve.x, y1: targetCurve.y, x2: tg.contact.x, y2: tg.contact.y, kind: 'normal' }]
              : targetCurve && targetCurve.t === 'p'
                ? [{ x1: targetCurve.cx, y1: targetCurve.cy, x2: tg.contact.x, y2: tg.contact.y, kind: 'normal' }]
                : [];
          nextGhost = {
            ln: tg.line,
            tan: tg.to,
            contacts: [tg.contact],
            guidelines,
            label: tg.polyVertexIdx !== undefined ? 'Tangente ao vértice' : 'Tangente',
          };
          nextHover = null;
        } else {
          const a = getObj(curObjs, curPend[0]);
          if (a && a.t === 'pt' && a.ok) {
            const dx = h.x - a.x;
            const dy = h.y - a.y;
            if (Math.hypot(dx, dy) > 1e-6) {
              nextGhost = { ln: { t: 'l', x: a.x, y: a.y, dx, dy } };
            }
          }
        }
      } else if (curTool === 'ci' && curCircleMode === 'diameter' && curPend.length === 1) {
        const A = getObj(curObjs, curPend[0]);
        if (A && A.t === 'pt' && A.ok) {
          const tg = tgMode
            ? tanSolve(curObjs, A, x, y, new Set(), vK, curPrio, curSnapPx, cCache, snapIds)
            : null;
          if (tg) {
            const contacts: Array<{ x: number; y: number }> = [];
            const c1 = circleContactPoint(curObjs, tg.cx, tg.cy, tg.r, tg.tan, cCache, tg.tanEdge);
            if (c1) contacts.push(c1);
            if (tg.tan2 !== undefined) {
              const c2 = circleContactPoint(curObjs, tg.cx, tg.cy, tg.r, tg.tan2, cCache, tg.tan2Edge);
              if (c2) contacts.push(c2);
            }
            nextGhost = {
              x: tg.cx,
              y: tg.cy,
              r: tg.r,
              tan: tg.tan,
              tan2: tg.tan2,
              contacts,
              guidelines: buildTangencyGuidelines(tg.cx, tg.cy, contacts, A),
              label: tg.tan2 !== undefined ? '2× Tangente' : 'Tangente',
            };
            nextHover = null;
          } else {
            const rawD = Math.hypot(h.x - A.x, h.y - A.y);
            if (!alt && gCfg.sizeRule !== 'free' && h.k === 'free' && !h.guideTag && rawD > 1e-3) {
              const rule = snapSizeByRule(rawD, gCfg);
              const ang = Math.atan2(h.y - A.y, h.x - A.x);
              const bx = A.x + rule.snapped * Math.cos(ang);
              const by = A.y + rule.snapped * Math.sin(ang);
              nextGhost = {
                x: (A.x + bx) / 2,
                y: (A.y + by) / 2,
                r: rule.snapped / 2,
                label: rule.tag ? `${rule.tag} · Ø ${formatNumForInput(rule.snapped)}` : undefined,
              };
              nextHover = { ...h, x: bx, y: by };
            } else {
              nextGhost = {
                x: (A.x + h.x) / 2,
                y: (A.y + h.y) / 2,
                r: rawD / 2,
              };
            }
          }
        }
      } else if (
        curTool === 'ci' &&
        (curCircleMode === 'center' || curCircleMode === 'top-left') &&
        curPend.length === 1
      ) {
        const c = getObj(curObjs, curPend[0]);
        if (c && c.t === 'pt' && c.ok) {
          if (curCircleMode === 'top-left' || originMode === 'top-left') {
            const dx = h.x - c.x;
            const dy = h.y - c.y;
            const sx = dx >= 0 ? 1 : -1;
            const sy = dy >= 0 ? 1 : -1;
            const rawD = Math.max(Math.abs(dx), Math.abs(dy));
            if (rawD > 1e-3) {
              let d = rawD;
              let tag: string | null = null;
              if (!alt && gCfg.sizeRule !== 'free' && h.k === 'free' && !h.guideTag) {
                const rule = snapSizeByRule(rawD, gCfg);
                d = rule.snapped;
                tag = rule.tag;
              }
              const r = d / 2;
              const cx = c.x + sx * r;
              const cy = c.y + sy * r;
              const bx = c.x + sx * d;
              const by = c.y + sy * d;
              nextGhost = {
                x: cx,
                y: cy,
                r,
                box: { x: Math.min(c.x, bx), y: Math.min(c.y, by), w: d, h: d },
                label: tag ? `${tag} · Ø ${formatNumForInput(d)}` : `Ø ${formatNumForInput(d)}`,
              };
              if (h.k === 'free' && !h.guideTag) {
                nextHover = { ...h, x: bx, y: by };
              }
            }
          } else {
            const tg = tgMode
              ? tangentFor(curObjs, curPend[0], x, y, vK, curPrio, curSnapPx, cCache, snapIds)
              : null;
            if (tg) {
              const contact = circleContactPoint(curObjs, c.x, c.y, tg.r, tg.tan, cCache, tg.tanEdge);
              const contacts = contact ? [contact] : [];
              nextGhost = {
                x: c.x,
                y: c.y,
                r: tg.r,
                tan: tg.tan,
                contacts,
                guidelines: buildTangencyGuidelines(c.x, c.y, contacts),
                label: 'Tangente',
              };
              nextHover = null;
            } else {
              const rawR = Math.hypot(h.x - c.x, h.y - c.y);
              if (!alt && gCfg.sizeRule !== 'free' && h.k === 'free' && !h.guideTag && rawR > 1e-3) {
                const rule = snapSizeByRule(rawR * 2, gCfg);
                const snappedR = rule.snapped / 2;
                const ang = Math.atan2(h.y - c.y, h.x - c.x);
                nextGhost = {
                  x: c.x,
                  y: c.y,
                  r: snappedR,
                  label: rule.tag ? `${rule.tag} · Ø ${formatNumForInput(rule.snapped)}` : undefined,
                };
                nextHover = { ...h, x: c.x + snappedR * Math.cos(ang), y: c.y + snappedR * Math.sin(ang) };
              } else {
                nextGhost = { x: c.x, y: c.y, r: rawR };
              }
            }
          }
        }
      } else if (curTool === 'pg' && curPend.length === 1) {
        const c = getObj(curObjs, curPend[0]);
        if (c && c.t === 'pt' && c.ok) {
          const sides = Math.max(3, polySidesRef.current);
          if (originMode === 'top-left') {
            const dx = h.x - c.x;
            const dy = h.y - c.y;
            const sx = dx >= 0 ? 1 : -1;
            const sy = dy >= 0 ? 1 : -1;
            const rawBox = Math.max(Math.abs(dx), Math.abs(dy));
            if (rawBox > 1e-3) {
              let boxSide = rawBox;
              let tag: string | null = null;
              if (!alt && gCfg.sizeRule !== 'free' && h.k === 'free' && !h.guideTag) {
                const rule = snapSizeByRule(rawBox, gCfg);
                boxSide = rule.snapped;
                tag = rule.tag;
              }
              const cx = c.x + sx * (boxSide / 2);
              const cy = c.y + sy * (boxSide / 2);
              const bx = c.x + sx * boxSide;
              const by = c.y + sy * boxSide;
              const rot = sides === 4 ? Math.PI / 4 : -Math.PI / 2;
              const r = sides === 4 ? boxSide / Math.SQRT2 : boxSide / 2;
              const polySide = 2 * r * Math.sin(Math.PI / sides);
              const verts: Array<{ x: number; y: number }> = [];
              const stepA = (Math.PI * 2) / sides;
              for (let i = 0; i < sides; i++) {
                const a = rot + i * stepA;
                verts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
              }
              nextGhost = {
                pg: {
                  t: 'p',
                  cx,
                  cy,
                  r,
                  rot,
                  sides,
                  side: polySide,
                  verts,
                },
                box: { x: Math.min(c.x, bx), y: Math.min(c.y, by), w: boxSide, h: boxSide },
                label: tag
                  ? `${tag} · L ${formatNumForInput(polySide)}`
                  : `L ${formatNumForInput(polySide)}`,
              };
              if (h.k === 'free' && !h.guideTag) {
                nextHover = { ...h, x: bx, y: by };
              }
            }
          } else {
            const polySnap = resolvePolyCorner(
              c.x,
              c.y,
              h.x,
              h.y,
              h.k === 'free' && !h.guideTag,
              sides,
              sh,
              alt,
              effSnap,
              gCfg
            );
            if (polySnap) {
              const verts: Array<{ x: number; y: number }> = [];
              const stepA = (Math.PI * 2) / sides;
              for (let i = 0; i < sides; i++) {
                const a = polySnap.rot + i * stepA;
                verts.push({ x: c.x + polySnap.r * Math.cos(a), y: c.y + polySnap.r * Math.sin(a) });
              }
              nextGhost = {
                pg: {
                  t: 'p',
                  cx: c.x,
                  cy: c.y,
                  r: polySnap.r,
                  rot: polySnap.rot,
                  sides,
                  side: polySnap.side,
                  verts,
                },
                label: polySnap.tag
                  ? `${polySnap.tag} · L ${formatNumForInput(polySnap.side)}`
                  : `L ${formatNumForInput(polySnap.side)}`,
              };
              if (h.k === 'free' && !h.guideTag) {
                nextHover = { ...h, x: polySnap.px, y: polySnap.py };
              }
            }
          }
        }
      }

      setHover(nextHover);
      setGhost(nextGhost);
      return;
    }

    // Check hover over temporary rim resize handle for circles without a free blue edge point
    let overResizeGrip = false;
    if (
      curTool === 'move' &&
      selectedEditInfoRef.current?.resizeHandle &&
      !selectedEditInfoRef.current.resizeHandle.hasFreeEdgePt
    ) {
      const rh = selectedEditInfoRef.current.resizeHandle;
      overResizeGrip = Math.hypot(rh.x - x, rh.y - y) <= 12 / vK;
    }
    setHoveredResizeGrip(overResizeGrip);

    // Check hover over clickable purple candidate tangency points in Mover mode (ordered selection 1º -> 2º)
    if (curTool === 'move' && selTanCandidatesRef.current.length > 0) {
      let bestCand: TangencyCandidate | null = null;
      let bestCD = 13 / vK;
      for (const cand of selTanCandidatesRef.current) {
        const d = Math.hypot(cand.contact.x - x, cand.contact.y - y);
        if (d <= bestCD) {
          bestCD = d;
          bestCand = cand;
        }
      }
      setHoveredSelTanCand(bestCand);
    } else {
      setHoveredSelTanCand(null);
    }

    // In move mode, highlight unlocked guide cursor when hovering a guide directly
    if (
      curTool === 'move' &&
      !overResizeGrip &&
      !guidesLockedRef.current &&
      activeGuides &&
      activeGuides.length > 0
    ) {
      const hitPt = curObjs.some(
        (o) => o.t === 'pt' && o.ok && !o.dead && Math.hypot(o.x - x, o.y - y) <= Math.max(10, curSnapPx) / vK
      );
      const hitCurve =
        !hitPt &&
        curObjs.some((o) => {
          if (o.dead || (o.t !== 'ln' && o.t !== 'ci' && o.t !== 'pg')) return false;
          const cv = curve(curObjs, o, cCache);
          return cv ? distToCurve(cv, x, y) <= 9 / vK : false;
        });

      if (!hitPt && !hitCurve) {
        let bestG: GuideLine | null = null;
        let bestGD = 7 / vK;
        for (const g of activeGuides) {
          const d = distToGuide(g, x, y);
          if (d <= bestGD) {
            bestGD = d;
            bestG = g;
          }
        }
        setHoveredGuideKind(bestG ? bestG.kind : null);
      } else {
        setHoveredGuideKind(null);
      }
    } else {
      setHoveredGuideKind(null);
    }

    setHover(null);
    setGhost(null);
  }, []);

  const imgDown = useCallback((x: number, y: number): boolean => {
    const imgs = refImgsRef.current;
    for (let i = imgs.length - 1; i >= 0; i--) {
      const r = imgs[i];
      if (r.locked) continue;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const a = (-(r.r || 0) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      const hr = 12 / viewRef.current.k;
      const hw = r.w / 2;
      const hh = r.h / 2;

      if (Math.hypot(lx, ly + hh + 30 / viewRef.current.k) < hr) {
        setActiveRefId(r.id);
        imgDragRef.current = { id: r.id, m: 'rot' };
        return true;
      }
      let hitHandle = false;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        if (Math.hypot(lx - sx * hw, ly - sy * hh) < hr) {
          setActiveRefId(r.id);
          imgDragRef.current = { id: r.id, m: 'sc', d0: Math.hypot(dx, dy), w0: r.w, h0: r.h, cx, cy };
          hitHandle = true;
          break;
        }
      }
      if (hitHandle) return true;

      if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
        setActiveRefId(r.id);
        imgDragRef.current = { id: r.id, m: 'mv', sx: x, sy: y, x0: r.x, y0: r.y };
        return true;
      }
    }
    return false;
  }, []);

  const commitEdit = useCallback(
    (x: number, y: number, sh: boolean, alt: boolean) => {
      const E = editRef.current;
      if (!E) return;
      const curObjs = objsRef.current;
      if (isObjLocked(curObjs, E.id)) {
        const eo = getObj(curObjs, E.id);
        notifyLocked(eo?.phaseId);
        setEdit(null);
        setGhost(null);
        return;
      }
      const vK = viewRef.current.k;
      const curPrio = prioRef.current;
      const curSnapPx = snapPxRef.current;
      const effSnap = snapEnabledRef.current && !alt;
      const activeGuides = guidesVisibleRef.current ? guidesRef.current : undefined;
      const cCache = curveCacheRef.current;
      const snapIds = allowedSnapIdsRef.current;
      const A = { x: E.ax, y: E.ay };
      const tg =
        tanSnapEnabledRef.current && sh
          ? tanSolve(curObjs, A, x, y, E.bad, vK, curPrio, curSnapPx, cCache, snapIds)
          : null;
      let sb: SnapResult | null = null;
      if (!tg) {
        sb = safeSnap(
          curObjs,
          x,
          y,
          E.bad,
          vK,
          curPrio,
          curSnapPx,
          effSnap,
          cachedIntersRef.current,
          activeGuides,
          cCache,
          snapIds,
          !alt ? gridConfigRef.current : undefined
        );
        if (Math.hypot(sb.x - A.x, sb.y - A.y) < 1e-6) return;
      }

      const editObj = getObj(curObjs, E.id);
      const pid = editObj?.phaseId ?? activePhaseIdRef.current;
      pushHistory(curObjs);
      const next = cloneObjs(curObjs);
      const aid = commitSnap(next, E.sn, pid);
      const fields = tg ? { e: aid, ...tanFields(tg) } : { d1: aid, d2: commitSnap(next, sb!, pid) };
      const o = next[E.id];
      if (o && o.t === 'ci') {
        for (const k of [
          'c',
          'p',
          'tan',
          'tanEdge',
          'm',
          'e',
          'ang',
          'sg',
          'tan2',
          'tan2Edge',
          'sg2',
          'kk',
          'd1',
          'd2',
        ] as const) {
          delete o[k];
        }
        Object.assign(o, fields);
      }
      for (const q of next) {
        if (q.t === 'pt' && q.tp && q.ci === E.id && !q.dead) {
          killObj(next, q.id);
        }
      }
      if (tg) {
        for (const t of tanIds(tg)) {
          addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: E.id, tg: t, phaseId: pid });
        }
      }
      recalc(next);
      setObjs(next);
      setEdit(null);
      setGhost(null);
    },
    [isObjLocked, notifyLocked, pushHistory]
  );

  const togglePrioAt = useCallback((x: number, y: number): boolean => {
    const curObjs = objsRef.current;
    const vis = visibleHitIdsRef.current;
    const vK = viewRef.current.k;
    let id: number | null = null;
    const p = curObjs.find(
      (o): o is PointObj =>
        o.t === 'pt' && !!o.ok && !o.dead && vis.has(o.id) && Math.hypot(o.x - x, o.y - y) < 9 / vK
    );
    if (p) {
      id = p.id;
    } else {
      let bestD = 9 / vK;
      const cCache = curveCacheRef.current;
      for (const o of curObjs) {
        if (o.dead || !vis.has(o.id) || (o.t !== 'ln' && o.t !== 'ci' && o.t !== 'pg')) continue;
        const cv = curve(curObjs, o, cCache);
        if (!cv) continue;
        const d = distToCurve(cv, x, y);
        if (d < bestD) {
          bestD = d;
          id = o.id;
        }
      }
    }
    if (id !== null) {
      setPrio((prev) => {
        const next = new Set(prev);
        if (next.has(id!)) next.delete(id!);
        else next.add(id!);
        return next;
      });
      return true;
    }
    return false;
  }, []);

  const copySelected = useCallback(() => {
    const sub = buildCopySubgraph(objsRef.current, selectedIdsRef.current);
    if (!sub) return;
    copiedRef.current = sub;
    copyCursorRef.current = [...lastWorldRef.current];
    pasteCountRef.current = 0;
    setHasClipboard(true);
    try {
      void navigator.clipboard?.writeText(`compasso-geom:${JSON.stringify(sub)}`).catch(() => {});
    } catch {
      // ignore clipboard permissions inside restricted frames
    }
  }, []);

  const pasteClipboard = useCallback(
    (forceOffset: boolean = false) => {
      const sub = copiedRef.current;
      if (!sub) return;
      if (isPhaseLocked(activePhaseIdRef.current)) {
        notifyLocked(activePhaseIdRef.current);
        return;
      }
      const vK = viewRef.current.k;
      const step = 28 / vK;
      pasteCountRef.current += 1;

      let dx = step * pasteCountRef.current;
      let dy = step * pasteCountRef.current;

      if (!forceOffset && copyCursorRef.current) {
        const [lx, ly] = lastWorldRef.current;
        const [cx, cy] = copyCursorRef.current;
        if (Math.hypot(lx - cx, ly - cy) > 12 / vK) {
          dx = lx - sub.anchor.x + (pasteCountRef.current - 1) * step;
          dy = ly - sub.anchor.y + (pasteCountRef.current - 1) * step;
        }
      }

      pushHistory(objsRef.current);
      const { next, pastedIds } = pasteSubgraph(objsRef.current, sub, dx, dy, activePhaseIdRef.current);
      setObjs(next);
      setSelectedIds(new Set(pastedIds));
      setTool('move');
    },
    [isPhaseLocked, notifyLocked, pushHistory]
  );

  const duplicateSelected = useCallback(() => {
    if (isPhaseLocked(activePhaseIdRef.current)) {
      notifyLocked(activePhaseIdRef.current);
      return;
    }
    const sub = buildCopySubgraph(objsRef.current, selectedIdsRef.current);
    if (!sub) return;
    const step = 28 / viewRef.current.k;
    pushHistory(objsRef.current);
    const { next, pastedIds } = pasteSubgraph(objsRef.current, sub, step, step, activePhaseIdRef.current);
    setObjs(next);
    setSelectedIds(new Set(pastedIds));
  }, [isPhaseLocked, notifyLocked, pushHistory]);

  const deleteSelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (ids.size === 0) return;
    const curObjs = objsRef.current;
    const unlockedIds: number[] = [];
    let blockedPhaseId: string | undefined;
    for (const id of ids) {
      const o = getObj(curObjs, id);
      if (!o || o.dead) continue;
      if (isObjLocked(curObjs, id)) {
        blockedPhaseId = o.phaseId ?? defaultPhaseIdRef.current;
      } else {
        unlockedIds.push(id);
      }
    }
    if (unlockedIds.length === 0) {
      if (blockedPhaseId) notifyLocked(blockedPhaseId);
      return;
    }
    pushHistory(curObjs);
    const next = cloneObjs(curObjs);
    for (const id of unlockedIds) {
      killObj(next, id);
    }
    setObjs(next);
    setSelectedIds(new Set());
  }, [isObjLocked, notifyLocked, pushHistory]);

  const handleAlignSelection = useCallback(
    (mode: AlignMode) => {
      const curObjs = objsRef.current;
      const sel = selectedIdsRef.current;
      if (sel.size === 0) return;
      const res = alignObjects(curObjs, sel, mode, (list, id) => isObjLocked(list, id));
      if (!res.ok || !res.next) {
        const anyUnlocked = Array.from(sel).some((id) => !isObjLocked(curObjs, id));
        if (!anyUnlocked) notifyLocked();
        return;
      }
      pushHistory(curObjs);
      setObjs(res.next);
    },
    [isObjLocked, notifyLocked, pushHistory]
  );

  const handleDistributeSelection = useCallback(
    (axis: DistributeAxis) => {
      const curObjs = objsRef.current;
      const sel = selectedIdsRef.current;
      if (sel.size === 0) return;
      const res = distributeObjects(curObjs, sel, axis, (list, id) => isObjLocked(list, id));
      if (!res.ok || !res.next) {
        const anyUnlocked = Array.from(sel).some((id) => !isObjLocked(curObjs, id));
        if (!anyUnlocked) notifyLocked();
        return;
      }
      pushHistory(curObjs);
      setObjs(res.next);
    },
    [isObjLocked, notifyLocked, pushHistory]
  );

  const handleGroupSelection = useCallback(() => {
    const curObjs = objsRef.current;
    const sel = selectedIdsRef.current;
    if (sel.size < 2) return;
    const gid = `grp-${Date.now()}-${++groupCounterRef.current}`;
    const res = groupObjects(curObjs, sel, gid);
    if (!res.ok || !res.next) return;
    pushHistory(curObjs);
    setObjs(res.next);
  }, [pushHistory]);

  const handleUngroupSelection = useCallback(() => {
    const curObjs = objsRef.current;
    const sel = selectedIdsRef.current;
    if (sel.size === 0) return;
    const res = ungroupObjects(curObjs, sel);
    if (!res.ok || !res.next) return;
    pushHistory(curObjs);
    setObjs(res.next);
  }, [pushHistory]);

  const handleCombineSelectedShapes = useCallback(
    (op: CombineShapeOp) => {
      const pid = activePhaseIdRef.current;
      if (isPhaseLocked(pid)) {
        notifyLocked(pid);
        return;
      }
      const curObjs = objsRef.current;
      const cCache = curveCacheRef.current;
      const curvesInOrder: Array<CircleCurve | PolyCurve> = [];
      for (const id of selectedIdsRef.current) {
        const o = getObj(curObjs, id);
        if (!o || o.dead || (o.t !== 'ci' && o.t !== 'pg')) continue;
        const cv = curve(curObjs, o, cCache);
        if (cv && (cv.t === 'c' || cv.t === 'p')) curvesInOrder.push(cv);
      }
      if (curvesInOrder.length < 2) return;
      const nextShape = combineClosedCurvesAsShape(
        curvesInOrder,
        op,
        pid,
        `sh-${++shapeCounterRef.current}`,
        shapeScopeRef.current
      );
      if (!nextShape) {
        notifyNotice('A combinação escolhida não gerou área resultante.');
        return;
      }
      pushHistory(curObjs);
      setShapes((prev) => [...prev, nextShape]);
      setAlignPopoverOpen(false);
    },
    [isPhaseLocked, notifyLocked, notifyNotice, pushHistory]
  );

  const handleToggleScaleLockSelection = useCallback(() => {
    const curObjs = objsRef.current;
    const sel = selectedIdsRef.current;
    if (sel.size === 0) return;
    const targets: number[] = [];
    let anyPhaseLocked = false;
    for (const id of sel) {
      const o = getObj(curObjs, id);
      if (!o || o.dead || (o.t !== 'ci' && o.t !== 'pg')) continue;
      if (isObjLocked(curObjs, o.id)) {
        anyPhaseLocked = true;
        continue;
      }
      targets.push(o.id);
    }
    if (targets.length === 0) {
      if (anyPhaseLocked) notifyLocked();
      return;
    }
    const allLocked = targets.every((id) => {
      const o = getObj(curObjs, id);
      return !!(o && (o.t === 'ci' || o.t === 'pg') && o.scaleLocked);
    });
    const nextLocked = !allLocked;
    pushHistory(curObjs);
    const next = cloneObjs(curObjs);
    for (const id of targets) {
      const o = getObj(next, id);
      if (!o || (o.t !== 'ci' && o.t !== 'pg')) continue;
      if (nextLocked) o.scaleLocked = true;
      else delete o.scaleLocked;
    }
    setObjs(next);
  }, [isObjLocked, notifyLocked, pushHistory]);

  const handleMirrorSelection = useCallback(
    (axis: MirrorAxis) => {
      const pid = activePhaseIdRef.current;
      if (isPhaseLocked(pid)) {
        notifyLocked(pid);
        return;
      }
      const curObjs = objsRef.current;
      const res = mirrorObjects(curObjs, selectedIdsRef.current, axis, pid);
      if (!res.ok || !res.next) return;
      pushHistory(curObjs);
      setObjs(res.next);
      if (res.createdIds && res.createdIds.length > 0) {
        setSelectedIds(new Set(res.createdIds));
      }
    },
    [isPhaseLocked, notifyLocked, pushHistory]
  );

  const handleRadialArraySelection = useCallback(
    (count: number) => {
      const pid = activePhaseIdRef.current;
      if (isPhaseLocked(pid)) {
        notifyLocked(pid);
        return;
      }
      const curObjs = objsRef.current;
      const sel = selectedIdsRef.current;
      const bounds = getSelectionBoundingBox(curObjs, sel);
      if (!bounds) return;

      const gCfg = gridConfigRef.current;
      let pivot = { x: bounds.cx, y: bounds.cy };
      if (gCfg.enabled && Math.hypot(gCfg.originX - bounds.cx, gCfg.originY - bounds.cy) > 2) {
        pivot = { x: gCfg.originX, y: gCfg.originY };
      } else if (getAlignUnitCount(curObjs, sel) === 1 && sel.size === 1) {
        const only = getObj(curObjs, Array.from(sel)[0]);
        if (only && (only.t === 'ci' || only.t === 'pg')) {
          pivot = { x: bounds.cx, y: bounds.maxY };
        }
      }

      const res = radialArrayObjects(curObjs, sel, count, pivot, pid);
      if (!res.ok || !res.next) return;
      pushHistory(curObjs);
      setObjs(res.next);
      if (res.createdIds && res.createdIds.length > 0) {
        setSelectedIds(new Set([...sel, ...res.createdIds]));
      }
    },
    [isPhaseLocked, notifyLocked, pushHistory]
  );

  const handleDeleteSelectedShapes = useCallback(() => {
    const sel = selectedShapeIdsRef.current;
    if (sel.size === 0) return;
    const unlockedIds = new Set<string>();
    let blockedPhaseId: string | undefined;
    for (const sh of shapesRef.current) {
      if (!sel.has(sh.id)) continue;
      if (isPhaseLocked(sh.phaseId)) {
        blockedPhaseId = sh.phaseId;
      } else {
        unlockedIds.add(sh.id);
      }
    }
    if (unlockedIds.size === 0) {
      if (blockedPhaseId) notifyLocked(blockedPhaseId);
      return;
    }
    pushHistory(objsRef.current);
    setShapes((prev) => prev.filter((s) => !unlockedIds.has(s.id)));
    setSelectedShapeIds(new Set());
  }, [isPhaseLocked, notifyLocked, pushHistory]);

  const handleMoveSelectedShapesToPhase = useCallback(
    (targetPhaseId: string) => {
      const sel = selectedShapeIdsRef.current;
      if (sel.size === 0) return;
      if (isPhaseLocked(targetPhaseId)) {
        notifyLocked(targetPhaseId);
        return;
      }
      const unlockedIds = new Set<string>();
      let blockedPhaseId: string | undefined;
      for (const sh of shapesRef.current) {
        if (!sel.has(sh.id)) continue;
        if (isPhaseLocked(sh.phaseId)) {
          blockedPhaseId = sh.phaseId;
        } else {
          unlockedIds.add(sh.id);
        }
      }
      if (unlockedIds.size === 0) {
        if (blockedPhaseId) notifyLocked(blockedPhaseId);
        return;
      }
      pushHistory(objsRef.current);
      setShapes((prev) =>
        prev.map((s) => (unlockedIds.has(s.id) ? { ...s, phaseId: targetPhaseId } : s))
      );
      setActivePhaseId(targetPhaseId);
    },
    [isPhaseLocked, notifyLocked, pushHistory]
  );

  const handleOpenDimEditor = useCallback(
    (id: number, kind: 'ci' | 'pg', cx: number, cy: number, val: number) => {
      if (isObjLocked(objsRef.current, id)) {
        const co = getObj(objsRef.current, id);
        notifyLocked(co?.phaseId);
        return;
      }
      const co = getObj(objsRef.current, id);
      if (co && (co.t === 'ci' || co.t === 'pg') && co.scaleLocked) {
        notifyNotice('Escala travada — desbloqueie para alterar o tamanho.');
        return;
      }
      const displayVal = kind === 'ci' ? (dimModeRef.current === 'r' ? val : val * 2) : val;
      setEditingDim({ id, kind, cx, cy, val });
      setDimDraft(formatNumForInput(displayVal));
      setDimError(null);
      setSelectedIds(new Set([id]));
      setEdit(null);
      setPend([]);
      setTcSel([]);
      setGhost(null);
    },
    [isObjLocked, notifyLocked, notifyNotice]
  );

  const handleCommitDimEdit = useCallback(
    (overrideVal?: number) => {
      const ed = editingDimRef.current;
      if (!ed) return;
      if (isObjLocked(objsRef.current, ed.id)) {
        const co = getObj(objsRef.current, ed.id);
        notifyLocked(co?.phaseId);
        setEditingDim(null);
        return;
      }
      const parsed =
        overrideVal !== undefined ? overrideVal : Number(dimDraft.trim().replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setDimError('Digite um valor numérico maior que zero.');
        return;
      }
      if (ed.kind === 'pg') {
        const res = setPolygonSide(objsRef.current, ed.id, parsed);
        if (!res.ok || !res.next) {
          setDimError(res.reason ?? 'Não foi possível ajustar esse lado.');
          return;
        }
        pushHistory(objsRef.current);
        setObjs(res.next);
        setEditingDim(null);
        setDimError(null);
        return;
      }
      const newR = dimModeRef.current === 'r' ? parsed : parsed / 2;
      const res = setCircleRadius(objsRef.current, ed.id, newR);
      if (!res.ok || !res.next) {
        setDimError(res.reason ?? 'Não foi possível ajustar esse raio.');
        return;
      }
      pushHistory(objsRef.current);
      setObjs(res.next);
      setEditingDim(null);
      setDimError(null);
    },
    [dimDraft, isObjLocked, notifyLocked, pushHistory]
  );

  const handleCancelDimEdit = useCallback(() => {
    setEditingDim(null);
    setDimError(null);
  }, []);

  const handleStartRulerGuide = useCallback((kind: 'h' | 'v', e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    let latestPreview: GuideLine | null = null;

    const updateFromEvent = (ev: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const v = viewRef.current;
      const wx = v.x + (ev.clientX - rect.left) / v.k;
      const wy = v.y + (ev.clientY - rect.top) / v.k;
      setCursorWorld({ x: wx, y: wy });

      const inside =
        kind === 'h'
          ? ev.clientY >= rect.top && ev.clientY <= rect.bottom
          : ev.clientX >= rect.left && ev.clientX <= rect.right;

      if (!inside) {
        latestPreview = null;
        setGuidePreview(null);
        return;
      }

      const rawCoord = kind === 'h' ? wy : wx;
      const coord =
        snapEnabledRef.current && !ev.altKey
          ? snapAxisCoordinate(
              objsRef.current,
              cachedIntersRef.current,
              prioRef.current,
              kind,
              rawCoord,
              snapPxRef.current / v.k
            )
          : rawCoord;

      latestPreview =
        kind === 'h' ? { id: 'preview', kind: 'h', y: coord } : { id: 'preview', kind: 'v', x: coord };
      setGuidePreview(latestPreview);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', updateFromEvent);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setGuidePreview(null);
      if (latestPreview) {
        const id = `g-${++guideCounterRef.current}`;
        const committed: GuideLine =
          latestPreview.kind === 'h'
            ? { id, kind: 'h', y: latestPreview.y }
            : latestPreview.kind === 'v'
              ? { id, kind: 'v', x: latestPreview.x }
              : { ...latestPreview, id };
        pushHistory(objsRef.current);
        setGuides((prev) => [...prev, committed]);
        setGuidesVisible(true);
        setSelectedGuideId(id);
      }
    };

    window.addEventListener('pointermove', updateFromEvent);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [pushHistory]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const [x, y] = toWorld(e.clientX, e.clientY);

      if (editingDimRef.current) {
        setEditingDim(null);
        setDimError(null);
      }

      // Right-click in move mode toggles priority cleanly without browser interference
      if (e.button === 2) {
        if (toolRef.current === 'move') {
          togglePrioAt(x, y);
        }
        return;
      }

      if (e.button > 1) return;
      if (e.button === 1 || spaceDown) {
        panRef.current = {
          sx: e.clientX,
          sy: e.clientY,
          vx: viewRef.current.x,
          vy: viewRef.current.y,
        };
        setIsPanning(true);
        svg.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      const tgMode =
        (e.shiftKey ||
          tgOnRef.current ||
          (toolRef.current === 'ln' && lineModeRef.current === 'tangent')) &&
        tanSnapEnabledRef.current;
      const alt = e.altKey;

      if (editRef.current) {
        commitEdit(x, y, tgMode, alt);
        return;
      }

      const curObjs = objsRef.current;
      const vK = viewRef.current.k;
      const curTool = toolRef.current;
      const curPrio = prioRef.current;
      const curSnapPx = snapPxRef.current;
      const effSnap = snapEnabledRef.current && !alt;
      const activeGuides = guidesVisibleRef.current ? guidesRef.current : undefined;
      const vis = visibleHitIdsRef.current;
      const snapIds = allowedSnapIdsRef.current;

      if (curTool === 'shape') {
        if (isPhaseLocked(activePhaseIdRef.current)) {
          notifyLocked(activePhaseIdRef.current);
          return;
        }
        const arr = shapeArrangementRef.current;
        const hitReg = arr ? arr.hitRegion(x, y) : null;
        if (!hitReg) {
          panRef.current = {
            sx: e.clientX,
            sy: e.clientY,
            vx: viewRef.current.x,
            vy: viewRef.current.y,
          };
          setIsPanning(true);
          svg.setPointerCapture(e.pointerId);
          return;
        }
        const effMode: 'add' | 'sub' = e.altKey ? 'sub' : shapeModeRef.current;
        const regSet = new Set<string>([hitReg.id]);
        shapeDragRef.current = {
          mode: effMode,
          regionIds: regSet,
          lastX: x,
          lastY: y,
        };
        setHoveredShapeRegionId(hitReg.id);
        setDragShapeRegionIds(new Set(regSet));
        svg.setPointerCapture(e.pointerId);
        return;
      }

      if (curTool === 'move') {
        // Backquote (`) + Click or Priority mode toggles object priority
        if (backquoteRef.current || prioModeRef.current) {
          togglePrioAt(x, y);
          return;
        }

        // 0. Click on a purple "Tangência possível" candidate point (1º -> 2º ordered selection)
        if (selTanCandidatesRef.current.length > 0) {
          let hitCand: TangencyCandidate | null = null;
          let bestCD = 13 / vK;
          for (const cand of selTanCandidatesRef.current) {
            const d = Math.hypot(cand.contact.x - x, cand.contact.y - y);
            if (d <= bestCD) {
              bestCD = d;
              hitCand = cand;
            }
          }
          if (hitCand) {
            if (isObjLocked(curObjs, hitCand.firstId)) {
              notifyLocked(getObj(curObjs, hitCand.firstId)?.phaseId);
              return;
            }
            pushHistory(curObjs);
            const next = cloneObjs(curObjs);
            applyTangencyConnection(next, hitCand);
            setObjs(next);
            setSelectedIds(new Set([hitCand.firstId]));
            setHoveredSelTanCand(null);
            return;
          }
        }

        // 0b. Temporary rim resize handle (for circles without a free blue edge point)
        const edInfo = selectedEditInfoRef.current;
        if (
          edInfo?.resizeHandle &&
          !edInfo.resizeHandle.hasFreeEdgePt &&
          selectedIdsRef.current.size === 1
        ) {
          const rh = edInfo.resizeHandle;
          if (Math.hypot(rh.x - x, rh.y - y) <= 12 / vK) {
            const onlyId = Array.from(selectedIdsRef.current)[0];
            if (isObjLocked(curObjs, onlyId)) {
              notifyLocked(getObj(curObjs, onlyId)?.phaseId);
              return;
            }
            const co = getObj(curObjs, onlyId);
            const cv = curve(curObjs, co, curveCacheRef.current);
            if (cv && cv.t === 'c') {
              dragRef.current = {
                kind: 'resize',
                id: onlyId,
                baseObjs: cloneObjs(curObjs),
                origCx: cv.x,
                origCy: cv.y,
                origR: cv.r,
                sx: x,
                sy: y,
                ux: rh.ux,
                uy: rh.uy,
                isTanOffset: rh.isTanOffset,
                saved: false,
              };
              setIsDragging(true);
              svg.setPointerCapture(e.pointerId);
              return;
            }
          }
        }

        // 1. Hit-test visible points first
        const hitR = Math.max(10, curSnapPx) / vK;
        let hitId: number | null = null;
        let hitPt: PointObj | null = null;
        let bestD = hitR;
        for (const o of curObjs) {
          if (o.t === 'pt' && o.ok && !o.dead && vis.has(o.id)) {
            const d = Math.hypot(o.x - x, o.y - y);
            if (d <= bestD) {
              bestD = d;
              hitPt = o;
              hitId = o.id;
            }
          }
        }

        // 2. If no point hit, hit-test visible curves (circles, lines & polygons)
        if (hitId === null) {
          let bestCurveD = 9 / vK;
          const cCache = curveCacheRef.current;
          for (const o of curObjs) {
            if (o.dead || !vis.has(o.id) || (o.t !== 'ln' && o.t !== 'ci' && o.t !== 'pg')) continue;
            const cv = curve(curObjs, o, cCache);
            if (!cv) continue;
            const d = distToCurve(cv, x, y);
            if (d <= bestCurveD) {
              bestCurveD = d;
              hitId = o.id;
            }
          }
        }

        if (hitId !== null) {
          setSelectedGuideId(null);
          setSelectedShapeIds(new Set());
          const hitObj = getObj(curObjs, hitId);
          const groupMembers =
            hitObj?.groupId
              ? curObjs
                  .filter((o) => !o.dead && vis.has(o.id) && o.groupId === hitObj.groupId)
                  .map((o) => o.id)
              : [hitId];
          let nextSel = new Set(selectedIdsRef.current);
          if (e.shiftKey) {
            const allPresent = groupMembers.every((gid) => nextSel.has(gid));
            if (allPresent) {
              for (const gid of groupMembers) nextSel.delete(gid);
            } else {
              for (const gid of groupMembers) nextSel.add(gid);
            }
            setSelectedIds(nextSel);
          } else if (!nextSel.has(hitId)) {
            nextSel = new Set(groupMembers);
            setSelectedIds(nextSel);
          }

          if (isObjLocked(curObjs, hitId)) {
            notifyLocked(getObj(curObjs, hitId)?.phaseId);
            return;
          }

          if (hitPt && hitPt.on !== undefined && nextSel.size === 1) {
            dragRef.current = { kind: 'point', id: hitPt.id, saved: false };
            setIsDragging(true);
          } else {
            const lockedEdgeCi =
              hitPt && nextSel.size === 1
                ? curObjs.find(
                    (o): o is CircleObj =>
                      !o.dead &&
                      o.t === 'ci' &&
                      !!o.scaleLocked &&
                      (o.p === hitPt!.id || o.d1 === hitPt!.id || o.d2 === hitPt!.id)
                  )
                : undefined;
            const rootSelection = lockedEdgeCi ? new Set([lockedEdgeCi.id]) : nextSel;
            const movableIds = movableRootPointsForSelection(curObjs, rootSelection).filter(
              (pid) => !isObjLocked(curObjs, pid)
            );
            if (movableIds.length > 0) {
              const origins = movableIds
                .map((id) => getObj(curObjs, id))
                .filter((o): o is PointObj => !!o && o.t === 'pt' && o.free)
                .map((o) => ({ id: o.id, x: o.x, y: o.y }));
              if (origins.length > 0) {
                let modifiedCurveId: number | undefined;
                let fixedCenter: boolean | undefined;
                let anchorEnd: 'a' | 'b' | undefined;
                let pgCornerEdit:
                  | { polyId: number; cx: number; cy: number; sides: number; lockedRadius?: number }
                  | undefined;
                if (nextSel.size === 1) {
                  if (!hitPt) {
                    const o = getObj(curObjs, hitId);
                    if (o && (o.t === 'ci' || o.t === 'ln' || o.t === 'pg')) {
                      modifiedCurveId = o.id;
                      fixedCenter = false;
                    }
                  } else if (lockedEdgeCi) {
                    modifiedCurveId = lockedEdgeCi.id;
                    fixedCenter = false;
                  } else {
                    const edgeCi = curObjs.find(
                      (o) => !o.dead && o.t === 'ci' && o.p === hitPt!.id
                    );
                    const cornerPg = curObjs.find(
                      (o) => !o.dead && o.t === 'pg' && o.p === hitPt!.id
                    );
                    const lnEnd = curObjs.find(
                      (o) => !o.dead && o.t === 'ln' && (o.a === hitPt!.id || o.b === hitPt!.id)
                    );
                    const centerCi = curObjs.find(
                      (o) => !o.dead && o.t === 'ci' && (o.c === hitPt!.id || o.d1 === hitPt!.id || o.d2 === hitPt!.id)
                    );
                    if (edgeCi && edgeCi.t === 'ci') {
                      modifiedCurveId = edgeCi.id;
                      fixedCenter = !edgeCi.scaleLocked;
                    } else if (cornerPg && cornerPg.t === 'pg') {
                      const pc = getObj(curObjs, cornerPg.c);
                      if (pc && pc.t === 'pt' && pc.ok) {
                        const lockedRadius = cornerPg.scaleLocked
                          ? Math.hypot(hitPt.x - pc.x, hitPt.y - pc.y)
                          : undefined;
                        pgCornerEdit = {
                          polyId: cornerPg.id,
                          cx: pc.x,
                          cy: pc.y,
                          sides: cornerPg.sides,
                          ...(lockedRadius !== undefined ? { lockedRadius } : {}),
                        };
                      }
                    } else if (lnEnd && lnEnd.t === 'ln') {
                      modifiedCurveId = lnEnd.id;
                      anchorEnd = lnEnd.a === hitPt.id ? 'b' : 'a';
                    } else if (centerCi) {
                      modifiedCurveId = centerCi.id;
                      fixedCenter = false;
                    }
                  }
                }
                dragRef.current = {
                  kind: 'group',
                  sx: x,
                  sy: y,
                  origins,
                  saved: false,
                  modifiedCurveId,
                  fixedCenter,
                  anchorEnd,
                  pgCornerEdit,
                };
                setIsDragging(true);
              }
            } else if (!hitPt && nextSel.size === 1) {
              // Direct sliding/editing for tangent-constrained circles without free root points
              const o = getObj(curObjs, hitId);
              if (o && !o.dead && o.t === 'ci') {
                if (o.scaleLocked) {
                  notifyNotice('Escala travada — desbloqueie para alterar o raio.');
                } else if (o.tanSet && o.tanSet.length === 2) {
                  const cv = curve(curObjs, o, curveCacheRef.current);
                  if (cv && cv.t === 'c') {
                    dragRef.current = {
                      kind: 'tan2',
                      id: o.id,
                      baseObjs: cloneObjs(curObjs),
                      origCx: cv.x,
                      origCy: cv.y,
                      origR: cv.r,
                      sx: x,
                      sy: y,
                      saved: false,
                    };
                    setIsDragging(true);
                  }
                } else if (o.c !== undefined && o.tan !== undefined) {
                  const pc = getObj(curObjs, o.c);
                  if (pc && pc.t === 'pt' && pc.on !== undefined && !isObjLocked(curObjs, pc.id)) {
                    dragRef.current = { kind: 'point', id: pc.id, saved: false };
                    setIsDragging(true);
                  }
                } else if (o.e !== undefined && o.tan !== undefined && o.tan2 === undefined) {
                  const pe = getObj(curObjs, o.e);
                  const cv = curve(curObjs, o, curveCacheRef.current);
                  if (pe && pe.t === 'pt' && pe.ok && cv && cv.t === 'c') {
                    dragRef.current = {
                      kind: 'edgeTan',
                      id: o.id,
                      baseObjs: cloneObjs(curObjs),
                      ex: pe.x,
                      ey: pe.y,
                      origCx: cv.x,
                      origCy: cv.y,
                      sx: x,
                      sy: y,
                      saved: false,
                    };
                    setIsDragging(true);
                  }
                }
              }
            }
          }
          svg.setPointerCapture(e.pointerId);
          return;
        }

        // 3. Hit-test unlocked drafting guides
        if (!guidesLockedRef.current && activeGuides && activeGuides.length > 0) {
          let bestG: GuideLine | null = null;
          let bestGD = 7 / vK;
          for (const g of activeGuides) {
            const d = distToGuide(g, x, y);
            if (d <= bestGD) {
              bestGD = d;
              bestG = g;
            }
          }
          if (bestG) {
            setSelectedGuideId(bestG.id);
            setSelectedIds(new Set());
            setSelectedShapeIds(new Set());
            guideDragRef.current = {
              id: bestG.id,
              kind: bestG.kind,
              sx: x,
              sy: y,
              orig: { ...bestG },
              saved: false,
            };
            setIsDragging(true);
            svg.setPointerCapture(e.pointerId);
            return;
          }
        }

        setSelectedGuideId(null);

        // 4. Empty canvas click: check reference image handles, otherwise initiate direct marquee selection
        if (!imgDown(x, y)) {
          const box: MarqueeBox = { x0: x, y0: y, x1: x, y1: y };
          marqueeRef.current = box;
          marqueeShiftRef.current = e.shiftKey;
          setMarquee(box);
        }
        svg.setPointerCapture(e.pointerId);
        return;
      }

      if (curTool === 'del') {
        const sn = snap(
          curObjs,
          x,
          y,
          vK,
          curPrio,
          Math.max(8, curSnapPx),
          true,
          cachedIntersRef.current,
          undefined,
          curveCacheRef.current,
          vis
        );
        if (sn.k === 'pt') {
          if (isObjLocked(curObjs, sn.id)) {
            notifyLocked(getObj(curObjs, sn.id)?.phaseId);
            return;
          }
          pushHistory(curObjs);
          const next = cloneObjs(curObjs);
          killObj(next, sn.id);
          setObjs(next);
          return;
        }
        const hitCurve = curObjs.find((o) => {
          if (o.dead || !vis.has(o.id) || (o.t !== 'ln' && o.t !== 'ci' && o.t !== 'pg')) return false;
          const cv = curve(curObjs, o, curveCacheRef.current);
          return cv ? distToCurve(cv, x, y) < 8 / vK : false;
        });
        if (hitCurve) {
          if (isObjLocked(curObjs, hitCurve.id)) {
            notifyLocked(hitCurve.phaseId);
            return;
          }
          pushHistory(curObjs);
          const next = cloneObjs(curObjs);
          killObj(next, hitCurve.id);
          setObjs(next);
          return;
        }
        // Also allow deleting a BuiltShape on an unlocked visible phase when clicking inside it (topmost layer first)
        const visibleShapes = shapesRef.current.filter((sh) => {
          if (!sh.d) return false;
          const ph = phaseMapRef.current.get(sh.phaseId);
          return ph && ph.showPath && !ph.locked;
        });
        if (visibleShapes.length > 0) {
          const orderMap = new Map(phasesRef.current.map((p, idx) => [p.id, idx]));
          const orderedShapes = [...visibleShapes].sort((a, b) => {
            const pa = orderMap.get(a.phaseId) ?? 0;
            const pb = orderMap.get(b.phaseId) ?? 0;
            return pb - pa;
          });
          let targetShape: BuiltShape | undefined;
          if (typeof Path2D !== 'undefined') {
            const testCanvas = document.createElement('canvas');
            const testCtx = testCanvas.getContext('2d');
            if (testCtx) {
              for (const sh of orderedShapes) {
                try {
                  if (testCtx.isPointInPath(new Path2D(sh.d), x, y, 'evenodd')) {
                    targetShape = sh;
                    break;
                  }
                } catch {
                  // ignore malformed path
                }
              }
            }
          }
          if (targetShape) {
            pushHistory(curObjs);
            setShapes((prev) => prev.filter((s) => s.id !== targetShape.id));
            return;
          }
        }
        if (!guidesLockedRef.current && activeGuides && activeGuides.length > 0) {
          let bestG: GuideLine | null = null;
          let bestGD = 8 / vK;
          for (const g of activeGuides) {
            const d = distToGuide(g, x, y);
            if (d <= bestGD) {
              bestGD = d;
              bestG = g;
            }
          }
          if (bestG) {
            const delId = bestG.id;
            pushHistory(curObjs);
            setGuides((prev) => prev.filter((g) => g.id !== delId));
            if (selectedGuideIdRef.current === delId) setSelectedGuideId(null);
          }
        }
        return;
      }

      if (curTool === 'ruler') {
        const sn = snap(
          curObjs,
          x,
          y,
          vK,
          curPrio,
          curSnapPx,
          effSnap,
          cachedIntersRef.current,
          activeGuides,
          curveCacheRef.current,
          snapIds
        );
        const start = rulerStartRef.current;
        if (!start) {
          setRulerStart({ x: sn.x, y: sn.y });
        } else {
          if (Math.hypot(sn.x - start.x, sn.y - start.y) > 1e-3) {
            const id = `g-${++guideCounterRef.current}`;
            const newGuide: GuideLine = {
              id,
              kind: 'a',
              x1: start.x,
              y1: start.y,
              x2: sn.x,
              y2: sn.y,
            };
            pushHistory(curObjs);
            setGuides((prev) => [...prev, newGuide]);
            setGuidesVisible(true);
            setSelectedGuideId(id);
          }
          setRulerStart(null);
        }
        return;
      }

      // Creation tools require unlocked active phase
      const pid = activePhaseIdRef.current;
      if (isPhaseLocked(pid)) {
        notifyLocked(pid);
        return;
      }

      if (
        curTool === 'ci' &&
        (circleModeRef.current === 'center' || circleModeRef.current === 'top-left') &&
        pendRef.current.length === 1 &&
        tgMode &&
        creationOriginRef.current === 'center' &&
        circleModeRef.current !== 'top-left'
      ) {
        const tg = tangentFor(
          curObjs,
          pendRef.current[0],
          x,
          y,
          vK,
          curPrio,
          curSnapPx,
          curveCacheRef.current,
          snapIds
        );
        if (tg) {
          pushHistory(curObjs);
          const next = cloneObjs(curObjs);
          const ci = addObj(next, {
            t: 'ci',
            c: pendRef.current[0],
            tan: tg.tan,
            ...(tg.tanEdge !== undefined ? { tanEdge: tg.tanEdge } : {}),
            m: tg.m,
            phaseId: pid,
            ...(gridConfigRef.current.lockScale ? { scaleLocked: true } : {}),
          });
          addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci, tg: tg.tan, phaseId: pid });
          recalc(next);
          setObjs(next);
          setPend([]);
          setGhost(null);
          return;
        }
      }

      if (curTool === 'ln' && lineModeRef.current !== 'common' && pendRef.current.length === 1 && tgMode) {
        const tg = tangentLineFor(
          curObjs,
          pendRef.current[0],
          x,
          y,
          vK,
          curPrio,
          curSnapPx,
          curveCacheRef.current,
          snapIds
        );
        if (tg) {
          pushHistory(curObjs);
          const next = cloneObjs(curObjs);
          if (tg.polyVertexIdx !== undefined) {
            const bId = addObj(next, {
              t: 'pt',
              free: false,
              x: tg.contact.x,
              y: tg.contact.y,
              on: tg.to,
              u: tg.polyVertexIdx,
              phaseId: pid,
            });
            addObj(next, { t: 'ln', a: pendRef.current[0], b: bId, phaseId: pid });
          } else {
            const ln = addObj(next, { t: 'ln', a: pendRef.current[0], to: tg.to, s: tg.s, phaseId: pid });
            addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: tg.to, tg: ln, phaseId: pid });
          }
          recalc(next);
          setObjs(next);
          setPend([]);
          setGhost(null);
          return;
        }
      }

      if (curTool === 'ci' && circleModeRef.current === 'tangent') {
        const curTan = tanSelRef.current;
        const exclude = new Set(curTan.map((s) => s.id));
        const hitId =
          curTan.length < 4
            ? findTanTargetAt(curObjs, curveCacheRef.current, x, y, vK, exclude)
            : null;

        const resolveHitEdge = (id: number): number | undefined => {
          const hitObj = getObj(curObjs, id);
          if (!hitObj || hitObj.t !== 'pg') return undefined;
          const hitCv = curve(curObjs, hitObj, curveCacheRef.current);
          return hitCv && hitCv.t === 'p' ? nearestPolyEdge(hitCv, x, y)?.edge : undefined;
        };

        if (curTan.length < 2) {
          if (hitId !== null) {
            const edge = resolveHitEdge(hitId);
            const nextSel: TanTargetSel[] = [
              ...curTan,
              { id: hitId, hx: x, hy: y, ...(edge !== undefined ? { edge } : {}) },
            ];
            tanSelRef.current = nextSel;
            setTanSel(nextSel);
            setTanVariantIdx(0);
            computePreview(x, y, e.shiftKey, e.altKey);
          } else {
            const reHit = findTanTargetAt(curObjs, curveCacheRef.current, x, y, vK, new Set());
            if (reHit !== null && exclude.has(reHit)) {
              const nextSel = curTan.filter((s) => s.id !== reHit);
              tanSelRef.current = nextSel;
              setTanSel(nextSel);
              setTanVariantIdx(0);
              computePreview(x, y, e.shiftKey, e.altKey);
            }
          }
          return;
        }

        if (hitId !== null && curTan.length < 4) {
          const edge = resolveHitEdge(hitId);
          const nextSel: TanTargetSel[] = [
            ...curTan,
            { id: hitId, hx: x, hy: y, ...(edge !== undefined ? { edge } : {}) },
          ];
          tanSelRef.current = nextSel;
          setTanSel(nextSel);
          setTanVariantIdx(0);
          computePreview(x, y, e.shiftKey, e.altKey);
          return;
        }

        const sols = solveMultiTangent(curObjs, curTan, x, y, curveCacheRef.current);
        if (sols.length > 0) {
          const sol = sols[tanVariantIdxRef.current % sols.length];
          commitTanCircle(curTan, sol);
        }
        return;
      }

      if (curTool === 'ln' && lineModeRef.current === 'common') {
        const curTc = tcSelRef.current;
        if (curTc.length < 2) {
          const hit = curObjs.find((o) => {
            if (o.dead || !vis.has(o.id) || o.t !== 'ci') return false;
            const cv = curve(curObjs, o, curveCacheRef.current);
            return cv ? distToCurve(cv, x, y) < 12 / vK : false;
          });
          if (hit && !curTc.includes(hit.id)) {
            setTcSel([...curTc, hit.id]);
          }
        } else {
          const g = commonTanFor(curObjs, curTc[0], curTc[1], x, y, curveCacheRef.current);
          if (g) {
            pushHistory(curObjs);
            const next = cloneObjs(curObjs);
            const ln = addObj(next, { t: 'ln', cc: [curTc[0], curTc[1]], s: g.s, tt: g.t, phaseId: pid });
            addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: curTc[0], tg: ln, phaseId: pid });
            addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: curTc[1], tg: ln, phaseId: pid });
            recalc(next);
            setObjs(next);
            setTcSel([]);
            setGhost(null);
          }
        }
        return;
      }

      if (curTool === 'ci' && circleModeRef.current === 'diameter' && pendRef.current.length === 1 && tgMode) {
        const A = getObj(curObjs, pendRef.current[0]);
        if (A && A.t === 'pt' && A.ok) {
          const tg = tanSolve(
            curObjs,
            A,
            x,
            y,
            new Set(),
            vK,
            curPrio,
            curSnapPx,
            curveCacheRef.current,
            snapIds
          );
          if (tg) {
            pushHistory(curObjs);
            const next = cloneObjs(curObjs);
            const ci = addObj(next, {
              t: 'ci',
              e: pendRef.current[0],
              phaseId: pid,
              ...tanFields(tg),
              ...(gridConfigRef.current.lockScale ? { scaleLocked: true } : {}),
            });
            for (const q of tanIds(tg)) {
              addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci, tg: q, phaseId: pid });
            }
            recalc(next);
            setObjs(next);
            setPend([]);
            setGhost(null);
            return;
          }
        }
      }

      pushHistory(curObjs);
      const next = cloneObjs(curObjs);
      const gCfg = gridConfigRef.current;
      const sn = snap(
        next,
        x,
        y,
        vK,
        curPrio,
        curSnapPx,
        effSnap,
        cachedIntersRef.current,
        activeGuides,
        curveCacheRef.current,
        snapIds,
        !alt ? gCfg : undefined
      );

      if (
        pendRef.current.length === 1 &&
        ((curTool === 'ci' && (creationOriginRef.current === 'top-left' || circleModeRef.current === 'top-left')) ||
          (curTool === 'pg' && creationOriginRef.current === 'top-left'))
      ) {
        const p0Id = pendRef.current[0];
        const anchor = getObj(next, p0Id);
        if (anchor && anchor.t === 'pt' && anchor.ok) {
          const dx = sn.x - anchor.x;
          const dy = sn.y - anchor.y;
          const sx = dx >= 0 ? 1 : -1;
          const sy = dy >= 0 ? 1 : -1;
          const rawBox = Math.max(Math.abs(dx), Math.abs(dy));
          if (rawBox > 1e-4) {
            let boxSide = rawBox;
            if (!alt && gCfg.sizeRule !== 'free' && sn.k === 'free' && !sn.guideTag) {
              boxSide = snapSizeByRule(rawBox, gCfg).snapped;
            }
            const cx = anchor.x + sx * (boxSide / 2);
            const cy = anchor.y + sy * (boxSide / 2);
            const usedElsewhere = next.some((q) => !q.dead && refsOf(q).includes(p0Id));
            let centerPtId: number;
            if (anchor.free && !usedElsewhere) {
              anchor.x = cx;
              anchor.y = cy;
              centerPtId = p0Id;
            } else {
              centerPtId = addObj(next, { t: 'pt', free: true, x: cx, y: cy, phaseId: pid });
            }
            const lockNew = gCfg.lockScale;
            if (curTool === 'ci') {
              const edgePtId = addObj(next, {
                t: 'pt',
                free: true,
                x: cx + boxSide / 2,
                y: cy,
                phaseId: pid,
              });
              addObj(next, {
                t: 'ci',
                c: centerPtId,
                p: edgePtId,
                phaseId: pid,
                ...(lockNew ? { scaleLocked: true } : {}),
              });
            } else {
              const sides = Math.max(3, polySidesRef.current);
              const polyR = sides === 4 ? boxSide / Math.SQRT2 : boxSide / 2;
              const rot = sides === 4 ? Math.PI / 4 : -Math.PI / 2;
              const cornerPtId = addObj(next, {
                t: 'pt',
                free: true,
                x: cx + polyR * Math.cos(rot),
                y: cy + polyR * Math.sin(rot),
                phaseId: pid,
              });
              addObj(next, {
                t: 'pg',
                c: centerPtId,
                p: cornerPtId,
                sides,
                phaseId: pid,
                ...(lockNew ? { scaleLocked: true } : {}),
              });
            }
            recalc(next);
            setObjs(next);
            setPend([]);
            setGhost(null);
            return;
          }
        }
      }

      let finalSnap: SnapResult = sn;
      if (pendRef.current.length === 1 && sn.k === 'free' && !sn.guideTag) {
        const anchor = getObj(next, pendRef.current[0]);
        if (anchor && anchor.t === 'pt' && anchor.ok) {
          if (curTool === 'ci' && circleModeRef.current === 'diameter' && !alt && gCfg.sizeRule !== 'free') {
            const rawD = Math.hypot(sn.x - anchor.x, sn.y - anchor.y);
            if (rawD > 1e-3) {
              const rule = snapSizeByRule(rawD, gCfg);
              const ang = Math.atan2(sn.y - anchor.y, sn.x - anchor.x);
              finalSnap = {
                k: 'free',
                x: anchor.x + rule.snapped * Math.cos(ang),
                y: anchor.y + rule.snapped * Math.sin(ang),
              };
            }
          } else if (curTool === 'ci' && !alt && gCfg.sizeRule !== 'free') {
            const rawR = Math.hypot(sn.x - anchor.x, sn.y - anchor.y);
            if (rawR > 1e-3) {
              const rule = snapSizeByRule(rawR * 2, gCfg);
              const ang = Math.atan2(sn.y - anchor.y, sn.x - anchor.x);
              finalSnap = {
                k: 'free',
                x: anchor.x + (rule.snapped / 2) * Math.cos(ang),
                y: anchor.y + (rule.snapped / 2) * Math.sin(ang),
              };
            }
          } else if (curTool === 'pg') {
            const polySnap = resolvePolyCorner(
              anchor.x,
              anchor.y,
              sn.x,
              sn.y,
              true,
              Math.max(3, polySidesRef.current),
              e.shiftKey,
              alt,
              effSnap,
              gCfg
            );
            if (polySnap) {
              finalSnap = {
                k: 'free',
                x: polySnap.px,
                y: polySnap.py,
              };
            }
          }
        }
      }
      const id = commitSnap(next, finalSnap, pid);

      const nextPend = [...pendRef.current, id];
      if (nextPend.length === 2) {
        if (nextPend[0] !== nextPend[1]) {
          const lockNew = gCfg.lockScale;
          if (curTool === 'ln') addObj(next, { t: 'ln', a: nextPend[0], b: nextPend[1], phaseId: pid });
          else if (curTool === 'ci' && circleModeRef.current === 'diameter') {
            addObj(next, {
              t: 'ci',
              d1: nextPend[0],
              d2: nextPend[1],
              phaseId: pid,
              ...(lockNew ? { scaleLocked: true } : {}),
            });
          } else if (curTool === 'pg') {
            addObj(next, {
              t: 'pg',
              c: nextPend[0],
              p: nextPend[1],
              sides: Math.max(3, polySidesRef.current),
              phaseId: pid,
              ...(lockNew ? { scaleLocked: true } : {}),
            });
          } else {
            addObj(next, {
              t: 'ci',
              c: nextPend[0],
              p: nextPend[1],
              phaseId: pid,
              ...(lockNew ? { scaleLocked: true } : {}),
            });
          }
        }
        recalc(next);
        setObjs(next);
        setPend([]);
        setGhost(null);
      } else {
        setObjs(next);
        setPend(nextPend);
      }
    },
    [
      commitEdit,
      commitTanCircle,
      computePreview,
      findTanTargetAt,
      imgDown,
      isObjLocked,
      isPhaseLocked,
      notifyLocked,
      notifyNotice,
      pushHistory,
      spaceDown,
      togglePrioAt,
      toWorld,
    ]
  );

  const processPointerMove = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean, altKey: boolean) => {
      if (imgDragRef.current) {
        const d = imgDragRef.current;
        const [ix, iy] = toWorld(clientX, clientY);
        setCursorWorld({ x: ix, y: iy });
        setRefImgs((prev) =>
          prev.map((r) => {
            if (r.id !== d.id) return r;
            if (d.m === 'rot') {
              return {
                ...r,
                r: (Math.atan2(iy - (r.y + r.h / 2), ix - (r.x + r.w / 2)) * 180) / Math.PI + 90,
              };
            }
            if (d.m === 'sc') {
              const f = Math.max(0.02, Math.hypot(ix - d.cx, iy - d.cy) / d.d0);
              const w = d.w0 * f;
              const h = d.h0 * f;
              return { ...r, w, h, x: d.cx - w / 2, y: d.cy - h / 2 };
            }
            return { ...r, x: d.x0 + ix - d.sx, y: d.y0 + iy - d.sy };
          })
        );
        return;
      }

      if (panRef.current) {
        const p = panRef.current;
        const vK = viewRef.current.k;
        setView((prev) => ({
          ...prev,
          x: p.vx - (clientX - p.sx) / vK,
          y: p.vy - (clientY - p.sy) / vK,
        }));
        return;
      }

      const [x, y] = toWorld(clientX, clientY);
      setCursorWorld({ x, y });

      if (shapeDragRef.current) {
        const sd = shapeDragRef.current;
        const arr = shapeArrangementRef.current;
        if (arr) {
          let added = false;
          const steps = 6;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const sx = sd.lastX + (x - sd.lastX) * t;
            const sy = sd.lastY + (y - sd.lastY) * t;
            const hitReg = arr.hitRegion(sx, sy);
            if (hitReg && !sd.regionIds.has(hitReg.id)) {
              sd.regionIds.add(hitReg.id);
              added = true;
            }
          }
          sd.lastX = x;
          sd.lastY = y;
          const hoverReg = arr.hitRegion(x, y);
          setHoveredShapeRegionId(hoverReg ? hoverReg.id : null);
          if (added) {
            setDragShapeRegionIds(new Set(sd.regionIds));
          }
        }
        return;
      }

      if (guideDragRef.current) {
        const gd = guideDragRef.current;
        const vK = viewRef.current.k;
        const dx = x - gd.sx;
        const dy = y - gd.sy;
        if (!gd.saved && (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6)) {
          pushHistory(objsRef.current);
          gd.saved = true;
        }
        const allowSnap = snapEnabledRef.current && !altKey;
        const tol = snapPxRef.current / vK;

        setGuides((prev) =>
          prev.map((g) => {
            if (g.id !== gd.id) return g;
            if (gd.kind === 'h' && gd.orig.kind === 'h') {
              const rawY = gd.orig.y + dy;
              const nextY = allowSnap
                ? snapAxisCoordinate(objsRef.current, cachedIntersRef.current, prioRef.current, 'h', rawY, tol)
                : rawY;
              return { ...g, kind: 'h', y: nextY };
            }
            if (gd.kind === 'v' && gd.orig.kind === 'v') {
              const rawX = gd.orig.x + dx;
              const nextX = allowSnap
                ? snapAxisCoordinate(objsRef.current, cachedIntersRef.current, prioRef.current, 'v', rawX, tol)
                : rawX;
              return { ...g, kind: 'v', x: nextX };
            }
            if (gd.kind === 'a' && gd.orig.kind === 'a') {
              return {
                ...g,
                kind: 'a',
                x1: gd.orig.x1 + dx,
                y1: gd.orig.y1 + dy,
                x2: gd.orig.x2 + dx,
                y2: gd.orig.y2 + dy,
              };
            }
            return g;
          })
        );
        return;
      }

      if (marqueeRef.current) {
        const nextBox: MarqueeBox = { ...marqueeRef.current, x1: x, y1: y };
        marqueeRef.current = nextBox;
        setMarquee(nextBox);
        return;
      }

      if (dragRef.current) {
        const dr = dragRef.current;
        const curObjs = objsRef.current;
        if (dr.kind === 'resize') {
          const delta = (x - dr.sx) * dr.ux + (y - dr.sy) * dr.uy;
          const vK = viewRef.current.k;
          const rawR = Math.max(2 / vK, dr.origR + (dr.isTanOffset ? delta * 0.5 : delta));
          const gCfg = gridConfigRef.current;
          const newR =
            !altKey && gCfg.sizeRule !== 'free'
              ? Math.max(2 / vK, snapSizeByRule(rawR * 2, gCfg).snapped / 2)
              : rawR;
          if (!dr.saved && Math.abs(delta) > 1e-6) {
            pushHistory(dr.baseObjs);
            dr.saved = true;
          }
          const res = setCircleRadius(dr.baseObjs, dr.id, newR);
          if (res.ok && res.next) {
            setObjs(res.next);
          }
          return;
        }

        if (dr.kind === 'tan2') {
          const dx = x - dr.sx;
          const dy = y - dr.sy;
          if (!dr.saved && Math.hypot(dx, dy) > 1e-6) {
            pushHistory(dr.baseObjs);
            dr.saved = true;
          }
          const next = cloneObjs(dr.baseObjs);
          const co = getObj(next, dr.id);
          if (co && co.t === 'ci') {
            co.tanFixedR = false;
            co.tanRef = { x: dr.origCx + dx, y: dr.origCy + dy, r: dr.origR };
            recalc(next);
            const cv = curve(next, getObj(next, dr.id));
            if (cv && cv.t === 'c') {
              setObjs(next);
            }
          }
          return;
        }

        if (dr.kind === 'edgeTan') {
          const dx = x - dr.sx;
          const dy = y - dr.sy;
          if (!dr.saved && Math.hypot(dx, dy) > 1e-6) {
            pushHistory(dr.baseObjs);
            dr.saved = true;
          }
          const next = cloneObjs(dr.baseObjs);
          const co = getObj(next, dr.id);
          if (co && co.t === 'ci') {
            co.ang = Math.atan2(dr.origCy + dy - dr.ey, dr.origCx + dx - dr.ex);
            recalc(next);
            const cv = curve(next, getObj(next, dr.id));
            if (cv && cv.t === 'c') {
              setObjs(next);
            }
          }
          return;
        }

        if (dr.kind === 'group') {
          const dx = x - dr.sx;
          const dy = y - dr.sy;
          if (!dr.saved && Math.hypot(dx, dy) > 1e-6) {
            pushHistory(curObjs);
            dr.saved = true;
          }
          const next = cloneObjs(curObjs);
          const gCfg = gridConfigRef.current;
          const vK = viewRef.current.k;
          const curSnapPx = snapPxRef.current;
          const allowGridSnap = !altKey && gCfg.enabled && gCfg.snap;
          let gridHover: SnapResult | null = null;

          for (const orig of dr.origins) {
            const pt = next[orig.id];
            if (pt && pt.t === 'pt' && pt.free) {
              pt.x = orig.x + dx;
              pt.y = orig.y + dy;
            }
          }

          if (dr.pgCornerEdit && dr.origins.length === 1) {
            const pgInfo = dr.pgCornerEdit;
            const curPt = next[dr.origins[0].id];
            if (curPt && curPt.t === 'pt' && curPt.free) {
              if (pgInfo.lockedRadius !== undefined) {
                const polySnap = resolvePolyCorner(
                  pgInfo.cx,
                  pgInfo.cy,
                  curPt.x,
                  curPt.y,
                  true,
                  pgInfo.sides,
                  shiftKey,
                  true,
                  false,
                  gCfg
                );
                const tx = polySnap ? polySnap.px : curPt.x;
                const ty = polySnap ? polySnap.py : curPt.y;
                const ang = Math.atan2(ty - pgInfo.cy, tx - pgInfo.cx);
                curPt.x = pgInfo.cx + pgInfo.lockedRadius * Math.cos(ang);
                curPt.y = pgInfo.cy + pgInfo.lockedRadius * Math.sin(ang);
              } else {
                const gs = allowGridSnap ? snapToGrid(curPt.x, curPt.y, vK, curSnapPx, gCfg) : null;
                if (gs) {
                  curPt.x = gs.x;
                  curPt.y = gs.y;
                  gridHover = { k: 'free', x: gs.x, y: gs.y, guideTag: gs.tag };
                } else {
                  const polySnap = resolvePolyCorner(
                    pgInfo.cx,
                    pgInfo.cy,
                    curPt.x,
                    curPt.y,
                    true,
                    pgInfo.sides,
                    shiftKey,
                    altKey,
                    snapEnabledRef.current && !altKey,
                    gCfg
                  );
                  if (polySnap) {
                    curPt.x = polySnap.px;
                    curPt.y = polySnap.py;
                  }
                }
              }
            }
          }
          recalc(next);

          let activeTanApplied = false;
          if (
            tanSnapEnabledRef.current &&
            dr.modifiedCurveId !== undefined &&
            Math.hypot(dx, dy) > 1e-6
          ) {
            const snapRes = findDragTangencySnap(next, dr.modifiedCurveId, {
              fixedCenter: dr.fixedCenter,
              anchorEnd: dr.anchorEnd,
              cursorX: x,
              cursorY: y,
              viewK: vK,
              snapPx: curSnapPx,
              allowedIds: allowedSnapIdsRef.current,
            });
            const allowTanSnap = snapEnabledRef.current && !altKey;
            if (allowTanSnap && snapRes.active) {
              applyDragTangencySnap(next, snapRes.active);
              activeDragTanRef.current = snapRes.active;
              activeTanApplied = true;
              gridHover = null;
              setDragTanOverlay({ candidates: snapRes.candidates, active: snapRes.active });
            } else {
              activeDragTanRef.current = null;
              setDragTanOverlay(
                snapRes.candidates.length > 0
                  ? { candidates: snapRes.candidates, active: null }
                  : null
              );
            }
          } else {
            activeDragTanRef.current = null;
            setDragTanOverlay(null);
          }

          if (
            !activeTanApplied &&
            allowGridSnap &&
            !dr.pgCornerEdit &&
            dr.origins.length > 0 &&
            (dr.origins.length === 1 || dr.modifiedCurveId !== undefined)
          ) {
            const refOrig = dr.origins[0];
            const gs = snapToGrid(refOrig.x + dx, refOrig.y + dy, vK, curSnapPx, gCfg);
            if (gs) {
              const sdx = gs.x - refOrig.x;
              const sdy = gs.y - refOrig.y;
              for (const orig of dr.origins) {
                const pt = next[orig.id];
                if (pt && pt.t === 'pt' && pt.free) {
                  pt.x = orig.x + sdx;
                  pt.y = orig.y + sdy;
                }
              }
              recalc(next);
              gridHover = { k: 'free', x: gs.x, y: gs.y, guideTag: gs.tag };
            }
          }

          let nextSmartGuides: SmartGuide[] = [];
          if (
            !activeTanApplied &&
            !gridHover &&
            snapEnabledRef.current &&
            !altKey &&
            !dr.pgCornerEdit
          ) {
            const movingIds = new Set<number>();
            if (dr.modifiedCurveId !== undefined) movingIds.add(dr.modifiedCurveId);
            for (const id of selectedIdsRef.current) {
              const o = getObj(next, id);
              if (o && !o.dead && (o.t === 'ci' || o.t === 'pg' || o.t === 'ln')) {
                movingIds.add(o.id);
              }
            }
            for (const o of next) {
              if (o.dead || (o.t !== 'ci' && o.t !== 'pg' && o.t !== 'ln')) continue;
              const rs = refsOf(o);
              if (dr.origins.some((orig) => rs.includes(orig.id))) {
                movingIds.add(o.id);
              }
            }
            const moveBoundIds =
              movingIds.size > 0 ? movingIds : new Set(dr.origins.map((o) => o.id));
            const movedBounds = getSelectionBoundingBox(next, moveBoundIds);
            if (movedBounds) {
              const sg = findSmartAlignSnap(
                next,
                movingIds,
                movedBounds,
                vK,
                curSnapPx,
                allowedSnapIdsRef.current
              );
              if (sg.dx !== 0 || sg.dy !== 0) {
                for (const orig of dr.origins) {
                  const pt = next[orig.id];
                  if (pt && pt.t === 'pt' && pt.free) {
                    pt.x += sg.dx;
                    pt.y += sg.dy;
                  }
                }
                recalc(next);
              }
              nextSmartGuides = sg.guides;
            }
          }

          setSmartGuides(nextSmartGuides);
          setHover(gridHover);
          setObjs(next);
          return;
        }

        // Single curve-constrained point drag
        if (!dr.saved) {
          pushHistory(curObjs);
          dr.saved = true;
        }
        const next = cloneObjs(curObjs);
        const pt = next[dr.id];
        if (pt && pt.t === 'pt') {
          const sh = shiftKey || tgOnRef.current;
          const vK = viewRef.current.k;
          const curPrio = prioRef.current;
          const curSnapPx = snapPxRef.current;
          const snapIds = allowedSnapIdsRef.current;
          let attached: { id: number; u: number } | null = null;
          if (sh) {
            const bad = descOf(next, pt.id);
            let bd = curSnapPx / vK;
            for (const o of next) {
              if (
                o.dead ||
                !snapIds.has(o.id) ||
                !isPrioritized(curPrio, o.id) ||
                bad.has(o.id) ||
                (o.t !== 'ln' && o.t !== 'ci')
              ) {
                continue;
              }
              const T = curve(next, o);
              if (!T) continue;
              const dd = distToCurve(T, x, y);
              if (dd <= bd) {
                bd = dd;
                const proj = projectOnCurve(T, x, y);
                attached = { id: o.id, u: proj.u };
              }
            }
          }
          if (attached) {
            pt.free = false;
            pt.on = attached.id;
            pt.u = attached.u;
          } else {
            let px = x;
            let py = y;
            if (sh && guidesVisibleRef.current && guidesRef.current.length > 0) {
              let bestGD = curSnapPx / vK;
              for (const g of guidesRef.current) {
                const dd = distToGuide(g, x, y);
                if (dd <= bestGD) {
                  bestGD = dd;
                  const proj = projectOnCurve(guideToCurve(g), x, y);
                  px = proj.x;
                  py = proj.y;
                }
              }
            }
            pt.free = true;
            delete pt.on;
            delete pt.u;
            pt.x = px;
            pt.y = py;
          }
          recalc(next);
          setObjs(next);
        }
        return;
      }

      computePreview(x, y, shiftKey, altKey);
    },
    [computePreview, pushHistory, toWorld]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      pendingMoveRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      };
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          const m = pendingMoveRef.current;
          pendingMoveRef.current = null;
          if (m) {
            processPointerMove(m.clientX, m.clientY, m.shiftKey, m.altKey);
          }
        });
      }
    },
    [processPointerMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (pendingMoveRef.current) {
        const m = pendingMoveRef.current;
        pendingMoveRef.current = null;
        processPointerMove(m.clientX, m.clientY, m.shiftKey, m.altKey);
      }

      if (shapeDragRef.current) {
        const sd = shapeDragRef.current;
        shapeDragRef.current = null;
        setDragShapeRegionIds(new Set());
        const arr = shapeArrangementRef.current;
        if (arr && sd.regionIds.size > 0) {
          const pid = activePhaseIdRef.current;
          const regionMap = new Map(arr.regions.map((r) => [r.id, r]));
          const resolveShapeRegions = (sh: BuiltShape): Set<string> => {
            const set = new Set<string>();
            for (const s of sh.seeds) {
              const hr = arr.hitRegion(s.x, s.y);
              if (hr) set.add(hr.id);
            }
            return set;
          };

          const curShapes = shapesRef.current;
          if (sd.mode === 'add') {
            const overlappingIds = new Set<string>();
            const mergedRegionIds = new Set<string>(sd.regionIds);
            for (const sh of curShapes) {
              if (sh.phaseId !== pid) continue;
              const regIds = resolveShapeRegions(sh);
              let touches = false;
              for (const rid of sd.regionIds) {
                if (regIds.has(rid)) {
                  touches = true;
                  break;
                }
              }
              if (touches) {
                overlappingIds.add(sh.id);
                for (const rid of regIds) mergedRegionIds.add(rid);
              }
            }
            const nextD = arr.buildUnionSvgPath(mergedRegionIds);
            if (nextD) {
              const nextSeeds: Array<{ x: number; y: number }> = [];
              for (const rid of mergedRegionIds) {
                const r = regionMap.get(rid);
                if (r) nextSeeds.push(r.seed);
              }
              pushHistory(objsRef.current);
              const newShape: BuiltShape = {
                id: `sh-${++shapeCounterRef.current}`,
                phaseId: pid,
                seeds: nextSeeds,
                d: nextD,
                scope: shapeScopeRef.current,
              };
              setShapes((prev) => [
                ...prev.filter((s) => !overlappingIds.has(s.id)),
                newShape,
              ]);
            }
          } else {
            // Subtract dragged regions from existing shapes in active phase
            let anyChanged = false;
            const nextShapes: BuiltShape[] = [];
            for (const sh of curShapes) {
              if (sh.phaseId !== pid) {
                nextShapes.push(sh);
                continue;
              }
              const regIds = resolveShapeRegions(sh);
              let removed = false;
              for (const rid of sd.regionIds) {
                if (regIds.delete(rid)) removed = true;
              }
              if (!removed) {
                nextShapes.push(sh);
                continue;
              }
              anyChanged = true;
              if (regIds.size === 0) {
                continue;
              }
              const nextD = arr.buildUnionSvgPath(regIds);
              if (!nextD) continue;
              const nextSeeds: Array<{ x: number; y: number }> = [];
              for (const rid of regIds) {
                const r = regionMap.get(rid);
                if (r) nextSeeds.push(r.seed);
              }
              nextShapes.push({
                ...sh,
                seeds: nextSeeds,
                d: nextD,
                scope: shapeScopeRef.current,
                stale: false,
              });
            }
            if (anyChanged) {
              pushHistory(objsRef.current);
              setShapes(nextShapes);
            }
          }
        }
      }

      if (guideDragRef.current) {
        const gd = guideDragRef.current;
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const draggedBackOut =
            (gd.kind === 'h' && e.clientY < rect.top) || (gd.kind === 'v' && e.clientX < rect.left);
          if (draggedBackOut) {
            setGuides((prev) => prev.filter((g) => g.id !== gd.id));
            if (selectedGuideIdRef.current === gd.id) setSelectedGuideId(null);
          }
        }
        guideDragRef.current = null;
      }

      if (marqueeRef.current) {
        const box = marqueeRef.current;
        const vK = viewRef.current.k;
        const isClickOnly = Math.hypot((box.x1 - box.x0) * vK, (box.y1 - box.y0) * vK) < 4;
        const shiftMerge = marqueeShiftRef.current;

        if (isClickOnly) {
          let hitShape: BuiltShape | undefined;
          const visibleShapes = shapesRef.current.filter((sh) => {
            if (!sh.d) return false;
            const ph = phaseMapRef.current.get(sh.phaseId);
            return ph ? ph.showPath : true;
          });
          if (visibleShapes.length > 0 && typeof Path2D !== 'undefined') {
            const orderMap = new Map(phasesRef.current.map((p, idx) => [p.id, idx]));
            const orderedShapes = [...visibleShapes].sort(
              (a, b) => (orderMap.get(b.phaseId) ?? 0) - (orderMap.get(a.phaseId) ?? 0)
            );
            const testCanvas = document.createElement('canvas');
            const testCtx = testCanvas.getContext('2d');
            if (testCtx) {
              for (const sh of orderedShapes) {
                try {
                  if (testCtx.isPointInPath(new Path2D(sh.d), box.x0, box.y0, 'evenodd')) {
                    hitShape = sh;
                    break;
                  }
                } catch {
                  // ignore malformed path
                }
              }
            }
          }

          if (hitShape) {
            if (shiftMerge) {
              setSelectedShapeIds((prev) => {
                const next = new Set(prev);
                if (next.has(hitShape!.id)) next.delete(hitShape!.id);
                else next.add(hitShape!.id);
                return next;
              });
            } else {
              setSelectedShapeIds(new Set([hitShape.id]));
              setSelectedIds(new Set());
            }
          } else if (!shiftMerge) {
            setSelectedIds(new Set());
            setSelectedShapeIds(new Set());
          }
        } else {
          const minX = Math.min(box.x0, box.x1);
          const maxX = Math.max(box.x0, box.x1);
          const minY = Math.min(box.y0, box.y1);
          const maxY = Math.max(box.y0, box.y1);
          const curObjs = objsRef.current;
          const cCache = curveCacheRef.current;
          const vis = visibleHitIdsRef.current;
          const picked = new Set<number>(shiftMerge ? selectedIdsRef.current : []);

          for (const o of curObjs) {
            if (o.dead || !vis.has(o.id)) continue;
            if (o.t === 'pt' && o.ok) {
              if (o.x >= minX && o.x <= maxX && o.y >= minY && o.y <= maxY) {
                picked.add(o.id);
              }
            } else if (o.t === 'ci') {
              const cv = curve(curObjs, o, cCache);
              if (cv && cv.t === 'c') {
                if (cv.x + cv.r >= minX && cv.x - cv.r <= maxX && cv.y + cv.r >= minY && cv.y - cv.r <= maxY) {
                  if (cv.x >= minX && cv.x <= maxX && cv.y >= minY && cv.y <= maxY) {
                    picked.add(o.id);
                  }
                }
              }
            } else if (o.t === 'pg') {
              const cv = curve(curObjs, o, cCache);
              if (cv && cv.t === 'p') {
                if (cv.cx >= minX && cv.cx <= maxX && cv.cy >= minY && cv.cy <= maxY) {
                  picked.add(o.id);
                }
              }
            } else if (o.t === 'ln' && o.a !== undefined && o.b !== undefined) {
              const pa = getObj(curObjs, o.a);
              const pb = getObj(curObjs, o.b);
              if (
                pa &&
                pb &&
                pa.t === 'pt' &&
                pb.t === 'pt' &&
                pa.ok &&
                pb.ok &&
                pa.x >= minX &&
                pa.x <= maxX &&
                pa.y >= minY &&
                pa.y <= maxY &&
                pb.x >= minX &&
                pb.x <= maxX &&
                pb.y >= minY &&
                pb.y <= maxY
              ) {
                picked.add(o.id);
              }
            }
          }

          // Expand any selected grouped object to all visible members of its group
          const pickedGroups = new Set<string>();
          for (const pid of picked) {
            const po = getObj(curObjs, pid);
            if (po?.groupId) pickedGroups.add(po.groupId);
          }
          if (pickedGroups.size > 0) {
            for (const o of curObjs) {
              if (!o.dead && vis.has(o.id) && o.groupId && pickedGroups.has(o.groupId)) {
                picked.add(o.id);
              }
            }
          }

          setSelectedIds(picked);
          if (!shiftMerge) {
            setSelectedShapeIds(new Set());
          }
        }

        marqueeShiftRef.current = false;
        marqueeRef.current = null;
        setMarquee(null);
      }

      if (activeDragTanRef.current) {
        const cand = activeDragTanRef.current;
        activeDragTanRef.current = null;
        if (tanSnapEnabledRef.current) {
          const next = cloneObjs(objsRef.current);
          applyDragTangencySnap(next, cand);
          applyTangencyConnection(next, cand);
          setObjs(next);
        }
      }

      dragRef.current = null;
      panRef.current = null;
      imgDragRef.current = null;
      setHover(null);
      setDragTanOverlay(null);
      setSmartGuides([]);
      setIsPanning(false);
      setIsDragging(false);
    },
    [processPointerMove, pushHistory]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (toolRef.current !== 'move') return;
      const [x, y] = toWorld(e.clientX, e.clientY);
      const curObjs = objsRef.current;
      const vK = viewRef.current.k;
      const cCache = curveCacheRef.current;
      const vis = visibleHitIdsRef.current;
      const hit = curObjs.find((o) => {
        if (o.dead || !vis.has(o.id) || o.t !== 'ci') return false;
        const c = curve(curObjs, o, cCache);
        return c ? distToCurve(c, x, y) < 10 / vK : false;
      });
      if (!hit) return;
      if (isObjLocked(curObjs, hit.id)) {
        notifyLocked(hit.phaseId);
        return;
      }
      if (hit.t === 'ci' && hit.scaleLocked) {
        notifyNotice('Escala travada — desbloqueie para alterar o raio.');
        return;
      }
      const C = curve(curObjs, hit, cCache);
      if (!C || C.t !== 'c') return;
      const d = Math.hypot(x - C.x, y - C.y) || 1;
      const px = C.x + (C.r * (x - C.x)) / d;
      const py = C.y + (C.r * (y - C.y)) / d;
      const bad = descOf(curObjs, hit.id);
      const sn = safeSnap(
        curObjs,
        px,
        py,
        bad,
        vK,
        prioRef.current,
        snapPxRef.current,
        snapEnabledRef.current,
        cachedIntersRef.current,
        guidesVisibleRef.current ? guidesRef.current : undefined,
        cCache,
        allowedSnapIdsRef.current
      );
      setEdit({ id: hit.id, sn, ax: sn.x, ay: sn.y, bad });
      setPend([]);
      setGhost(null);
      setHover(null);
    },
    [isObjLocked, notifyLocked, notifyNotice, toWorld]
  );

  const zoomBy = useCallback((f: number) => {
    setView((prev) => {
      const { w, h } = sizeRef.current;
      const cx = prev.x + w / prev.k / 2;
      const cy = prev.y + h / prev.k / 2;
      const k = Math.min(200, Math.max(0.05, prev.k * f));
      return { x: cx - w / k / 2, y: cy - h / k / 2, k };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      setView((prev) => {
        const wx = prev.x + sx / prev.k;
        const wy = prev.y + sy / prev.k;
        const k = Math.min(200, Math.max(0.05, prev.k * Math.exp(-e.deltaY * 0.0015)));
        return { x: wx - sx / k, y: wy - sy / k, k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const loadImageSrc = useCallback((src: string) => {
    const im = new Image();
    im.onload = () => {
      const v = viewRef.current;
      const { w: sw, h: sh } = sizeRef.current;
      const k = Math.min(1, ((sw / v.k) * 0.8) / im.width, ((sh / v.k) * 0.8) / im.height);
      const w = im.width * k;
      const h = im.height * k;
      const offset = refImgsRef.current.length * 40;
      const newImg: RefImage = {
        id: `ref-${Date.now()}`,
        src,
        x: v.x + (sw / v.k - w) / 2 + offset,
        y: v.y + (sh / v.k - h) / 2 + offset,
        w,
        h,
        r: 0,
        opacity: 0.15,
        locked: false,
      };
      setRefImgs((prev) => [...prev, newImg]);
      setActiveRefId(newImg.id);
      setTool('move');
      setPend([]);
      setTcSel([]);
      setEdit(null);
      setGhost(null);
      setHover(null);
    };
    im.src = src;
  }, []);

  const handleUploadImage = useCallback(
    (file: File) => {
      const rd = new FileReader();
      rd.onload = () => {
        if (typeof rd.result === 'string') loadImageSrc(rd.result);
      };
      rd.readAsDataURL(file);
    },
    [loadImageSrc]
  );

  // Paste handler: prioritizes our own copied geometry payload, then clipboard image, then in-memory geometry
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      lastNativePasteAtRef.current = Date.now();
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (text.startsWith('compasso-geom:')) {
        try {
          const parsed = JSON.parse(text.slice('compasso-geom:'.length)) as CopiedSubgraph;
          if (parsed && Array.isArray(parsed.items) && parsed.anchor) {
            copiedRef.current = parsed;
            setHasClipboard(true);
          }
        } catch {
          // fall back to in-memory copiedRef
        }
        if (copiedRef.current) {
          e.preventDefault();
          pasteClipboard(false);
          return;
        }
      }
      const items = e.clipboardData?.items;
      if (items) {
        for (const it of items) {
          if (it.type.startsWith('image/')) {
            const f = it.getAsFile();
            if (f) handleUploadImage(f);
            e.preventDefault();
            return;
          }
        }
      }
      if (copiedRef.current) {
        e.preventDefault();
        pasteClipboard(false);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleUploadImage, pasteClipboard]);

  const handleChangeGridConfig = useCallback((patch: Partial<GridConfig>) => {
    setGridConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleCenterGridOrigin = useCallback(() => {
    const v = viewRef.current;
    const { w, h } = sizeRef.current;
    setGridConfig((prev) => ({
      ...prev,
      originX: v.x + w / (2 * v.k),
      originY: v.y + h / (2 * v.k),
    }));
  }, []);

  const handleGenerateFibGeometry = useCallback(
    (mode: 'squares' | 'circles' | 'both') => {
      const pid = activePhaseIdRef.current;
      if (isPhaseLocked(pid)) {
        notifyLocked(pid);
        return;
      }
      const tiles = computeFibonacciTiles(gridConfigRef.current);
      if (tiles.length === 0) return;
      pushHistory(objsRef.current);
      const next = cloneObjs(objsRef.current);
      const createdIds: number[] = [];
      for (const t of tiles) {
        const cId = addObj(next, { t: 'pt', free: true, x: t.cx, y: t.cy, phaseId: pid });
        if (mode === 'squares' || mode === 'both') {
          const pId = addObj(next, { t: 'pt', free: true, x: t.x + t.size, y: t.y + t.size, phaseId: pid });
          const pgId = addObj(next, { t: 'pg', c: cId, p: pId, sides: 4, phaseId: pid, scaleLocked: true });
          createdIds.push(pgId);
        }
        if (mode === 'circles' || mode === 'both') {
          const rPtId = addObj(next, { t: 'pt', free: true, x: t.cx + t.size / 2, y: t.cy, phaseId: pid });
          const ciId = addObj(next, { t: 'ci', c: cId, p: rPtId, phaseId: pid, scaleLocked: true });
          createdIds.push(ciId);
        }
      }
      setObjs(next);
      setSelectedIds(new Set(createdIds));
      setTool('move');
      setShowGridPanel(false);
    },
    [isPhaseLocked, notifyLocked, pushHistory]
  );

  const selectTool = useCallback((nextTool: ToolId) => {
    setTool(nextTool);
    setAlignPopoverOpen(false);
    setEdit(null);
    setPend([]);
    setTcSel([]);
    setTanSel([]);
    setHoveredTanTarget(null);
    setHoveredSelTanCand(null);
    setHoveredResizeGrip(false);
    setDragTanOverlay(null);
    setSmartGuides([]);
    activeDragTanRef.current = null;
    setTanVariantIdx(0);
    setTanVariantCount(0);
    setHoveredShapeRegionId(null);
    setDragShapeRegionIds(new Set());
    shapeDragRef.current = null;
    setGhost(null);
    setHover(null);
    setRulerStart(null);
    setHoveredGuideKind(null);
    setEditingDim(null);
    setDimError(null);
    if (nextTool !== 'move') {
      setSelectedShapeIds(new Set());
    }
  }, []);

  const handleChangeLineMode = useCallback((nextMode: LineToolMode) => {
    setLineMode(nextMode);
    lineModeRef.current = nextMode;
    setPend([]);
    setTcSel([]);
    setGhost(null);
    setHover(null);
    if (nextMode === 'tangent') {
      setTgOn(true);
      setTanSnapEnabled(true);
    } else {
      setTgOn(false);
    }
  }, []);

  const handleChangeCircleMode = useCallback((nextMode: CircleToolMode) => {
    setCircleMode(nextMode);
    circleModeRef.current = nextMode;
    setPend([]);
    setTanSel([]);
    setHoveredTanTarget(null);
    setTanVariantIdx(0);
    setTanVariantCount(0);
    setGhost(null);
    setHover(null);
    if (nextMode === 'top-left') {
      setCreationOrigin('top-left');
      creationOriginRef.current = 'top-left';
    } else if (nextMode === 'center') {
      setCreationOrigin('center');
      creationOriginRef.current = 'center';
    }
  }, []);

  const handleChangeCreationOrigin = useCallback((origin: CreationOrigin) => {
    setCreationOrigin(origin);
    creationOriginRef.current = origin;
    if (circleModeRef.current === 'center' || circleModeRef.current === 'top-left') {
      const nextCm: CircleToolMode = origin === 'top-left' ? 'top-left' : 'center';
      setCircleMode(nextCm);
      circleModeRef.current = nextCm;
    }
  }, []);

  const handleToggleTg = useCallback(() => {
    setTgOn((prev) => {
      const nextVal = !prev;
      if (nextVal) setTanSnapEnabled(true);
      if (toolRef.current === 'ln') {
        if (nextVal && lineModeRef.current === 'free') {
          setLineMode('tangent');
          lineModeRef.current = 'tangent';
        } else if (!nextVal && lineModeRef.current === 'tangent') {
          setLineMode('free');
          lineModeRef.current = 'free';
        }
      }
      return nextVal;
    });
  }, []);

  const handleSelectPhase = useCallback((id: string) => {
    setActivePhaseId(id);
    setPend([]);
    setTcSel([]);
    setTanSel([]);
    setEdit(null);
    setGhost(null);
    setHoveredShapeRegionId(null);
    setDragShapeRegionIds(new Set());
    setLockNotice(null);
  }, []);

  const handleAddPhase = useCallback(() => {
    const nextIdx = phasesRef.current.length;
    const preset = NEW_PHASE_PRESETS[(nextIdx - 2 + NEW_PHASE_PRESETS.length) % NEW_PHASE_PRESETS.length];
    const paletteColor = PHASE_COLOR_PALETTE[nextIdx % PHASE_COLOR_PALETTE.length]?.hex ?? preset.color;
    const newPhase: Phase = {
      id: `phase-${++phaseCounterRef.current}`,
      name: nextIdx < 2 + NEW_PHASE_PRESETS.length ? preset.name : `Fase ${nextIdx + 1}`,
      color: nextIdx < 2 + NEW_PHASE_PRESETS.length ? preset.color : paletteColor,
      showGeometry: true,
      geometryOpacity: 1,
      showPath: true,
      pathOpacity: 0.6,
      locked: false,
    };
    pushHistory(objsRef.current);
    setPhases((prev) => [...prev, newPhase]);
    setActivePhaseId(newPhase.id);
    setLockNotice(null);
  }, [pushHistory]);

  const handleUpdatePhase = useCallback((id: string, patch: Partial<Phase>) => {
    setPhases((prev) => prev.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)));
    if (patch.locked === false && id === activePhaseIdRef.current) {
      setLockNotice(null);
    }
  }, []);

  const handleRequestDeletePhase = useCallback((phaseId: string) => {
    const curPhases = phasesRef.current;
    if (curPhases.length <= 1) return;
    const ph = curPhases.find((p) => p.id === phaseId);
    if (!ph) return;
    const curObjs = objsRef.current;
    const defId = curPhases[0].id;

    const phaseObjIds = new Set<number>();
    for (const o of curObjs) {
      if (!o.dead && (o.phaseId ?? defId) === phaseId) {
        phaseObjIds.add(o.id);
      }
    }
    const crossDependentIds = new Set<number>();
    for (const pid of phaseObjIds) {
      for (const did of descOf(curObjs, pid)) {
        if (!phaseObjIds.has(did)) crossDependentIds.add(did);
      }
    }
    const shapeCount = shapesRef.current.filter((s) => s.phaseId === phaseId).length;
    setConfirmDialog({
      kind: 'phase-delete',
      phaseId,
      phaseName: ph.name,
      objCount: phaseObjIds.size,
      shapeCount,
      crossDepsCount: crossDependentIds.size,
    });
  }, []);

  const executeDeletePhase = useCallback(
    (phaseId: string) => {
      const curPhases = phasesRef.current;
      if (curPhases.length <= 1) return;
      const idx = curPhases.findIndex((p) => p.id === phaseId);
      if (idx < 0) return;
      const defId = curPhases[0].id;
      const remainingPhases = curPhases.filter((p) => p.id !== phaseId);
      const fallbackActiveId =
        activePhaseIdRef.current === phaseId
          ? remainingPhases[Math.max(0, idx - 1)].id
          : activePhaseIdRef.current;

      pushHistory(objsRef.current);
      const nextObjs = cloneObjs(objsRef.current);
      for (const o of nextObjs) {
        if (!o.dead && (o.phaseId ?? defId) === phaseId) {
          killObj(nextObjs, o.id);
        } else if (!o.dead && o.phaseId === undefined) {
          o.phaseId = defId;
        }
      }
      setObjs(nextObjs);
      setShapes((prev) => prev.filter((s) => s.phaseId !== phaseId));
      setPhases(remainingPhases);
      setActivePhaseId(fallbackActiveId);
      setSelectedIds(new Set());
      setPend([]);
      setTcSel([]);
      setTanSel([]);
      setEdit(null);
      setGhost(null);
      setConfirmDialog(null);
    },
    [pushHistory]
  );

  const handleMoveSelectedToPhase = useCallback(
    (targetPhaseId: string) => {
      if (selectedIdsRef.current.size === 0) return;
      pushHistory(objsRef.current);
      const next = cloneObjs(objsRef.current);
      for (const id of selectedIdsRef.current) {
        const o = getObj(next, id);
        if (!o || o.dead) continue;
        o.phaseId = targetPhaseId;
        // Also bring direct defining endpoints if they are not curves
        for (const rid of refsOf(o)) {
          const ro = getObj(next, rid);
          if (ro && !ro.dead && ro.t === 'pt') {
            ro.phaseId = targetPhaseId;
          }
        }
      }
      setObjs(next);
      setActivePhaseId(targetPhaseId);
    },
    [pushHistory]
  );

  const handleClearPhaseShapes = useCallback(() => {
    const pid = activePhaseIdRef.current;
    if (isPhaseLocked(pid)) {
      notifyLocked(pid);
      return;
    }
    const hasAny = shapesRef.current.some((s) => s.phaseId === pid);
    if (!hasAny) return;
    pushHistory(objsRef.current);
    setShapes((prev) => prev.filter((s) => s.phaseId !== pid));
  }, [isPhaseLocked, notifyLocked, pushHistory]);

  const handleReleaseTangency = useCallback(
    (mode: 'one' | 'all') => {
      if (selectedIdsRef.current.size !== 1) return;
      const onlyId = Array.from(selectedIdsRef.current)[0];
      if (isObjLocked(objsRef.current, onlyId)) {
        notifyLocked(getObj(objsRef.current, onlyId)?.phaseId);
        return;
      }
      const res = releaseTangency(objsRef.current, onlyId, mode);
      if (res.ok && res.next) {
        pushHistory(objsRef.current);
        setObjs(res.next);
        setHoveredResizeGrip(false);
      }
    },
    [isObjLocked, notifyLocked, pushHistory]
  );

  const handleSwapSelectionOrder = useCallback(() => {
    const arr = Array.from(selectedIdsRef.current);
    if (arr.length !== 2) return;
    setSelectedIds(new Set([arr[1], arr[0]]));
    setHoveredSelTanCand(null);
  }, []);

  const handleCreateTanCircle = useCallback(() => {
    const curTan = tanSelRef.current;
    if (curTan.length < 2) return;
    const [wx, wy] = lastWorldRef.current;
    const sols = solveMultiTangent(objsRef.current, curTan, wx, wy, curveCacheRef.current);
    if (sols.length > 0) {
      commitTanCircle(curTan, sols[tanVariantIdxRef.current % sols.length]);
    }
  }, [commitTanCircle]);

  const handleCycleTanVariant = useCallback(() => {
    setTanVariantIdx((prev) => {
      const next = prev + 1;
      tanVariantIdxRef.current = next;
      computePreview(lastWorldRef.current[0], lastWorldRef.current[1], false, false);
      return next;
    });
  }, [computePreview]);

  const handleStartTanFromSelection = useCallback(() => {
    const targets: TanTargetSel[] = [];
    const [wx, wy] = lastWorldRef.current;
    for (const id of selectedIdsRef.current) {
      if (targets.length >= 4) break;
      const o = getObj(objsRef.current, id);
      if (!o || o.dead || (o.t !== 'ci' && o.t !== 'ln' && o.t !== 'pg')) continue;
      const cv = curve(objsRef.current, o, curveCacheRef.current);
      if (!cv) continue;
      if (cv.t === 'p') {
        const near = nearestPolyEdge(cv, wx, wy);
        targets.push({
          id,
          hx: near ? near.line.x : cv.cx,
          hy: near ? near.line.y : cv.cy,
          edge: near?.edge ?? 0,
        });
      } else {
        targets.push({ id, hx: cv.x, hy: cv.y });
      }
    }
    if (targets.length < 2) return;
    setSelectedIds(new Set());
    setSelectedShapeIds(new Set());
    setTool('ci');
    toolRef.current = 'ci';
    setCircleMode('tangent');
    circleModeRef.current = 'tangent';
    tanSelRef.current = targets;
    setTanSel(targets);
    setTanVariantIdx(0);
    tanVariantIdxRef.current = 0;
    computePreview(lastWorldRef.current[0], lastWorldRef.current[1], false, false);
  }, [computePreview]);

  const cycleDimMode = useCallback(() => {
    setDimMode((prev) => (prev === 'd' ? 'r' : prev === 'r' ? 'off' : 'd'));
    setEditingDim(null);
    setDimError(null);
  }, []);

  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      if (selectedGuideIdRef.current && !guidesLockedRef.current) {
        const gid = selectedGuideIdRef.current;
        pushHistory(objsRef.current);
        setGuides((prev) =>
          prev.map((g) => {
            if (g.id !== gid) return g;
            if (g.kind === 'h') return { ...g, y: g.y + dy };
            if (g.kind === 'v') return { ...g, x: g.x + dx };
            return { ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy };
          })
        );
        return;
      }
      if (selectedIdsRef.current.size === 0) return;
      const curObjs = objsRef.current;
      const movableIds = movableRootPointsForSelection(curObjs, selectedIdsRef.current).filter(
        (id) => !isObjLocked(curObjs, id)
      );
      if (movableIds.length === 0) return;
      pushHistory(curObjs);
      const next = cloneObjs(curObjs);
      for (const pid of movableIds) {
        const pt = next[pid];
        if (pt && pt.t === 'pt' && pt.free) {
          pt.x += dx;
          pt.y += dy;
        }
      }
      recalc(next);
      setObjs(next);
    },
    [isObjLocked, pushHistory]
  );

  useEffect(() => {
    const isBackquote = (e: KeyboardEvent) =>
      e.code === 'Backquote' || e.key === '`' || e.key === '´';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (isBackquote(e)) {
        setBackquoteDown(true);
        return;
      }
      if (e.key === 'Shift') {
        setShiftDown(true);
        computePreview(lastWorldRef.current[0], lastWorldRef.current[1], true, e.altKey);
      }
      if (e.key === 'Alt') {
        setAltDown(true);
        computePreview(lastWorldRef.current[0], lastWorldRef.current[1], e.shiftKey, true);
      }
      if (e.code === 'Space') {
        setSpaceDown(true);
        e.preventDefault();
      }
      const kl = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (kl === 'z' || e.code === 'KeyZ')) {
        e.preventDefault();
        if (e.shiftKey) redoF();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (kl === 'y' || e.code === 'KeyY')) {
        e.preventDefault();
        redoF();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (kl === 'c' || e.code === 'KeyC')) {
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          copySelected();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (kl === 'v' || e.code === 'KeyV')) {
        // Fallback for browsers/iframes that block native `paste` events when no input is focused
        const pressedAt = Date.now();
        window.setTimeout(() => {
          if (lastNativePasteAtRef.current < pressedAt - 50 && copiedRef.current) {
            pasteClipboard(false);
          }
        }, 45);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (kl === 'd' || e.code === 'KeyD')) {
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          duplicateSelected();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (kl === 'a' || e.code === 'KeyA')) {
        e.preventDefault();
        const vis = visibleHitIdsRef.current;
        const all = new Set<number>();
        for (const o of objsRef.current) {
          if (!o.dead && vis.has(o.id)) all.add(o.id);
        }
        setSelectedIds(all);
        setTool('move');
        return;
      }
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        !editingDimRef.current &&
        (selectedIdsRef.current.size > 0 || selectedGuideIdRef.current !== null)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : e.altKey ? 0.25 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudgeSelection(dx, dy);
        return;
      }
      if (
        e.key === 'Enter' &&
        toolRef.current === 'ci' &&
        circleModeRef.current === 'tangent' &&
        tanSelRef.current.length >= 2 &&
        !editingDimRef.current
      ) {
        e.preventDefault();
        handleCreateTanCircle();
        return;
      }
      if (
        e.key === 'Tab' &&
        toolRef.current === 'ci' &&
        circleModeRef.current === 'tangent' &&
        tanSelRef.current.length >= 2
      ) {
        e.preventDefault();
        handleCycleTanVariant();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editRef.current) {
        if (
          toolRef.current === 'ci' &&
          circleModeRef.current === 'tangent' &&
          tanSelRef.current.length > 0 &&
          selectedIdsRef.current.size === 0
        ) {
          e.preventDefault();
          const nextSel = tanSelRef.current.slice(0, -1);
          tanSelRef.current = nextSel;
          setTanSel(nextSel);
          setTanVariantIdx(0);
          computePreview(lastWorldRef.current[0], lastWorldRef.current[1], e.shiftKey, e.altKey);
          return;
        }
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          deleteSelected();
          return;
        }
        if (selectedShapeIdsRef.current.size > 0) {
          e.preventDefault();
          handleDeleteSelectedShapes();
          return;
        }
        if (selectedGuideIdRef.current && !guidesLockedRef.current) {
          e.preventDefault();
          const delId = selectedGuideIdRef.current;
          pushHistory(objsRef.current);
          setGuides((prev) => prev.filter((g) => g.id !== delId));
          setSelectedGuideId(null);
          return;
        }
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') {
          selectTool('move');
        } else if (k === 'l') {
          selectTool('ln');
          handleChangeLineMode('free');
        } else if (k === 't') {
          selectTool('ln');
          handleChangeLineMode('common');
        } else if (k === 'c') {
          selectTool('ci');
          if (circleModeRef.current === 'diameter' || circleModeRef.current === 'tangent') {
            handleChangeCircleMode(creationOriginRef.current === 'top-left' ? 'top-left' : 'center');
          }
        } else if (k === 'b') {
          selectTool('ci');
          handleChangeCircleMode('diameter');
        } else if (k === 'a') {
          selectTool('ci');
          handleChangeCircleMode('tangent');
        } else if (k === 'q') {
          selectTool('pg');
        } else if (k === 'f') {
          selectTool('shape');
        } else if (k === 'u') {
          selectTool('ruler');
        } else if (k === 'x') {
          selectTool('del');
        } else if (k === '[') {
          const curPh = phasesRef.current;
          const idx = curPh.findIndex((p) => p.id === activePhaseIdRef.current);
          if (idx > 0) handleSelectPhase(curPh[idx - 1].id);
        } else if (k === ']') {
          const curPh = phasesRef.current;
          const idx = curPh.findIndex((p) => p.id === activePhaseIdRef.current);
          if (idx >= 0 && idx + 1 < curPh.length) handleSelectPhase(curPh[idx + 1].id);
        } else if (k === 's') {
          handleToggleTg();
        } else if (k === 'g') {
          setSnapEnabled((prev) => !prev);
        } else if (k === 'e') {
          setTanSnapEnabled((prev) => !prev);
        } else if (k === 'h') {
          setShowGridPanel((prev) => {
            const nextVal = !prev;
            if (nextVal) setShowHelp(false);
            return nextVal;
          });
        } else if (k === 'r') {
          setShowRulers((prev) => !prev);
        } else if (k === 'k') {
          setGuidesLocked((prev) => !prev);
        } else if (k === 'd') {
          cycleDimMode();
        } else if (k === '0') {
          setView({ x: 0, y: 0, k: 1 });
        } else if (k === '+' || k === '=') {
          zoomBy(1.4);
        } else if (k === '-') {
          zoomBy(1 / 1.4);
        } else if (k === '?') {
          setShowHelp((prev) => {
            const nextVal = !prev;
            if (nextVal) setShowGridPanel(false);
            return nextVal;
          });
        }
      }
      if (e.key === 'Escape') {
        setConfirmDialog(null);
        if (
          !editRef.current &&
          pendRef.current.length === 0 &&
          tcSelRef.current.length === 0 &&
          tanSelRef.current.length === 0 &&
          selectedIdsRef.current.size === 0 &&
          selectedShapeIdsRef.current.size === 0 &&
          !rulerStartRef.current &&
          !editingDimRef.current
        ) {
          setPrio(new Set());
          setPrioMode(false);
        }
        setSelectedIds(new Set());
        setSelectedShapeIds(new Set());
        setAlignPopoverOpen(false);
        setSelectedGuideId(null);
        setHoveredSelTanCand(null);
        setHoveredResizeGrip(false);
        setDragTanOverlay(null);
        setSmartGuides([]);
        activeDragTanRef.current = null;
        setEdit(null);
        setPend([]);
        setTcSel([]);
        setTanSel([]);
        setHoveredTanTarget(null);
        setTanVariantIdx(0);
        setTanVariantCount(0);
        setHoveredShapeRegionId(null);
        setDragShapeRegionIds(new Set());
        shapeDragRef.current = null;
        setGhost(null);
        setRulerStart(null);
        setEditingDim(null);
        setDimError(null);
        setShowHelp(false);
        setShowGridPanel(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isBackquote(e)) {
        setBackquoteDown(false);
      }
      if (e.key === 'Shift') {
        setShiftDown(false);
        computePreview(lastWorldRef.current[0], lastWorldRef.current[1], false, e.altKey);
      }
      if (e.key === 'Alt') {
        setAltDown(false);
        computePreview(lastWorldRef.current[0], lastWorldRef.current[1], e.shiftKey, false);
      }
      if (e.code === 'Space') {
        setSpaceDown(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    computePreview,
    copySelected,
    cycleDimMode,
    deleteSelected,
    duplicateSelected,
    handleChangeCircleMode,
    handleChangeLineMode,
    handleCreateTanCircle,
    handleCycleTanVariant,
    handleDeleteSelectedShapes,
    handleSelectPhase,
    handleToggleTg,
    nudgeSelection,
    pasteClipboard,
    pushHistory,
    redoF,
    selectTool,
    undo,
    zoomBy,
  ]);

  const executeLoadDemo = useCallback(() => {
    pushHistory(objsRef.current);
    const pid = activePhaseIdRef.current;
    const demo = createDemoObjs(viewRef.current, sizeRef.current.w, sizeRef.current.h).map((o) => ({
      ...o,
      phaseId: pid,
    }));
    setObjs(demo);
    setShapes([]);
    setPend([]);
    setTcSel([]);
    setTanSel([]);
    setHoveredTanTarget(null);
    setHoveredSelTanCand(null);
    setHoveredResizeGrip(false);
    setDragTanOverlay(null);
    setSmartGuides([]);
    activeDragTanRef.current = null;
    setTanVariantIdx(0);
    setTanVariantCount(0);
    setEdit(null);
    setSelectedIds(new Set());
    setSelectedShapeIds(new Set());
    setPrio(new Set());
    setGhost(null);
    setRulerStart(null);
    setEditingDim(null);
    setDimError(null);
    setConfirmDialog(null);
  }, [pushHistory]);

  const executeClear = useCallback(() => {
    pushHistory(objsRef.current);
    setObjs([]);
    setShapes([]);
    setPend([]);
    setTcSel([]);
    setTanSel([]);
    setHoveredTanTarget(null);
    setHoveredSelTanCand(null);
    setHoveredResizeGrip(false);
    setDragTanOverlay(null);
    setSmartGuides([]);
    activeDragTanRef.current = null;
    setTanVariantIdx(0);
    setTanVariantCount(0);
    setEdit(null);
    setSelectedIds(new Set());
    setSelectedShapeIds(new Set());
    setPrio(new Set());
    setGhost(null);
    setRulerStart(null);
    setEditingDim(null);
    setDimError(null);
    setConfirmDialog(null);
  }, [pushHistory]);

  const handleLoadDemo = useCallback(() => {
    const hasWork = objsRef.current.some((o) => !o.dead) || shapesRef.current.length > 0;
    if (hasWork) {
      setConfirmDialog({ kind: 'demo' });
      return;
    }
    executeLoadDemo();
  }, [executeLoadDemo]);

  const handleClear = useCallback(() => {
    const hasWork = objsRef.current.some((o) => !o.dead) || shapesRef.current.length > 0;
    if (hasWork) {
      setConfirmDialog({ kind: 'clear' });
      return;
    }
    executeClear();
  }, [executeClear]);

  const handleExportSvg = useCallback(
    (withBg: boolean) => {
      const overlap = svgOverlap ? DEFAULT_SVG_OVERLAP_PX : 0;
      const svgText = makeSVG(
        objsRef.current,
        viewRef.current,
        sizeRef.current.w,
        sizeRef.current.h,
        withBg,
        overlap,
        { phases: phasesRef.current, shapes: shapesRef.current, layers: svgExportLayers }
      );
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = withBg ? 'construcao.svg' : 'construcao-transparente.svg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    [svgExportLayers, svgOverlap]
  );

  const interCount = useMemo(
    () => objs.filter((o) => !o.dead && o.t === 'pt' && !o.free && o.ok).length,
    [objs]
  );

  const effectiveSnapActive = snapEnabled && !altDown;
  const activePhaseIdx = Math.max(0, phases.findIndex((p) => p.id === activePhaseId));

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      <Toolbar
        tool={tool}
        onSelectTool={selectTool}
        prioMode={prioMode}
        backquoteDown={backquoteDown}
        onTogglePrioMode={() => setPrioMode((p) => !p)}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((p) => !p)}
        tanSnapEnabled={tanSnapEnabled}
        onToggleTanSnap={() => setTanSnapEnabled((p) => !p)}
        snapPx={snapPx}
        onChangeSnapPx={setSnapPx}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers((p) => !p)}
        gridConfig={gridConfig}
        showGridPanel={showGridPanel}
        onToggleGridPanel={() => {
          setShowGridPanel((p) => {
            const nextVal = !p;
            if (nextVal) setShowHelp(false);
            return nextVal;
          });
        }}
        dimMode={dimMode}
        onCycleDimMode={cycleDimMode}
        svgOverlap={svgOverlap}
        onToggleSvgOverlap={() => setSvgOverlap((p) => !p)}
        svgExportLayers={svgExportLayers}
        onChangeSvgExportLayers={setSvgExportLayers}
        canUndo={histLen > 0}
        canRedo={redoLen > 0}
        onUndo={undo}
        onRedo={redoF}
        zoomPct={Math.round(view.k * 100)}
        onZoomIn={() => zoomBy(1.4)}
        onZoomOut={() => zoomBy(1 / 1.4)}
        onZoomReset={() => setView({ x: 0, y: 0, k: 1 })}
        onLoadDemo={handleLoadDemo}
        onClear={handleClear}
        onExportSvg={handleExportSvg}
        onUploadImage={handleUploadImage}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        showHelp={showHelp}
        onToggleHelp={() => {
          setShowHelp((p) => {
            const nextVal = !p;
            if (nextVal) setShowGridPanel(false);
            return nextVal;
          });
        }}
      />

      <div className="relative flex-1 min-h-0 flex">
        <CanvasStage
          svgRef={svgRef}
          objs={objs}
          curveCache={curveCache}
          view={view}
          size={size}
          tool={tool}
          dark={dark}
          pend={pend}
          tcSel={tcSel}
          tanSel={tanSel}
          hoveredTanTarget={hoveredTanTarget}
          tanVariantIdx={tanVariantIdx}
          tanVariantCount={tanVariantCount}
          selectedIds={selectedIds}
          selectedShapeIds={selectedShapeIds}
          prio={prio}
          edit={edit}
          hover={hover}
          ghost={ghost}
          marquee={marquee}
          smartGuides={smartGuides}
          dimMode={dimMode}
          hasClipboard={hasClipboard}
          refImgs={refImgs}
          activeRefId={activeRefId}
          onSelectRefImg={setActiveRefId}
          onToggleRefLock={(id) =>
            setRefImgs((prev) => prev.map((img) => (img.id === id ? { ...img, locked: !img.locked } : img)))
          }
          onRemoveRefImage={(id) => {
            setRefImgs((prev) => prev.filter((img) => img.id !== id));
            if (activeRefId === id) setActiveRefId(null);
          }}
          onChangeRefOpacity={(id, opacity) =>
            setRefImgs((prev) => prev.map((img) => (img.id === id ? { ...img, opacity } : img)))
          }
          showRulers={showRulers}
          guides={guides}
          guidesVisible={guidesVisible}
          guidesLocked={guidesLocked}
          selectedGuideId={selectedGuideId}
          hoveredGuideKind={hoveredGuideKind}
          guidePreview={guidePreview}
          rulerStart={rulerStart}
          cursorWorld={cursorWorld}
          spaceDown={spaceDown}
          altDown={altDown}
          isPanning={isPanning}
          isDragging={isDragging}
          editingDim={editingDim}
          dimDraft={dimDraft}
          dimError={dimError}
          gridConfig={gridConfig}
          showGridPanel={showGridPanel}
          lineMode={lineMode}
          onChangeLineMode={handleChangeLineMode}
          circleMode={circleMode}
          onChangeCircleMode={handleChangeCircleMode}
          tgActive={tgOn}
          shiftDown={shiftDown}
          onToggleTg={handleToggleTg}
          polySides={polySides}
          creationOrigin={creationOrigin}
          onChangeCreationOrigin={handleChangeCreationOrigin}
          tanSnapEnabled={tanSnapEnabled}
          phases={phases}
          activePhaseId={activePhaseId}
          focusMode={focusMode}
          crossPhaseSnap={crossPhaseSnap}
          countsByPhase={countsByPhase}
          shapes={shapes}
          shapeMode={shapeMode}
          shapeScope={shapeScope}
          shapeRegions={shapeArrangement?.regions ?? []}
          hoveredShapeRegionId={hoveredShapeRegionId}
          dragShapeRegionIds={dragShapeRegionIds}
          dragShapePreviewPath={dragShapePreviewPath}
          lockNotice={lockNotice}
          onOpenDimEditor={handleOpenDimEditor}
          onChangeDimDraft={(v) => {
            setDimDraft(v);
            if (dimError) setDimError(null);
          }}
          onCommitDimEdit={handleCommitDimEdit}
          onCancelDimEdit={handleCancelDimEdit}
          onChangeGridConfig={handleChangeGridConfig}
          onCenterGridOrigin={handleCenterGridOrigin}
          onGenerateFibGeometry={handleGenerateFibGeometry}
          onCloseGridPanel={() => setShowGridPanel(false)}
          onChangePolySides={setPolySides}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onStartRulerGuide={handleStartRulerGuide}
          onToggleGuidesVisible={() => setGuidesVisible((p) => !p)}
          onToggleGuidesLocked={() => setGuidesLocked((p) => !p)}
          onDeleteSelectedGuide={() => {
            if (guidesLockedRef.current || !selectedGuideIdRef.current) return;
            const id = selectedGuideIdRef.current;
            pushHistory(objsRef.current);
            setGuides((prev) => prev.filter((g) => g.id !== id));
            setSelectedGuideId(null);
          }}
          onClearGuides={() => {
            if (guidesLockedRef.current || guidesRef.current.length === 0) return;
            pushHistory(objsRef.current);
            setGuides([]);
            setSelectedGuideId(null);
          }}
          onCopySelected={copySelected}
          onPasteClipboard={() => pasteClipboard(true)}
          onDuplicateSelected={duplicateSelected}
          onDeleteSelected={deleteSelected}
          onClearSelection={() => setSelectedIds(new Set())}
          onDeleteSelectedShapes={handleDeleteSelectedShapes}
          onMoveSelectedShapesToPhase={handleMoveSelectedShapesToPhase}
          onClearShapeSelection={() => setSelectedShapeIds(new Set())}
          onClearPrio={() => {
            setPrio(new Set());
            setPrioMode(false);
          }}
          onCancelEdit={() => {
            setEdit(null);
            setGhost(null);
          }}
          onCreateTanCircle={handleCreateTanCircle}
          onCycleTanVariant={handleCycleTanVariant}
          onClearTanSel={() => {
            setTanSel([]);
            setHoveredTanTarget(null);
            setTanVariantIdx(0);
            setTanVariantCount(0);
            setGhost(null);
          }}
          onStartTanFromSelection={handleStartTanFromSelection}
          selTanCandidates={selTanCandidates}
          hoveredSelTanCand={hoveredSelTanCand}
          dragTanOverlay={dragTanOverlay}
          onSwapSelectionOrder={handleSwapSelectionOrder}
          selectedEditInfo={selectedEditInfo}
          selectedConstraintInfo={selectedConstraintInfo}
          hoveredResizeGrip={hoveredResizeGrip}
          onReleaseTangency={handleReleaseTangency}
          onChangeShapeMode={setShapeMode}
          onChangeShapeScope={setShapeScope}
          onClearPhaseShapes={handleClearPhaseShapes}
          onMoveSelectedToPhase={handleMoveSelectedToPhase}
          onUnlockActivePhase={() => {
            handleUpdatePhase(activePhaseId, { locked: false });
          }}
          onSelectPhase={handleSelectPhase}
          onAddPhase={handleAddPhase}
          onUpdatePhase={handleUpdatePhase}
          onRequestDeletePhase={handleRequestDeletePhase}
          onToggleFocusMode={() => setFocusMode((p) => !p)}
          onToggleCrossPhaseSnap={() => setCrossPhaseSnap((p) => !p)}
          alignPopoverOpen={alignPopoverOpen}
          onToggleAlignPopover={() => setAlignPopoverOpen((p) => !p)}
          onAlignSelection={handleAlignSelection}
          onDistributeSelection={handleDistributeSelection}
          onGroupSelection={handleGroupSelection}
          onUngroupSelection={handleUngroupSelection}
          onCombineSelectedShapes={handleCombineSelectedShapes}
          onMirrorSelection={handleMirrorSelection}
          onRadialArraySelection={handleRadialArraySelection}
          onToggleScaleLockSelection={handleToggleScaleLockSelection}
        />

        {/* Compact quick-reference popover */}
        {showHelp && (
          <aside
            aria-label="Atalhos e guia rápido"
            className="absolute top-3 right-3 z-20 w-96 max-w-[calc(100vw-24px)] max-h-[calc(100%-24px)] overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl p-4 text-xs text-slate-700 dark:text-zinc-300 space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Guia rápido de uso
              </h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="Fechar guia"
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 leading-relaxed">
              <p>
                <strong className="text-slate-900 dark:text-zinc-100">Seleção em caixa &amp; Mover (V):</strong>{' '}
                clique e arraste no canvas vazio para selecionar vários objetos (segure <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">Shift</kbd> para somar à seleção). Para mover a tela (pan), use <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">Espaço</kbd>+arrastar ou botão do meio.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-zinc-100">Menu Freeform &amp; Simetria:</strong>{' '}
                ao selecionar <span className="font-mono">1+</span> objetos, use a cápsula flutuante para <strong>Travar escala</strong>, <strong>Alinhar</strong>, <strong>Distribuir</strong>, <strong>Agrupar</strong>, <strong>Combinar Formas</strong>, <strong>Espelhar (H/V)</strong> e gerar <strong>Matriz radial (4×/6×/8×)</strong>.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-zinc-100">Reta (L / S / T) &amp; Círculo (C / B / A):</strong>{' '}
                use a cápsula contextual para alternar os submodos de <strong>Reta</strong> (Livre, Tangente <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">S</kbd>, Tang. comum <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">T</kbd>) e <strong>Círculo</strong> (Centro, Sup. esq., Diâmetro <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">B</kbd>, Tangente <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">A</kbd>).
              </p>
              <p>
                <strong className="text-slate-900 dark:text-zinc-100">Polígonos (Q) &amp; Grid (H):</strong>{' '}
                desenhe a partir do <strong>Centro</strong> ou <strong>Sup. esq.</strong> e pressione <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">H</kbd> para <strong>Grid Fibonacci</strong>, <strong>Modular</strong>, <strong>Isométrico</strong>, <strong>Áureo (φ)</strong> ou <strong>Polar</strong>.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-zinc-100">Copiar e Colar ({modKey}+C / {modKey}+V):</strong>{' '}
                copie círculos, polígonos e retas selecionados com <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">{modKey}+C</kbd>, cole com <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">{modKey}+V</kbd>, duplique com <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">{modKey}+D</kbd> ou apague com <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">{delKey}</kbd>.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-zinc-100">Construtor de Forma (F) &amp; Formas construídas:</strong>{' '}
                clique ou arraste sobre regiões fechadas para criar um path na fase ativa (<kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">{optKey}</kbd> subtrai). Em <strong>Mover (V)</strong>, clique dentro de um path para selecioná-lo, movê-lo de fase ou excluí-lo.
              </p>
              <p>
                <strong className="text-purple-700 dark:text-purple-400">
                  Tangência (roxo), Guias inteligentes (rosa) &amp; Snap (E / G):
                </strong>{' '}
                todos os objetos conversam com o snap de tangência (<kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">E</kbd>) e exibem guias inteligentes de alinhamento ao arrastar.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-zinc-100">Réguas (U / R / K) &amp; Exportar SVG:</strong>{' '}
                arraste das réguas para guias H/V, use <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">U</kbd> para guias inclinadas e <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">K</kbd> para travar (com Desfazer/Refazer). No menu <strong>SVG</strong>, filtre entre <strong>Tudo</strong>, <strong>Só Paths</strong> ou <strong>Construção</strong>.
              </p>
            </div>
          </aside>
        )}

        {/* Safety Confirmation Dialog (Delete Phase / Clear Canvas / Load Demo) */}
        {confirmDialog && (
          <div
            role="presentation"
            onClick={() => setConfirmDialog(null)}
            className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[1px] flex items-center justify-center p-4"
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-desc"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <h2
                    id="confirm-dialog-title"
                    className="text-sm font-semibold text-slate-900 dark:text-zinc-100"
                  >
                    {confirmDialog.kind === 'phase-delete'
                      ? `Excluir fase "${confirmDialog.phaseName}"?`
                      : confirmDialog.kind === 'clear'
                        ? 'Limpar todo o desenho?'
                        : 'Substituir pelo exemplo?'}
                  </h2>
                  <p
                    id="confirm-dialog-desc"
                    className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300"
                  >
                    {confirmDialog.kind === 'phase-delete' ? (
                      <>
                        Esta ação removerá{' '}
                        <strong className="font-mono tabular-nums">
                          {confirmDialog.objCount} elemento(s)
                        </strong>{' '}
                        de geometria e{' '}
                        <strong className="font-mono tabular-nums">
                          {confirmDialog.shapeCount} forma(s)
                        </strong>{' '}
                        desta fase.
                        {confirmDialog.crossDepsCount > 0 && (
                          <>
                            {' '}
                            Atenção: <strong className="font-mono tabular-nums text-rose-600 dark:text-rose-400">{confirmDialog.crossDepsCount} elemento(s)</strong> em outras fases dependem desta construção e também serão removidos.
                          </>
                        )}{' '}
                        Você pode desfazer com <kbd className="font-mono px-1 bg-slate-100 dark:bg-zinc-800 rounded">{modKey}+Z</kbd>.
                      </>
                    ) : confirmDialog.kind === 'clear' ? (
                      `Todos os círculos, retas e formas construídas no canvas serão removidos. Você pode desfazer com ${modKey}+Z.`
                    ) : (
                      `O desenho atual será substituído pela construção de exemplo na fase ativa. Você pode desfazer com ${modKey}+Z.`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmDialog(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDialog.kind === 'phase-delete') {
                      executeDeletePhase(confirmDialog.phaseId);
                    } else if (confirmDialog.kind === 'clear') {
                      executeClear();
                    } else {
                      executeLoadDemo();
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                >
                  {confirmDialog.kind === 'phase-delete'
                    ? 'Excluir fase'
                    : confirmDialog.kind === 'clear'
                      ? 'Limpar desenho'
                      : 'Carregar exemplo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clean single-line bottom instruction & metrics bar (no pills) */}
      <footer className="shrink-0 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs text-slate-600 dark:text-zinc-400 flex items-center justify-between gap-4 overflow-hidden">
        <span className="truncate">{TOOL_MSGS[tool]}</span>
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap font-mono tabular-nums text-[11px] text-slate-500 dark:text-zinc-400">
          <span>
            Fase {activePhaseIdx + 1}/{phases.length}: {activePhase?.name}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Snap: {effectiveSnapActive ? `${snapPx}px` : altDown ? 'Pausado (Alt)' : 'Desligado'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Snap tang.: {tanSnapEnabled ? 'Ativo' : 'Desligado'}</span>
          <span aria-hidden="true">·</span>
          <span>
            Guias: {guides.length}
            {guidesLocked ? ' (bloq.)' : ''}
          </span>
          <span aria-hidden="true">·</span>
          <span>SVG: {svgOverlap ? '+0,05px' : '0px'}</span>
          <span aria-hidden="true">·</span>
          <span>Interseções: {interCount}</span>
          <span aria-hidden="true">·</span>
          <span>Zoom: {Math.round(view.k * 100)}%</span>
        </div>
      </footer>
    </div>
  );
}

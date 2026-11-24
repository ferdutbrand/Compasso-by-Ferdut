export type ToolId = 'move' | 'ln' | 'ci' | 'pg' | 'shape' | 'ruler' | 'del';
export type LineToolMode = 'free' | 'tangent' | 'common';
export type CircleToolMode = 'center' | 'top-left' | 'diameter' | 'tangent';
export type SvgExportLayers = 'all' | 'paths' | 'geometry';
export type MirrorAxis = 'h' | 'v';

export interface SmartGuide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axis: 'x' | 'y';
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';
export const optKey = isMac ? '⌥' : 'Alt';
export const delKey = isMac ? '⌫' : 'Del';

export type DimMode = 'd' | 'r' | 'off';
export type CreationOrigin = 'center' | 'top-left';
export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom';
export type DistributeAxis = 'horiz' | 'vert';
export type CombineShapeOp = 'union' | 'intersect' | 'subtract' | 'exclude';

export type GuideLine =
  | { id: string; kind: 'h'; y: number }
  | { id: string; kind: 'v'; x: number }
  | { id: string; kind: 'a'; x1: number; y1: number; x2: number; y2: number };

export interface Phase {
  id: string;
  name: string;
  color: string;
  showGeometry: boolean;
  geometryOpacity: number;
  showPath: boolean;
  pathOpacity: number;
  locked: boolean;
}

export interface BuiltShape {
  id: string;
  phaseId: string;
  seeds: Array<{ x: number; y: number }>;
  d: string;
  scope?: 'phase' | 'all';
  stale?: boolean;
}

export interface PointObj {
  id: number;
  t: 'pt';
  phaseId?: string;
  groupId?: string;
  free: boolean;
  x: number;
  y: number;
  ok?: boolean;
  dead?: boolean;
  // Intersection of two curves
  a?: number;
  b?: number;
  s?: number;
  // Constrained on curve
  on?: number;
  u?: number;
  // Tangency point
  tp?: boolean;
  ci?: number;
  tg?: number;
}

export interface LineObj {
  id: number;
  t: 'ln';
  phaseId?: string;
  groupId?: string;
  dead?: boolean;
  // Through two points
  a?: number;
  b?: number;
  // Tangent from point `a` to circle `to`
  to?: number;
  s?: number;
  // Common tangent between two circles
  cc?: [number, number];
  tt?: number;
}

export interface CircleObj {
  id: number;
  t: 'ci';
  phaseId?: string;
  groupId?: string;
  scaleLocked?: boolean;
  dead?: boolean;
  // Center + point on circumference
  c?: number;
  p?: number;
  // Center + tangent to curve
  tan?: number;
  tanEdge?: number;
  m?: number;
  // Diameter from two edge points
  d1?: number;
  d2?: number;
  // Edge point `e` + tangent to 1 or 2 curves
  e?: number;
  ang?: number;
  sg?: number;
  tan2?: number;
  tan2Edge?: number;
  sg2?: number;
  kk?: number;
  // Multi-object tangent circle (2, 3, or 4 targets: ci, ln, pg, or pt)
  tanSet?: number[];
  tanEdges?: number[];
  tanSigns?: number[];
  tanRef?: { x: number; y: number; r: number };
  tanFixedR?: boolean;
}

export interface PolyObj {
  id: number;
  t: 'pg';
  phaseId?: string;
  groupId?: string;
  scaleLocked?: boolean;
  dead?: boolean;
  /** Center point ID */
  c: number;
  /** Vertex/corner point ID defining circumradius and rotation */
  p: number;
  /** Number of sides: 4 = Quadrado, 3 = Triângulo, 5 = Pentágono, 6 = Hexágono, 8 = Octógono */
  sides: number;
}

export type GeomObj = PointObj | LineObj | CircleObj | PolyObj;

export interface LineCurve {
  t: 'l';
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface CircleCurve {
  t: 'c';
  x: number;
  y: number;
  r: number;
}

export interface PolyCurve {
  t: 'p';
  cx: number;
  cy: number;
  r: number;
  rot: number;
  sides: number;
  side: number;
  verts: Array<{ x: number; y: number }>;
}

export type Curve = LineCurve | CircleCurve | PolyCurve;

export interface IntersectionPoint {
  x: number;
  y: number;
  a: number;
  b: number;
  s: number;
}

export type SnapResult =
  | { k: 'pt'; id: number; x: number; y: number }
  | { k: 'in'; x: number; y: number; a: number; b: number; s: number }
  | { k: 'on'; id: number; u: number; x: number; y: number }
  | {
      k: 'free';
      x: number;
      y: number;
      guideTag?: 'Guia' | 'Interseção guia' | 'Grid' | 'Grid Fibonacci';
    };

export interface ViewState {
  x: number;
  y: number;
  k: number;
}

export interface RefImage {
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  opacity: number;
  locked?: boolean;
}

export interface EditState {
  id: number;
  sn: SnapResult;
  ax: number;
  ay: number;
  bad: Set<number>;
}

export interface Guideline {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind?: 'normal' | 'align';
}

export interface GhostPreview {
  x?: number;
  y?: number;
  r?: number;
  ln?: LineCurve | null;
  pg?: PolyCurve | null;
  box?: { x: number; y: number; w: number; h: number };
  tan?: number;
  tan2?: number;
  tanTargets?: number[];
  contacts?: Array<{ x: number; y: number }>;
  guidelines?: Guideline[];
  label?: string;
}

export interface TanSolution {
  tan: number;
  tanEdge?: number;
  sg: number;
  tan2?: number;
  tan2Edge?: number;
  sg2?: number;
  kk?: number;
  ang: number;
  r: number;
  cx: number;
  cy: number;
}

export interface TanTargetSel {
  id: number;
  hx: number;
  hy: number;
  edge?: number;
}

export interface MultiTanSolution {
  cx: number;
  cy: number;
  r: number;
  signs: number[];
  edges?: Array<number | undefined>;
  contacts: Array<{ x: number; y: number }>;
  maxError: number;
  exact: boolean;
}

export interface CopiedSubgraph {
  items: GeomObj[];
  anchor: { x: number; y: number };
}

export interface TangencyCandidate {
  key: string;
  firstId: number;
  secondId: number;
  /** Specific tangency contact point displayed on the target/second object */
  contact: { x: number; y: number };
  /** Resulting curve geometry for the first/modified object when connected */
  previewCurve: Curve;
  /** Normal/radial guideline between center/anchor and contact point */
  guideline?: { x1: number; y1: number; x2: number; y2: number };
  kind: 'ci-ci' | 'ci-ln' | 'ln-ci' | 'ci-pg' | 'pg-ci' | 'pg-ln' | 'pg-pg' | 'ln-pg';
  /** Polygon edge index when second or first target is a polygon */
  tanEdge?: number;
  /** Tangency mode for circle-to-curve (0 = external, 1 = internal, 2 = enclosing) */
  m?: number;
  /** Sign for line-to-circle tangent (+1 or -1) */
  s?: number;
  /** For line-to-circle when rotating around a stationary endpoint */
  anchorEnd?: 'a' | 'b';
  /** True when resizing circle around fixed center instead of moving circle rigidly */
  fixedCenter?: boolean;
  newCenter?: { x: number; y: number };
  newRadius?: number;
  /** Screen/world distance gap between current modified geometry and this tangency */
  gap: number;
  label: string;
}


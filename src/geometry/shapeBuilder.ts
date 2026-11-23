import { inter, projectOnCurve } from './engine';
import type { BuiltShape, CircleCurve, Curve, LineCurve } from './types';

const V_MERGE_EPS = 1e-3;
const PARAM_DEDUP_EPS = 1e-4;
const TWO_PI = Math.PI * 2;

export interface ArrangementVertex {
  id: number;
  x: number;
  y: number;
}

export interface DirectedEdge {
  id: number;
  from: number;
  to: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  kind: 'seg' | 'arc';
  // For arc edges:
  cx: number;
  cy: number;
  r: number;
  aStart: number;
  aEnd: number;
  sweep: 0 | 1; // 1 = CCW (increasing angle in screen/world SVG coords), 0 = CW
  // Departure tangent angle at `from` and signed curvature (left = positive)
  depAngle: number;
  curvature: number;
  twinId: number;
  nextId: number;
  regionId: string | null;
  alive: boolean;
}

export interface AtomicRegion {
  id: string;
  outerLoop: DirectedEdge[];
  holes: DirectedEdge[][];
  d: string;
  area: number;
  seed: { x: number; y: number };
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface PlanarArrangement {
  regions: AtomicRegion[];
  hitRegion: (x: number, y: number) => AtomicRegion | null;
  buildUnionSvgPath: (regionIds: Set<string>) => string;
  recomputeShape: (shape: BuiltShape) => BuiltShape;
}

function normAngle(a: number): number {
  let x = a % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x;
}

function fmtNum(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function edgeMidpoint(e: DirectedEdge): { x: number; y: number; nx: number; ny: number } {
  if (e.kind === 'seg') {
    const mx = (e.x0 + e.x1) * 0.5;
    const my = (e.y0 + e.y1) * 0.5;
    const dx = e.x1 - e.x0;
    const dy = e.y1 - e.y0;
    const len = Math.hypot(dx, dy) || 1;
    // Left-hand normal in screen coordinates (Wait: in standard y-down screen coords, +90° CCW vs +90° CW:
    // Let's keep topological orientation purely algebraic in (x, y) coordinates!)
    return { x: mx, y: my, nx: -dy / len, ny: dx / len };
  }
  const midA = (e.aStart + e.aEnd) * 0.5;
  const mx = e.cx + e.r * Math.cos(midA);
  const my = e.cy + e.r * Math.sin(midA);
  // Tangent direction along increasing/decreasing angle:
  const dir = e.sweep === 1 ? 1 : -1;
  const tx = -Math.sin(midA) * dir;
  const ty = Math.cos(midA) * dir;
  return { x: mx, y: my, nx: -ty, ny: tx };
}

function edgeSignedArea2(e: DirectedEdge): number {
  if (e.kind === 'seg') {
    return e.x0 * e.y1 - e.x1 * e.y0;
  }
  const da = e.aEnd - e.aStart;
  return (
    e.cx * e.r * (Math.sin(e.aEnd) - Math.sin(e.aStart)) -
    e.cy * e.r * (Math.cos(e.aEnd) - Math.cos(e.aStart)) +
    e.r * e.r * da
  );
}

function loopSignedArea(edges: DirectedEdge[]): number {
  let sum = 0;
  for (const e of edges) {
    sum += edgeSignedArea2(e);
  }
  return sum * 0.5;
}

function loopBbox(edges: DirectedEdge[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 1e18;
  let minY = 1e18;
  let maxX = -1e18;
  let maxY = -1e18;

  const includePt = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const e of edges) {
    includePt(e.x0, e.y0);
    includePt(e.x1, e.y1);
    if (e.kind === 'arc') {
      const a0 = Math.min(e.aStart, e.aEnd);
      const a1 = Math.max(e.aStart, e.aEnd);
      const kMin = Math.ceil(a0 / (Math.PI / 2));
      const kMax = Math.floor(a1 / (Math.PI / 2));
      for (let k = kMin; k <= kMax; k++) {
        const ang = k * (Math.PI / 2);
        includePt(e.cx + e.r * Math.cos(ang), e.cy + e.r * Math.sin(ang));
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Exact horizontal (+X) ray-casting test for a closed loop of line segments and circular arcs.
 * Splits circular arcs at vertical extrema (pi/2, 3*pi/2) so each arc piece is y-monotonic.
 */
function isPointInLoop(px: number, py: number, edges: DirectedEdge[]): boolean {
  let inside = false;

  const testArcMonotonic = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const y0 = cy + r * Math.sin(a0);
    const y1 = cy + r * Math.sin(a1);
    if ((y0 > py) === (y1 > py)) return;
    const dy = py - cy;
    const disc = r * r - dy * dy;
    if (disc < 0) return;
    const dx = Math.sqrt(disc);
    const mid = normAngle((a0 + a1) * 0.5);
    const isRightHalf = mid < Math.PI * 0.5 || mid > Math.PI * 1.5;
    const xHit = isRightHalf ? cx + dx : cx - dx;
    if (px < xHit) inside = !inside;
  };

  for (const e of edges) {
    if (e.kind === 'seg') {
      if ((e.y0 > py) !== (e.y1 > py)) {
        const xHit = e.x0 + ((py - e.y0) * (e.x1 - e.x0)) / (e.y1 - e.y0);
        if (px < xHit) inside = !inside;
      }
    } else {
      const lo = Math.min(e.aStart, e.aEnd);
      const hi = Math.max(e.aStart, e.aEnd);
      const cuts: number[] = [lo];
      const halfPi = Math.PI * 0.5;
      // Vertical extrema occur at pi/2 + k*pi
      const kMin = Math.floor((lo - halfPi) / Math.PI) + 1;
      const kMax = Math.ceil((hi - halfPi) / Math.PI) - 1;
      for (let k = kMin; k <= kMax; k++) {
        const ang = halfPi + k * Math.PI;
        if (ang > lo + 1e-9 && ang < hi - 1e-9) {
          cuts.push(ang);
        }
      }
      cuts.push(hi);
      for (let i = 0; i + 1 < cuts.length; i++) {
        testArcMonotonic(e.cx, e.cy, e.r, cuts[i], cuts[i + 1]);
      }
    }
  }
  return inside;
}

function isPointInRegion(px: number, py: number, outer: DirectedEdge[], holes: DirectedEdge[][]): boolean {
  if (!isPointInLoop(px, py, outer)) return false;
  for (const hole of holes) {
    if (isPointInLoop(px, py, hole)) return false;
  }
  return true;
}

function distToEdge(px: number, py: number, e: DirectedEdge): number {
  if (e.kind === 'seg') {
    const dx = e.x1 - e.x0;
    const dy = e.y1 - e.y0;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-12) return Math.hypot(px - e.x0, py - e.y0);
    const t = Math.max(0, Math.min(1, ((px - e.x0) * dx + (py - e.y0) * dy) / l2));
    return Math.hypot(px - (e.x0 + t * dx), py - (e.y0 + t * dy));
  }
  const ang = Math.atan2(py - e.cy, px - e.cx);
  const lo = Math.min(e.aStart, e.aEnd);
  const hi = Math.max(e.aStart, e.aEnd);
  // Shift ang by 2pi multiples to test arc coverage
  let inArc = false;
  for (let k = -2; k <= 2; k++) {
    const a = ang + k * TWO_PI;
    if (a >= lo - 1e-6 && a <= hi + 1e-6) {
      inArc = true;
      break;
    }
  }
  if (inArc) {
    return Math.abs(Math.hypot(px - e.cx, py - e.cy) - e.r);
  }
  return Math.min(Math.hypot(px - e.x0, py - e.y0), Math.hypot(px - e.x1, py - e.y1));
}

function findBestSeedPoint(
  outer: DirectedEdge[],
  holes: DirectedEdge[][],
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
): { x: number; y: number } {
  const diag = Math.max(1, Math.hypot(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY));
  const candidates: Array<{ x: number; y: number }> = [];

  // 1. Midpoints of edges nudged inward along left-hand normal
  const stepFracs = [0.002, 0.01, 0.03, 0.08, 0.18, 0.32];
  for (const e of outer) {
    const mid = edgeMidpoint(e);
    for (const f of stepFracs) {
      const dist = Math.max(0.25, diag * f);
      candidates.push({ x: mid.x + mid.nx * dist, y: mid.y + mid.ny * dist });
      candidates.push({ x: mid.x - mid.nx * dist, y: mid.y - mid.ny * dist });
    }
  }

  // 2. Grid samples across bbox
  const n = 5;
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  for (let ix = 1; ix <= n; ix++) {
    for (let iy = 1; iy <= n; iy++) {
      candidates.push({
        x: bbox.minX + (w * ix) / (n + 1),
        y: bbox.minY + (h * iy) / (n + 1),
      });
    }
  }

  const allEdges = [...outer, ...holes.flat()];
  let best: { x: number; y: number } | null = null;
  let bestClearance = -1;

  for (const cand of candidates) {
    if (!isPointInRegion(cand.x, cand.y, outer, holes)) continue;
    let minD = 1e18;
    for (const e of allEdges) {
      const d = distToEdge(cand.x, cand.y, e);
      if (d < minD) minD = d;
    }
    if (minD > bestClearance) {
      bestClearance = minD;
      best = cand;
    }
  }

  if (best) return best;
  return { x: (bbox.minX + bbox.maxX) * 0.5, y: (bbox.minY + bbox.maxY) * 0.5 };
}

function loopsToSvgPath(loops: DirectedEdge[][]): string {
  const parts: string[] = [];
  for (const loop of loops) {
    if (loop.length === 0) continue;
    // Full single-vertex circle loop edge
    if (loop.length === 1 && loop[0].kind === 'arc') {
      const e = loop[0];
      const x0 = fmtNum(e.x0);
      const y0 = fmtNum(e.y0);
      const oppAngle = e.aStart + Math.PI;
      const ox = fmtNum(e.cx + e.r * Math.cos(oppAngle));
      const oy = fmtNum(e.cy + e.r * Math.sin(oppAngle));
      const r = fmtNum(e.r);
      parts.push(
        `M ${x0} ${y0} A ${r} ${r} 0 0 ${e.sweep} ${ox} ${oy} A ${r} ${r} 0 0 ${e.sweep} ${x0} ${y0} Z`
      );
      continue;
    }

    const startX = fmtNum(loop[0].x0);
    const startY = fmtNum(loop[0].y0);
    let segStr = `M ${startX} ${startY}`;
    for (const e of loop) {
      const x1 = fmtNum(e.x1);
      const y1 = fmtNum(e.y1);
      if (e.kind === 'seg') {
        segStr += ` L ${x1} ${y1}`;
      } else {
        const r = fmtNum(e.r);
        const span = Math.abs(e.aEnd - e.aStart);
        const largeArc = span > Math.PI + 1e-6 ? 1 : 0;
        segStr += ` A ${r} ${r} 0 ${largeArc} ${e.sweep} ${x1} ${y1}`;
      }
    }
    segStr += ' Z';
    parts.push(segStr);
  }
  return parts.join(' ');
}

export function buildPlanarArrangement(curves: Curve[]): PlanarArrangement {
  const vertices: ArrangementVertex[] = [];
  const getOrAddVertex = (x: number, y: number): ArrangementVertex => {
    for (const v of vertices) {
      if (Math.hypot(v.x - x, v.y - y) <= V_MERGE_EPS) {
        return v;
      }
    }
    const v: ArrangementVertex = { id: vertices.length, x, y };
    vertices.push(v);
    return v;
  };

  const circles: CircleCurve[] = [];
  const lines: LineCurve[] = [];
  for (const cv of curves) {
    if (cv.t === 'c' && Number.isFinite(cv.r) && cv.r > 1e-3) circles.push(cv);
    else if (cv.t === 'l' && Math.hypot(cv.dx, cv.dy) > 1e-9) lines.push(cv);
  }

  // Track exact vertex IDs belonging to each curve
  const circleVerts: number[][] = circles.map(() => []);
  const lineVerts: number[][] = lines.map(() => []);

  const addCurveVert = (arr: number[], vid: number) => {
    if (!arr.includes(vid)) arr.push(vid);
  };

  // Circle x Circle
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      for (const s of [1, -1]) {
        const pt = inter(circles[i], circles[j], s);
        if (pt) {
          const v = getOrAddVertex(pt[0], pt[1]);
          addCurveVert(circleVerts[i], v.id);
          addCurveVert(circleVerts[j], v.id);
        }
      }
    }
  }

  // Line x Circle
  for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < circles.length; j++) {
      for (const s of [1, -1]) {
        const pt = inter(lines[i], circles[j], s);
        if (pt) {
          const v = getOrAddVertex(pt[0], pt[1]);
          addCurveVert(lineVerts[i], v.id);
          addCurveVert(circleVerts[j], v.id);
        }
      }
    }
  }

  // Line x Line
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const pt = inter(lines[i], lines[j], 1);
      if (pt) {
        const v = getOrAddVertex(pt[0], pt[1]);
        addCurveVert(lineVerts[i], v.id);
        addCurveVert(lineVerts[j], v.id);
      }
    }
  }

  // Also ensure any vertex that happens to sit on another curve (within V_MERGE_EPS) is registered on it
  for (const v of vertices) {
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      if (Math.abs(Math.hypot(v.x - c.x, v.y - c.y) - c.r) <= V_MERGE_EPS) {
        addCurveVert(circleVerts[i], v.id);
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const n = Math.hypot(l.dx, l.dy);
      if (n > 1e-9) {
        const d = Math.abs((v.x - l.x) * l.dy - (v.y - l.y) * l.dx) / n;
        if (d <= V_MERGE_EPS) {
          addCurveVert(lineVerts[i], v.id);
        }
      }
    }
  }

  const edges: DirectedEdge[] = [];
  const addEdgePair = (
    from: ArrangementVertex,
    to: ArrangementVertex,
    kind: 'seg' | 'arc',
    cx: number,
    cy: number,
    r: number,
    aStart: number,
    aEnd: number
  ) => {
    const fwdId = edges.length;
    const revId = fwdId + 1;
    let depFwd: number;
    let depRev: number;
    let curvFwd: number;
    let curvRev: number;

    if (kind === 'seg') {
      depFwd = normAngle(Math.atan2(to.y - from.y, to.x - from.x));
      depRev = normAngle(depFwd + Math.PI);
      curvFwd = 0;
      curvRev = 0;
    } else {
      depFwd = normAngle(aStart + Math.PI * 0.5);
      depRev = normAngle(aEnd - Math.PI * 0.5);
      curvFwd = 1 / r;
      curvRev = -1 / r;
    }

    edges.push({
      id: fwdId,
      from: from.id,
      to: to.id,
      x0: from.x,
      y0: from.y,
      x1: to.x,
      y1: to.y,
      kind,
      cx,
      cy,
      r,
      aStart,
      aEnd,
      sweep: 1,
      depAngle: depFwd,
      curvature: curvFwd,
      twinId: revId,
      nextId: -1,
      regionId: null,
      alive: true,
    });

    edges.push({
      id: revId,
      from: to.id,
      to: from.id,
      x0: to.x,
      y0: to.y,
      x1: from.x,
      y1: from.y,
      kind,
      cx,
      cy,
      r,
      aStart: aEnd,
      aEnd: aStart,
      sweep: 0,
      depAngle: depRev,
      curvature: curvRev,
      twinId: fwdId,
      nextId: -1,
      regionId: null,
      alive: true,
    });
  };

  // Split circles into arcs
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const vids = circleVerts[i];
    if (vids.length === 0) {
      // Standalone circle: create 1 virtual vertex on its rightmost rim
      const v0 = getOrAddVertex(c.x + c.r, c.y);
      addEdgePair(v0, v0, 'arc', c.x, c.y, c.r, 0, TWO_PI);
      continue;
    }

    const sorted = vids
      .map((vid) => {
        const v = vertices[vid];
        return { v, ang: normAngle(Math.atan2(v.y - c.y, v.x - c.x)) };
      })
      .sort((a, b) => a.ang - b.ang);

    // Deduplicate collinear/coincident angles
    const uniq: typeof sorted = [];
    for (const item of sorted) {
      if (uniq.length === 0 || item.ang - uniq[uniq.length - 1].ang > PARAM_DEDUP_EPS) {
        uniq.push(item);
      }
    }
    if (uniq.length > 1 && TWO_PI - (uniq[uniq.length - 1].ang - uniq[0].ang) <= PARAM_DEDUP_EPS) {
      uniq.pop();
    }

    for (let k = 0; k < uniq.length; k++) {
      const curr = uniq[k];
      const next = uniq[(k + 1) % uniq.length];
      const a0 = curr.ang;
      const a1 = k + 1 < uniq.length ? next.ang : next.ang + TWO_PI;
      if (a1 - a0 > PARAM_DEDUP_EPS) {
        addEdgePair(curr.v, next.v, 'arc', c.x, c.y, c.r, a0, a1);
      }
    }
  }

  // Split lines into bounded segments between consecutive vertices
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const vids = lineVerts[i];
    if (vids.length < 2) continue;
    const len = Math.hypot(l.dx, l.dy);
    const ux = l.dx / len;
    const uy = l.dy / len;
    const sorted = vids
      .map((vid) => {
        const v = vertices[vid];
        return { v, u: (v.x - l.x) * ux + (v.y - l.y) * uy };
      })
      .sort((a, b) => a.u - b.u);

    const uniq: typeof sorted = [];
    for (const item of sorted) {
      if (uniq.length === 0 || item.u - uniq[uniq.length - 1].u > V_MERGE_EPS) {
        uniq.push(item);
      }
    }

    for (let k = 0; k + 1 < uniq.length; k++) {
      addEdgePair(uniq[k].v, uniq[k + 1].v, 'seg', 0, 0, 0, 0, 0);
    }
  }

  // Iteratively prune dead-end stubs (vertices with <= 1 alive undirected edge)
  const buildOutgoing = () => {
    const out: number[][] = vertices.map(() => []);
    for (const e of edges) {
      if (e.alive) out[e.from].push(e.id);
    }
    return out;
  };

  let outgoing = buildOutgoing();
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (let vid = 0; vid < outgoing.length; vid++) {
      if (outgoing[vid].length === 1) {
        const eid = outgoing[vid][0];
        const e = edges[eid];
        if (e.from !== e.to) {
          e.alive = false;
          edges[e.twinId].alive = false;
          pruned = true;
        }
      }
    }
    if (pruned) {
      outgoing = buildOutgoing();
    }
  }

  // Sort outgoing edges around each vertex in exact CCW order (depAngle, then signed curvature)
  const edgeIndexInOut = new Int32Array(edges.length).fill(-1);
  for (let vid = 0; vid < outgoing.length; vid++) {
    const list = outgoing[vid];
    list.sort((idA, idB) => {
      const a = edges[idA];
      const b = edges[idB];
      const dAng = a.depAngle - b.depAngle;
      if (Math.abs(dAng) > 1e-6) return dAng;
      return a.curvature - b.curvature;
    });
    for (let idx = 0; idx < list.length; idx++) {
      edgeIndexInOut[list[idx]] = idx;
    }
  }

  // Link nextId for each half-edge (step clockwise around destination vertex from twin)
  for (const e of edges) {
    if (!e.alive) continue;
    const list = outgoing[e.to];
    if (list.length === 0) continue;
    const twinIdx = edgeIndexInOut[e.twinId];
    const nextIdx = (twinIdx - 1 + list.length) % list.length;
    e.nextId = list[nextIdx];
  }

  // Walk all closed cycles
  const visited = new Uint8Array(edges.length);
  const posFaces: Array<{
    edges: DirectedEdge[];
    area: number;
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    holes: DirectedEdge[][];
  }> = [];
  const negLoops: Array<{
    edges: DirectedEdge[];
    area: number;
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    sample: { x: number; y: number };
  }> = [];

  for (const e of edges) {
    if (!e.alive || visited[e.id] || e.nextId < 0) continue;
    const loop: DirectedEdge[] = [];
    let curr: DirectedEdge | undefined = e;
    let guard = 0;
    while (curr && !visited[curr.id] && guard <= edges.length + 2) {
      visited[curr.id] = 1;
      loop.push(curr);
      curr = curr.nextId >= 0 ? edges[curr.nextId] : undefined;
      guard++;
    }
    if (loop.length === 0 || !curr || curr.id !== e.id) continue;

    const area = loopSignedArea(loop);
    if (area > 1e-2) {
      posFaces.push({
        edges: loop,
        area,
        bbox: loopBbox(loop),
        holes: [],
      });
    } else if (area < -1e-2) {
      const mid = edgeMidpoint(loop[0]);
      // Slightly step off the edge towards its exterior/twin side so containment test hits inside enclosing face
      negLoops.push({
        edges: loop,
        area,
        bbox: loopBbox(loop),
        sample: { x: mid.x, y: mid.y },
      });
    }
  }

  // Attach negative outer boundaries of enclosed islands as CW holes inside the smallest enclosing positive face
  // Sort positive faces ascending by area so first enclosing face found is the immediate parent!
  const posByAreaAsc = posFaces.map((f, idx) => ({ f, idx })).sort((a, b) => a.f.area - b.f.area);

  for (const neg of negLoops) {
    // Pick a point strictly inside one of the positive faces associated with this island if sample is on edge
    const testPts: Array<{ x: number; y: number }> = [];
    for (const e of neg.edges) {
      const m = edgeMidpoint(e);
      testPts.push({ x: m.x - m.nx * 0.05, y: m.y - m.ny * 0.05 });
      testPts.push({ x: m.x + m.nx * 0.05, y: m.y + m.ny * 0.05 });
    }

    const absArea = Math.abs(neg.area);
    // Find smallest positive face strictly larger than absArea whose boundary does NOT share edges with neg
    const negEdgeSet = new Set(neg.edges.map((e) => e.id));
    for (const { f } of posByAreaAsc) {
      if (f.area <= absArea + 1e-2) continue;
      if (
        neg.bbox.maxX < f.bbox.minX - 1 ||
        neg.bbox.minX > f.bbox.maxX + 1 ||
        neg.bbox.maxY < f.bbox.minY - 1 ||
        neg.bbox.minY > f.bbox.maxY + 1
      ) {
        continue;
      }
      // Verify neg is not the same component boundary
      let sharesTwin = false;
      for (const pe of f.edges) {
        if (negEdgeSet.has(pe.twinId)) {
          sharesTwin = true;
          break;
        }
      }
      if (sharesTwin) continue;

      let insideCount = 0;
      for (const tp of testPts) {
        if (isPointInLoop(tp.x, tp.y, f.edges)) insideCount++;
      }
      if (insideCount >= Math.ceil(testPts.length * 0.4)) {
        f.holes.push(neg.edges);
        break;
      }
    }
  }

  const regions: AtomicRegion[] = posFaces.map((f, idx) => {
    const id = `reg-${idx}`;
    for (const e of f.edges) e.regionId = id;
    for (const hole of f.holes) {
      for (const e of hole) e.regionId = id;
    }
    const seed = findBestSeedPoint(f.edges, f.holes, f.bbox);
    const d = loopsToSvgPath([f.edges, ...f.holes]);
    let netArea = f.area;
    for (const h of f.holes) netArea += loopSignedArea(h);
    return {
      id,
      outerLoop: f.edges,
      holes: f.holes,
      d,
      area: Math.max(0, netArea),
      seed,
      bbox: f.bbox,
    };
  });

  // Sort regions largest -> smallest; hitRegion checks smallest first so inner regions take precedence cleanly
  const regionsSmallestFirst = [...regions].sort((a, b) => a.area - b.area);
  const regionMap = new Map<string, AtomicRegion>();
  for (const r of regions) regionMap.set(r.id, r);

  const hitRegion = (x: number, y: number): AtomicRegion | null => {
    for (const r of regionsSmallestFirst) {
      if (x < r.bbox.minX - 1 || x > r.bbox.maxX + 1 || y < r.bbox.minY - 1 || y > r.bbox.maxY + 1) {
        continue;
      }
      if (isPointInRegion(x, y, r.outerLoop, r.holes)) {
        return r;
      }
    }
    return null;
  };

  const buildUnionSvgPath = (regionIds: Set<string>): string => {
    if (regionIds.size === 0) return '';
    if (regionIds.size === 1) {
      const onlyId = Array.from(regionIds)[0];
      return regionMap.get(onlyId)?.d ?? '';
    }

    const boundaryEdges: DirectedEdge[] = [];
    const boundaryByFrom = new Map<number, DirectedEdge[]>();

    for (const rid of regionIds) {
      const reg = regionMap.get(rid);
      if (!reg) continue;
      for (const e of [...reg.outerLoop, ...reg.holes.flat()]) {
        const twinRegion = edges[e.twinId].regionId;
        if (twinRegion === null || !regionIds.has(twinRegion)) {
          boundaryEdges.push(e);
          const arr = boundaryByFrom.get(e.from);
          if (arr) arr.push(e);
          else boundaryByFrom.set(e.from, [e]);
        }
      }
    }

    if (boundaryEdges.length === 0) return '';

    const used = new Set<number>();
    const loops: DirectedEdge[][] = [];

    for (const start of boundaryEdges) {
      if (used.has(start.id)) continue;
      const loop: DirectedEdge[] = [];
      let curr: DirectedEdge | undefined = start;
      let guard = 0;

      while (curr && !used.has(curr.id) && guard <= boundaryEdges.length + 2) {
        used.add(curr.id);
        loop.push(curr);
        if (curr.to === start.from && loop.length > 0 && (curr.from !== curr.to || loop.length === 1)) {
          // If it's a single self-loop edge, stop; otherwise if there aren't alternate branches or we closed cleanly
          if (curr.from === curr.to) break;
        }
        const candidates: DirectedEdge[] = (boundaryByFrom.get(curr.to) ?? []).filter(
          (ne) => !used.has(ne.id)
        );
        if (candidates.length === 0) break;
        if (candidates.length === 1) {
          curr = candidates[0];
        } else {
          // Pick next edge clockwise from curr.twin around vertex curr.to
          const outList = outgoing[curr.to];
          const twinPos = edgeIndexInOut[curr.twinId];
          let picked: DirectedEdge | undefined;
          for (let step = 1; step <= outList.length; step++) {
            const candId = outList[(twinPos - step + outList.length) % outList.length];
            const found = candidates.find((c) => c.id === candId);
            if (found) {
              picked = found;
              break;
            }
          }
          curr = picked ?? candidates[0];
        }
        guard++;
      }

      if (loop.length > 0) {
        loops.push(loop);
      }
    }

    return loopsToSvgPath(loops);
  };

  const recomputeShape = (shape: BuiltShape): BuiltShape => {
    if (shape.seeds.length === 0) return shape;
    const matchedIds = new Set<string>();
    const nextSeeds: Array<{ x: number; y: number }> = [];
    for (const s of shape.seeds) {
      const r = hitRegion(s.x, s.y);
      if (r) {
        matchedIds.add(r.id);
        nextSeeds.push(r.seed);
      }
    }
    if (matchedIds.size === 0) {
      return { ...shape, stale: true };
    }
    const nextD = buildUnionSvgPath(matchedIds);
    if (!nextD) {
      return { ...shape, stale: true };
    }
    const dedupSeeds: Array<{ x: number; y: number }> = [];
    for (const rid of matchedIds) {
      const reg = regionMap.get(rid);
      if (reg) dedupSeeds.push(reg.seed);
    }
    return {
      ...shape,
      seeds: dedupSeeds.length > 0 ? dedupSeeds : nextSeeds,
      d: nextD,
      stale: matchedIds.size < shape.seeds.length,
    };
  };

  return {
    regions,
    hitRegion,
    buildUnionSvgPath,
    recomputeShape,
  };
}

/**
 * Helper to check if a point lies on an existing curve arrangement (kept unused-safe if needed externally).
 */
export function snapSeedToCurveCenter(cv: Curve, x: number, y: number): { x: number; y: number } {
  if (cv.t === 'c') return { x: cv.x, y: cv.y };
  const p = projectOnCurve(cv, x, y);
  return { x: p.x, y: p.y };
}

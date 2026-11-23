import type {
  BuiltShape,
  CircleCurve,
  CircleObj,
  CopiedSubgraph,
  Curve,
  GeomObj,
  GuideLine,
  IntersectionPoint,
  LineCurve,
  LineObj,
  MultiTanSolution,
  Phase,
  PointObj,
  SnapResult,
  TanSolution,
  TanTargetSel,
  TangencyCandidate,
  ViewState,
} from './types';

export const DEFAULT_SNAP_PX = 10;
export const DEFAULT_SVG_OVERLAP_PX = 0.05;

export function cloneObjs(objs: GeomObj[]): GeomObj[] {
  const out = new Array<GeomObj>(objs.length);
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.t === 'ln' && o.cc) {
      out[i] = { ...o, cc: [o.cc[0], o.cc[1]] };
    } else if (o.t === 'ci' && o.tanSet) {
      out[i] = {
        ...o,
        tanSet: [...o.tanSet],
        tanSigns: o.tanSigns ? [...o.tanSigns] : undefined,
        tanRef: o.tanRef ? { ...o.tanRef } : undefined,
      };
    } else {
      out[i] = { ...o };
    }
  }
  return out;
}

export function getObj(objs: GeomObj[], id: number | undefined): GeomObj | undefined {
  return id !== undefined ? objs[id] : undefined;
}

export function refsOf(q: GeomObj): number[] {
  const raw: Array<number | undefined> = [];
  if (q.t === 'pt') {
    raw.push(q.a, q.b, q.ci, q.tg, q.on);
  } else if (q.t === 'ln') {
    raw.push(q.a, q.b, q.to);
    if (q.cc) raw.push(q.cc[0], q.cc[1]);
  } else {
    raw.push(q.c, q.p, q.tan, q.tan2, q.e, q.d1, q.d2);
    if (q.tanSet) raw.push(...q.tanSet);
  }
  return raw.filter((v): v is number => v !== undefined);
}

export function descOf(objs: GeomObj[], id: number): Set<number> {
  const s = new Set<number>([id]);
  let ch = true;
  while (ch) {
    ch = false;
    for (const q of objs) {
      if (!q.dead && !s.has(q.id) && refsOf(q).some((v) => s.has(v))) {
        s.add(q.id);
        ch = true;
      }
    }
  }
  return s;
}

export function isPrioritized(prio: Set<number>, id: number): boolean {
  return prio.size === 0 || prio.has(id);
}

export function isPointAllowed(objs: GeomObj[], prio: Set<number>, o: PointObj): boolean {
  if (!prio.size || prio.has(o.id)) return true;
  const r = refsOf(o);
  if (r.length && r.every((i) => prio.has(i))) return true;
  return objs.some((q) => !q.dead && prio.has(q.id) && refsOf(q).includes(o.id));
}

export function tanLine(a: { x: number; y: number }, K: CircleCurve, s: number): LineCurve | null {
  const vx = K.x - a.x;
  const vy = K.y - a.y;
  const D = Math.hypot(vx, vy);
  if (D < 1e-12 || D < K.r - 1e-9) return null;
  const al = Math.asin(Math.min(1, K.r / D)) * s;
  const c = Math.cos(al);
  const sn = Math.sin(al);
  return { t: 'l', x: a.x, y: a.y, dx: vx * c - vy * sn, dy: vx * sn + vy * c };
}

export function commonTan(A: CircleCurve, B: CircleCurve, s: number, t: number): LineCurve | null {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const D = Math.hypot(dx, dy);
  if (D < 1e-12) return null;
  const c = (s * B.r - A.r) / D;
  if (Math.abs(c) > 1 + 1e-12) return null;
  const sq = Math.sqrt(Math.max(0, 1 - c * c));
  const ux = dx / D;
  const uy = dy / D;
  const nx = c * ux - t * sq * uy;
  const ny = c * uy + t * sq * ux;
  const h = nx * A.x + ny * A.y - A.r;
  return { t: 'l', x: nx * h, y: ny * h, dx: -ny, dy: nx };
}

export function edgeR(A: { x: number; y: number }, u: [number, number], T: Curve, sg: number): number | null {
  let r: number;
  if (T.t === 'l') {
    const n = Math.hypot(T.dx, T.dy);
    if (n < 1e-12) return null;
    const nx = -T.dy / n;
    const ny = T.dx / n;
    const sd = (A.x - T.x) * nx + (A.y - T.y) * ny;
    const den = sg - (u[0] * nx + u[1] * ny);
    if (Math.abs(den) < 1e-9) return null;
    r = sd / den;
  } else {
    const wx = A.x - T.x;
    const wy = A.y - T.y;
    const den = 2 * (u[0] * wx + u[1] * wy - sg * T.r);
    if (Math.abs(den) < 1e-9) return null;
    r = (T.r * T.r - wx * wx - wy * wy) / den;
  }
  return r > 1e-9 ? r : null;
}

function pccRow(A: { x: number; y: number }, T: Curve, s: number): [number, number, number, number] {
  if (T.t === 'l') {
    const n = Math.hypot(T.dx, T.dy);
    const nx = -T.dy / n;
    const ny = T.dx / n;
    return [nx, ny, -s, nx * T.x + ny * T.y];
  }
  return [
    2 * (A.x - T.x),
    2 * (A.y - T.y),
    -2 * s * T.r,
    T.r * T.r - T.x * T.x - T.y * T.y + A.x * A.x + A.y * A.y,
  ];
}

export function pccRoots(
  A: { x: number; y: number },
  T1: Curve,
  s1: number,
  T2: Curve,
  s2: number
): Array<{ x: number; y: number; r: number }> {
  const [a1, b1, c1, d1] = pccRow(A, T1, s1);
  const [a2, b2, c2, d2] = pccRow(A, T2, s2);
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) return [];
  const p0 = (d1 * b2 - d2 * b1) / det;
  const p1 = (-c1 * b2 + c2 * b1) / det;
  const q0 = (a1 * d2 - a2 * d1) / det;
  const q1 = (-a1 * c2 + a2 * c1) / det;
  const ex = p0 - A.x;
  const ey = q0 - A.y;
  const qa = p1 * p1 + q1 * q1 - 1;
  const qb = 2 * (p1 * ex + q1 * ey);
  const qc = ex * ex + ey * ey;
  let rs: number[] = [];
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) rs = [-qc / qb];
  } else {
    const D = qb * qb - 4 * qa * qc;
    if (D >= 0) {
      const sq = Math.sqrt(D);
      rs = [(-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)].sort((a, b) => a - b);
    }
  }
  return rs.map((r) => ({ x: p0 + p1 * r, y: q0 + q1 * r, r }));
}

export function pccAt(
  A: { x: number; y: number },
  T1: Curve,
  s1: number,
  T2: Curve,
  s2: number,
  kk: number
): CircleCurve | null {
  const q = pccRoots(A, T1, s1, T2, s2)[kk];
  return q && q.r > 1e-9 ? { t: 'c', x: q.x, y: q.y, r: q.r } : null;
}

export function tanR(T: Curve, x: number, y: number, m: number): number | null {
  if (T.t === 'l') {
    const n = Math.hypot(T.dx, T.dy);
    if (n < 1e-12) return null;
    const r = Math.abs((x - T.x) * T.dy - (y - T.y) * T.dx) / n;
    return r > 1e-9 ? r : null;
  }
  const D = Math.hypot(x - T.x, y - T.y);
  if (D < 1e-6) return null;
  const r = m === 0 ? D - T.r : m === 1 ? T.r - D : D + T.r;
  return r > 1e-9 ? r : null;
}

function curveWith(
  objs: GeomObj[],
  o: GeomObj | undefined,
  getCurve: (id: number | undefined) => Curve | null
): Curve | null {
  if (!o || o.dead) return null;
  if (o.t === 'ln') {
    if (o.cc) {
      const A = getCurve(o.cc[0]);
      const B = getCurve(o.cc[1]);
      if (!A || !B || A.t !== 'c' || B.t !== 'c') return null;
      return commonTan(A, B, o.s ?? 1, o.tt ?? 1);
    }
    if (o.to !== undefined) {
      const a = getObj(objs, o.a);
      const K = getCurve(o.to);
      if (!a || a.t !== 'pt' || !a.ok || !K || K.t !== 'c') return null;
      return tanLine(a, K, o.s ?? 1);
    }
    const a = getObj(objs, o.a);
    const b = getObj(objs, o.b);
    if (!a || !b || a.t !== 'pt' || b.t !== 'pt' || !a.ok || !b.ok) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 1e-9) return null;
    return { t: 'l', x: a.x, y: a.y, dx, dy };
  }

  if (o.t === 'ci') {
    if (o.tanSet && o.tanSet.length >= 2) {
      return resolveMultiTanCircleWith(objs, o, getCurve);
    }
    if (o.e !== undefined) {
      const A = getObj(objs, o.e);
      const T = getCurve(o.tan);
      if (!A || A.t !== 'pt' || !A.ok || !T) return null;
      if (o.tan2 !== undefined) {
        const T2 = getCurve(o.tan2);
        return T2 ? pccAt(A, T, o.sg ?? 1, T2, o.sg2 ?? 1, o.kk ?? 0) : null;
      }
      const ang = o.ang ?? 0;
      const u: [number, number] = [Math.cos(ang), Math.sin(ang)];
      const r = edgeR(A, u, T, o.sg ?? 1);
      return r === null ? null : { t: 'c', x: A.x + u[0] * r, y: A.y + u[1] * r, r };
    }
    if (o.d1 !== undefined) {
      const a = getObj(objs, o.d1);
      const b = getObj(objs, o.d2);
      if (!a || !b || a.t !== 'pt' || b.t !== 'pt' || !a.ok || !b.ok) return null;
      const r = Math.hypot(b.x - a.x, b.y - a.y) / 2;
      return r < 1e-9 ? null : { t: 'c', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r };
    }
    const c = getObj(objs, o.c);
    if (!c || c.t !== 'pt' || !c.ok) return null;
    if (o.tan !== undefined) {
      const T = getCurve(o.tan);
      if (!T) return null;
      const r = tanR(T, c.x, c.y, o.m ?? 0);
      return r === null ? null : { t: 'c', x: c.x, y: c.y, r };
    }
    const p = getObj(objs, o.p);
    if (!p || p.t !== 'pt' || !p.ok) return null;
    const r = Math.hypot(p.x - c.x, p.y - c.y);
    return r < 1e-9 ? null : { t: 'c', x: c.x, y: c.y, r };
  }

  return null;
}

export function buildCurveCache(objs: GeomObj[]): Array<Curve | null> {
  const cache: Array<Curve | null | undefined> = new Array(objs.length);
  const getCached = (id: number | undefined): Curve | null => {
    if (id === undefined || id < 0 || id >= objs.length) return null;
    const hit = cache[id];
    if (hit !== undefined) return hit;
    const o = objs[id];
    if (!o || o.dead || o.t === 'pt') {
      cache[id] = null;
      return null;
    }
    cache[id] = null;
    const cv = curveWith(objs, o, getCached);
    cache[id] = cv;
    return cv;
  };
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (!o.dead && o.t !== 'pt' && cache[i] === undefined) {
      getCached(i);
    }
  }
  return cache as Array<Curve | null>;
}

export function curve(
  objs: GeomObj[],
  o: GeomObj | undefined,
  curveCache?: Array<Curve | null>
): Curve | null {
  if (!o || o.dead) return null;
  if (curveCache && o.id >= 0 && o.id < curveCache.length) {
    return curveCache[o.id] ?? null;
  }
  return curveWith(objs, o, (id) => curve(objs, getObj(objs, id)));
}

export function inter(A: Curve | null, B: Curve | null, s: number): [number, number] | null {
  if (!A || !B) return null;
  if (A.t === 'c' && B.t === 'l') {
    const tmp = A;
    A = B;
    B = tmp;
  }
  if (A.t === 'l' && B.t === 'l') {
    const d = A.dx * B.dy - A.dy * B.dx;
    if (Math.abs(d) < 1e-12) return null;
    if (s < 0) return null;
    const t = ((B.x - A.x) * B.dy - (B.y - A.y) * B.dx) / d;
    return [A.x + t * A.dx, A.y + t * A.dy];
  }
  if (A.t === 'l' && B.t === 'c') {
    const fx = A.x - B.x;
    const fy = A.y - B.y;
    const a = A.dx * A.dx + A.dy * A.dy;
    const b = 2 * (fx * A.dx + fy * A.dy);
    const c = fx * fx + fy * fy - B.r * B.r;
    const D = b * b - 4 * a * c;
    if (D < -1e-9 * a) return null;
    const t = (-b + s * Math.sqrt(Math.max(D, 0))) / (2 * a);
    return [A.x + t * A.dx, A.y + t * A.dy];
  }
  if (A.t === 'c' && B.t === 'c') {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-12 || d > A.r + B.r + 1e-9 || d < Math.abs(A.r - B.r) - 1e-9) return null;
    const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(A.r * A.r - a * a, 0));
    return [A.x + (a * dx) / d - (s * h * dy) / d, A.y + (a * dy) / d + (s * h * dx) / d];
  }
  return null;
}

export function recalc(objs: GeomObj[]): void {
  for (let pass = 0; pass < 3; pass++) {
    for (const o of objs) {
      if (o.dead) {
        if (o.t === 'pt') o.ok = false;
        continue;
      }
      if (o.t === 'pt') {
        if (o.free) {
          o.ok = true;
        } else if (o.on !== undefined) {
          const parent = getObj(objs, o.on);
          const T = curve(objs, parent);
          o.ok = !!T && !!parent && !parent.dead;
          if (o.ok && T) {
            const u = o.u ?? 0;
            if (T.t === 'c') {
              o.x = T.x + T.r * Math.cos(u);
              o.y = T.y + T.r * Math.sin(u);
            } else {
              o.x = T.x + u * T.dx;
              o.y = T.y + u * T.dy;
            }
          }
        } else if (o.tp) {
          const ci = getObj(objs, o.ci);
          const tg = getObj(objs, o.tg);
          const C = curve(objs, ci);
          const T = curve(objs, tg);
          o.ok = !!(C && T && ci && tg && !ci.dead && !tg.dead);
          if (o.ok && C && T && C.t === 'c' && ci && ci.t === 'ci' && tg) {
            if (T.t === 'l') {
              const denom = T.dx * T.dx + T.dy * T.dy;
              if (denom < 1e-12) {
                o.ok = false;
              } else {
                const t = ((C.x - T.x) * T.dx + (C.y - T.y) * T.dy) / denom;
                o.x = T.x + t * T.dx;
                o.y = T.y + t * T.dy;
              }
            } else {
              const D = Math.hypot(C.x - T.x, C.y - T.y);
              if (D < 1e-9) {
                o.ok = false;
              } else {
                const dExt = Math.abs(D - (C.r + T.r));
                const dIn = Math.abs(D - (T.r - C.r));
                const dEnc = Math.abs(D - (C.r - T.r));
                const k = dEnc < dExt && dEnc < dIn && C.r > T.r ? -1 : 1;
                o.x = T.x + (k * T.r * (C.x - T.x)) / D;
                o.y = T.y + (k * T.r * (C.y - T.y)) / D;
              }
            }
          }
        } else {
          const r = inter(curve(objs, getObj(objs, o.a)), curve(objs, getObj(objs, o.b)), o.s ?? 1);
          o.ok = !!r;
          if (r) {
            o.x = r[0];
            o.y = r[1];
          }
        }
      }
    }
  }
}

export function addObj(
  objs: GeomObj[],
  obj: Omit<PointObj, 'id'> | Omit<LineObj, 'id'> | Omit<CircleObj, 'id'>
): number {
  const id = objs.length;
  const full = { ...obj, id } as GeomObj;
  objs.push(full);
  recalc(objs);
  return id;
}

export function killObj(objs: GeomObj[], id: number): void {
  const o = getObj(objs, id);
  if (!o || o.dead) return;
  o.dead = true;
  for (const q of objs) {
    if (!q.dead && refsOf(q).includes(id)) {
      killObj(objs, q.id);
    }
  }
  recalc(objs);
}

export function allInter(
  objs: GeomObj[],
  prio: Set<number>,
  curveCache?: Array<Curve | null>,
  allowedIds?: Set<number>
): IntersectionPoint[] {
  const cs: Array<{ obj: LineObj | CircleObj; cv: Curve }> = [];
  const cache = curveCache ?? buildCurveCache(objs);
  for (const o of objs) {
    if (
      (o.t === 'ln' || o.t === 'ci') &&
      !o.dead &&
      (!allowedIds || allowedIds.has(o.id) || prio.has(o.id)) &&
      isPrioritized(prio, o.id)
    ) {
      const cv = cache[o.id];
      if (cv) cs.push({ obj: o, cv });
    }
  }
  const out: IntersectionPoint[] = [];
  for (let i = 0; i < cs.length; i++) {
    const ci = cs[i];
    for (let j = i + 1; j < cs.length; j++) {
      const cj = cs[j];
      if (ci.cv.t === 'c' && cj.cv.t === 'c') {
        const maxR = ci.cv.r + cj.cv.r + 1e-9;
        if (Math.abs(cj.cv.x - ci.cv.x) > maxR || Math.abs(cj.cv.y - ci.cv.y) > maxR) {
          continue;
        }
      }
      for (const s of [1, -1]) {
        if (ci.obj.t === 'ln' && cj.obj.t === 'ln' && s < 0) continue;
        const r = inter(ci.cv, cj.cv, s);
        if (r) out.push({ x: r[0], y: r[1], a: ci.obj.id, b: cj.obj.id, s });
      }
    }
  }
  return out;
}

export function distToCurve(c: Curve, x: number, y: number): number {
  if (c.t === 'c') {
    return Math.abs(Math.hypot(x - c.x, y - c.y) - c.r);
  }
  const n = Math.hypot(c.dx, c.dy);
  if (n < 1e-12) return 1e18;
  return Math.abs((x - c.x) * c.dy - (y - c.y) * c.dx) / n;
}

export function projectOnCurve(c: Curve, x: number, y: number): { x: number; y: number; u: number } {
  if (c.t === 'c') {
    const u = Math.atan2(y - c.y, x - c.x);
    return { x: c.x + c.r * Math.cos(u), y: c.y + c.r * Math.sin(u), u };
  }
  const denom = c.dx * c.dx + c.dy * c.dy;
  const u = denom > 1e-12 ? ((x - c.x) * c.dx + (y - c.y) * c.dy) / denom : 0;
  return { x: c.x + u * c.dx, y: c.y + u * c.dy, u };
}

export function guideToCurve(g: GuideLine): LineCurve {
  if (g.kind === 'h') return { t: 'l', x: 0, y: g.y, dx: 1, dy: 0 };
  if (g.kind === 'v') return { t: 'l', x: g.x, y: 0, dx: 0, dy: 1 };
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  return { t: 'l', x: g.x1, y: g.y1, dx: Math.abs(dx) + Math.abs(dy) > 1e-9 ? dx : 1, dy: Math.abs(dx) + Math.abs(dy) > 1e-9 ? dy : 0 };
}

export function distToGuide(g: GuideLine, x: number, y: number): number {
  if (g.kind === 'h') return Math.abs(y - g.y);
  if (g.kind === 'v') return Math.abs(x - g.x);
  return distToCurve(guideToCurve(g), x, y);
}

/**
 * Snaps to existing points, precomputed intersections, or drafting guides strictly within `snapPx` screen pixels (default 10px).
 */
export function snap(
  objs: GeomObj[],
  x: number,
  y: number,
  viewK: number,
  prio: Set<number>,
  snapPx: number = DEFAULT_SNAP_PX,
  enabled: boolean = true,
  cachedInters?: IntersectionPoint[],
  guides?: GuideLine[],
  curveCache?: Array<Curve | null>,
  allowedIds?: Set<number>
): SnapResult {
  if (!enabled) return { k: 'free', x, y };
  const R = snapPx / viewK;

  let bestPt: { id: number; x: number; y: number; d: number } | null = null;
  for (const o of objs) {
    if (
      o.t === 'pt' &&
      o.ok &&
      !o.dead &&
      (!allowedIds || allowedIds.has(o.id) || prio.has(o.id)) &&
      isPointAllowed(objs, prio, o)
    ) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d <= R && (!bestPt || d < bestPt.d)) {
        bestPt = { id: o.id, x: o.x, y: o.y, d };
      }
    }
  }

  const inters = cachedInters ?? allInter(objs, prio, curveCache, allowedIds);
  let bestIn: { x: number; y: number; a: number; b: number; s: number; d: number } | null = null;
  for (const c of inters) {
    if (Math.abs(c.x - x) > R || Math.abs(c.y - y) > R) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d <= R && (!bestIn || d < bestIn.d)) {
      bestIn = { ...c, d };
    }
  }

  if (bestPt && bestIn) {
    if (bestPt.d <= bestIn.d + 2 / viewK) {
      return { k: 'pt', id: bestPt.id, x: bestPt.x, y: bestPt.y };
    }
    return { k: 'in', x: bestIn.x, y: bestIn.y, a: bestIn.a, b: bestIn.b, s: bestIn.s };
  }
  if (bestPt) return { k: 'pt', id: bestPt.id, x: bestPt.x, y: bestPt.y };
  if (bestIn) return { k: 'in', x: bestIn.x, y: bestIn.y, a: bestIn.a, b: bestIn.b, s: bestIn.s };

  // Check drafting guides (intersections between guides, guide x curves, and guide lines)
  if (guides && guides.length > 0) {
    const gCurves = guides.map(guideToCurve);
    let bestGuidePt: { x: number; y: number; d: number; tag: 'Guia' | 'Interseção guia' } | null = null;

    // Guide x Guide intersections
    for (let i = 0; i < gCurves.length; i++) {
      for (let j = i + 1; j < gCurves.length; j++) {
        const pt = inter(gCurves[i], gCurves[j], 1);
        if (pt) {
          const d = Math.hypot(pt[0] - x, pt[1] - y);
          if (d <= R && (!bestGuidePt || d < bestGuidePt.d)) {
            bestGuidePt = { x: pt[0], y: pt[1], d, tag: 'Interseção guia' };
          }
        }
      }
    }

    // Guide x Curve intersections (only curves within 2.5*R of pointer for speed)
    for (const o of objs) {
      if (o.dead || !isPrioritized(prio, o.id) || (o.t !== 'ln' && o.t !== 'ci')) continue;
      const cv = curve(objs, o, curveCache);
      if (!cv || distToCurve(cv, x, y) > R * 2.5) continue;
      for (const gc of gCurves) {
        for (const s of cv.t === 'l' ? [1] : [1, -1]) {
          const pt = inter(gc, cv, s);
          if (pt) {
            const d = Math.hypot(pt[0] - x, pt[1] - y);
            if (d <= R && (!bestGuidePt || d < bestGuidePt.d)) {
              bestGuidePt = { x: pt[0], y: pt[1], d, tag: 'Interseção guia' };
            }
          }
        }
      }
    }

    if (bestGuidePt) {
      return { k: 'free', x: bestGuidePt.x, y: bestGuidePt.y, guideTag: bestGuidePt.tag };
    }

    // Snap directly onto nearest guide line
    let bestLine: { x: number; y: number; d: number } | null = null;
    for (const gc of gCurves) {
      const dd = distToCurve(gc, x, y);
      if (dd <= R && (!bestLine || dd < bestLine.d)) {
        const proj = projectOnCurve(gc, x, y);
        bestLine = { x: proj.x, y: proj.y, d: dd };
      }
    }
    if (bestLine) {
      return { k: 'free', x: bestLine.x, y: bestLine.y, guideTag: 'Guia' };
    }
  }

  return { k: 'free', x, y };
}

export function snapCurve(
  objs: GeomObj[],
  x: number,
  y: number,
  viewK: number,
  prio: Set<number>,
  snapPx: number = DEFAULT_SNAP_PX,
  bad: Set<number> = new Set(),
  curveCache?: Array<Curve | null>
): { id: number; u: number; x: number; y: number; dist: number } | null {
  let bd = snapPx / viewK;
  let best: { id: number; u: number; x: number; y: number; dist: number } | null = null;
  for (const o of objs) {
    if (o.dead || !isPrioritized(prio, o.id) || bad.has(o.id) || (o.t !== 'ln' && o.t !== 'ci')) continue;
    const T = curve(objs, o, curveCache);
    if (!T) continue;
    const dd = distToCurve(T, x, y);
    if (dd <= bd) {
      bd = dd;
      const proj = projectOnCurve(T, x, y);
      best = { id: o.id, u: proj.u, x: proj.x, y: proj.y, dist: dd };
    }
  }
  return best;
}

export function safeSnap(
  objs: GeomObj[],
  x: number,
  y: number,
  bad: Set<number>,
  viewK: number,
  prio: Set<number>,
  snapPx: number = DEFAULT_SNAP_PX,
  enabled: boolean = true,
  cachedInters?: IntersectionPoint[],
  guides?: GuideLine[],
  curveCache?: Array<Curve | null>,
  allowedIds?: Set<number>
): SnapResult {
  const sn = snap(objs, x, y, viewK, prio, snapPx, enabled, cachedInters, guides, curveCache, allowedIds);
  if ((sn.k === 'pt' && bad.has(sn.id)) || (sn.k === 'in' && (bad.has(sn.a) || bad.has(sn.b)))) {
    return { k: 'free', x, y };
  }
  return sn;
}

export function commitSnap(objs: GeomObj[], sn: SnapResult, phaseId?: string): number {
  if (sn.k === 'pt') return sn.id;
  if (sn.k === 'in') {
    const ex = objs.find(
      (o): o is PointObj =>
        o.t === 'pt' && !o.free && !o.dead && o.a === sn.a && o.b === sn.b && o.s === sn.s
    );
    return ex
      ? ex.id
      : addObj(objs, { t: 'pt', phaseId, free: false, x: sn.x, y: sn.y, a: sn.a, b: sn.b, s: sn.s });
  }
  if (sn.k === 'on') {
    return addObj(objs, { t: 'pt', phaseId, free: false, x: sn.x, y: sn.y, on: sn.id, u: sn.u });
  }
  return addObj(objs, { t: 'pt', phaseId, free: true, x: sn.x, y: sn.y });
}

export function tangentLineFor(
  objs: GeomObj[],
  pid: number,
  x: number,
  y: number,
  viewK: number,
  prio: Set<number>,
  snapPx: number = DEFAULT_SNAP_PX,
  curveCache?: Array<Curve | null>,
  allowedIds?: Set<number>
): { to: number; s: number; line: LineCurve; contact: { x: number; y: number } } | null {
  const a = getObj(objs, pid);
  if (!a || a.t !== 'pt' || !a.ok) return null;
  const maxErr = snapPx / viewK;
  let bestScore = 1e18;
  let best: { to: number; s: number; line: LineCurve; contact: { x: number; y: number } } | null = null;

  for (const o of objs) {
    if (
      o.dead ||
      (!(!allowedIds || allowedIds.has(o.id) || prio.has(o.id))) ||
      !isPrioritized(prio, o.id) ||
      o.t !== 'ci'
    ) {
      continue;
    }
    const K = curve(objs, o, curveCache);
    if (!K || K.t !== 'c') continue;
    const cDist = distToCurve(K, x, y);
    for (const s of [1, -1]) {
      const L = tanLine(a, K, s);
      if (!L) continue;
      const forwardDot = (x - a.x) * L.dx + (y - a.y) * L.dy;
      if (forwardDot < -maxErr) continue;
      const d = distToCurve(L, x, y);
      if (d <= maxErr) {
        // Prefer circles closer to cursor line when multiple tangents align
        const score = d + 0.1 * Math.min(cDist, 80 / viewK);
        if (score < bestScore) {
          bestScore = score;
          const proj = projectOnCurve(L, K.x, K.y);
          best = { to: o.id, s, line: L, contact: { x: proj.x, y: proj.y } };
        }
      }
    }
  }
  return best;
}

export function tangentFor(
  objs: GeomObj[],
  cid: number,
  x: number,
  y: number,
  viewK: number,
  prio: Set<number>,
  snapPx: number = DEFAULT_SNAP_PX,
  curveCache?: Array<Curve | null>,
  allowedIds?: Set<number>
): { tan: number; m: number; r: number } | null {
  const c = getObj(objs, cid);
  if (!c || c.t !== 'pt' || !c.ok) return null;
  const d0 = Math.hypot(x - c.x, y - c.y);
  const maxErr = snapPx / viewK;
  let bestScore = 1e18;
  let best: { tan: number; m: number; r: number } | null = null;

  for (const o of objs) {
    if (
      o.dead ||
      (!(!allowedIds || allowedIds.has(o.id) || prio.has(o.id))) ||
      !isPrioritized(prio, o.id) ||
      o.t === 'pt'
    ) {
      continue;
    }
    const T = curve(objs, o, curveCache);
    if (!T) continue;
    const cDist = distToCurve(T, x, y);
    for (const m of T.t === 'l' ? [0] : [0, 1, 2]) {
      const r = tanR(T, c.x, c.y, m);
      if (r !== null) {
        const err = Math.abs(r - d0);
        if (err <= maxErr) {
          // Prefer the curve closest to the cursor when radii overlap
          const score = err + 0.15 * Math.min(cDist, 80 / viewK);
          if (score < bestScore) {
            bestScore = score;
            best = { tan: o.id, m, r };
          }
        }
      }
    }
  }
  return best;
}

/**
 * Finds 1- or 2-curve tangency solutions within `snapPx` (default 10px),
 * prioritizing elements closest to the cursor/line for better performance and predictability.
 */
export function tanSolve(
  objs: GeomObj[],
  A: { x: number; y: number },
  x: number,
  y: number,
  bad: Set<number>,
  viewK: number,
  prio: Set<number>,
  snapPx: number = DEFAULT_SNAP_PX,
  curveCache?: Array<Curve | null>,
  allowedIds?: Set<number>
): TanSolution | null {
  const ang = Math.atan2(y - A.y, x - A.x);
  const u: [number, number] = [Math.cos(ang), Math.sin(ang)];
  const d0 = Math.hypot(x - A.x, y - A.y);
  const maxErr = snapPx / viewK;
  let best: TanSolution | null = null;
  let bestScore = 1e18;

  const cs: Array<{ id: number; T: Curve; cDist: number }> = [];
  for (const o of objs) {
    if (
      o.dead ||
      (!(!allowedIds || allowedIds.has(o.id) || prio.has(o.id))) ||
      !isPrioritized(prio, o.id) ||
      bad.has(o.id) ||
      (o.t !== 'ln' && o.t !== 'ci')
    ) {
      continue;
    }
    const T = curve(objs, o, curveCache);
    if (T) {
      cs.push({ id: o.id, T, cDist: distToCurve(T, x, y) });
    }
  }

  // Sort by proximity to cursor so closest curves are evaluated first
  cs.sort((a, b) => a.cDist - b.cDist);

  for (const c of cs) {
    for (const sg of [1, -1]) {
      const r = edgeR(A, u, c.T, sg);
      if (r !== null) {
        const err = Math.abs(2 * r - d0);
        if (err <= maxErr) {
          const score = err + 0.15 * Math.min(c.cDist, 80 / viewK);
          if (score < bestScore) {
            bestScore = score;
            best = { tan: c.id, sg, ang, r, cx: A.x + u[0] * r, cy: A.y + u[1] * r };
          }
        }
      }
    }
  }

  // Limit PCC pair checks to closest 28 curves for smooth performance on huge drawings
  const pccPool = cs.slice(0, 28);
  for (let i = 0; i < pccPool.length; i++) {
    for (let j = i + 1; j < pccPool.length; j++) {
      for (const s1 of [1, -1]) {
        for (const s2 of [1, -1]) {
          pccRoots(A, pccPool[i].T, s1, pccPool[j].T, s2).forEach((q, kk) => {
            if (q.r > 1e-9) {
              const err = Math.abs(Math.hypot(x - q.x, y - q.y) - q.r);
              if (err <= maxErr) {
                const pairProx = 0.1 * (Math.min(pccPool[i].cDist, 80 / viewK) + Math.min(pccPool[j].cDist, 80 / viewK));
                const score = err + pairProx;
                if (score < bestScore) {
                  bestScore = score;
                  best = {
                    tan: pccPool[i].id,
                    sg: s1,
                    tan2: pccPool[j].id,
                    sg2: s2,
                    kk,
                    ang,
                    r: q.r,
                    cx: q.x,
                    cy: q.y,
                  };
                }
              }
            }
          });
        }
      }
    }
  }

  return best;
}

export function commonTanFor(
  objs: GeomObj[],
  i: number,
  j: number,
  x: number,
  y: number,
  curveCache?: Array<Curve | null>
): { s: number; t: number; line: LineCurve } | null {
  const A = curve(objs, getObj(objs, i), curveCache);
  const B = curve(objs, getObj(objs, j), curveCache);
  if (!A || !B || A.t !== 'c' || B.t !== 'c') return null;
  let best: { s: number; t: number; line: LineCurve } | null = null;
  let bd = 1e18;
  for (const s of [1, -1]) {
    for (const t of [1, -1]) {
      const L = commonTan(A, B, s, t);
      if (!L) continue;
      const d = distToCurve(L, x, y);
      if (d < bd) {
        bd = d;
        best = { s, t, line: L };
      }
    }
  }
  return best;
}

export function tanFields(tg: TanSolution): Partial<CircleObj> {
  return tg.tan2 !== undefined
    ? { ang: tg.ang, tan: tg.tan, sg: tg.sg, tan2: tg.tan2, sg2: tg.sg2, kk: tg.kk }
    : { ang: tg.ang, tan: tg.tan, sg: tg.sg };
}

export function tanIds(tg: TanSolution): number[] {
  return tg.tan2 !== undefined ? [tg.tan, tg.tan2] : [tg.tan];
}

export function lineEndpoints(c: LineCurve): [number, number, number, number] {
  const L = 1e6;
  const n = Math.hypot(c.dx, c.dy);
  const ux = c.dx / n;
  const uy = c.dy / n;
  return [c.x - ux * L, c.y - uy * L, c.x + ux * L, c.y + uy * L];
}

export function clipLine(
  c: LineCurve,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [number, number, number, number] | null {
  let t0 = -1e18;
  let t1 = 1e18;
  for (const [p, q, lo, hi] of [
    [c.x, c.dx, x0, x1],
    [c.y, c.dy, y0, y1],
  ] as const) {
    if (Math.abs(q) < 1e-12) {
      if (p < lo || p > hi) return null;
    } else {
      let a = (lo - p) / q;
      let b = (hi - p) / q;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
  }
  if (t0 > t1) return null;
  return [c.x + t0 * c.dx, c.y + t0 * c.dy, c.x + t1 * c.dx, c.y + t1 * c.dy];
}

function overlapDirectionForCurve(c: CircleCurve, T: Curve): 'grow' | 'shrink' {
  if (T.t === 'l') return 'grow';
  const D = Math.hypot(c.x - T.x, c.y - T.y);
  const dExt = Math.abs(D - (c.r + T.r));
  const dIn = Math.abs(D - (T.r - c.r));
  const dOut = Math.abs(D - (c.r - T.r));
  if (dOut < dExt && dOut < dIn) return 'shrink';
  return 'grow';
}

/**
 * Generates clean SVG with optional 0.1px vector overlap between tangent circles/lines
 * so vector boolean/pathfinder operations never suffer sub-pixel gaps.
 */
export function makeSVG(
  objs: GeomObj[],
  view: ViewState,
  width: number,
  height: number,
  bg: boolean,
  overlapPx: number = DEFAULT_SVG_OVERLAP_PX,
  options?: { phases?: Phase[]; shapes?: BuiltShape[] }
): string {
  let x0 = 1e18;
  let y0 = 1e18;
  let x1 = -1e18;
  let y1 = -1e18;
  const up = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };

  const cs: Array<{ id: number; c: CircleCurve; obj: CircleObj }> = [];
  const ls: Array<{ id: number; c: LineCurve; obj: LineObj }> = [];

  for (const o of objs) {
    if (o.dead) continue;
    if (o.t === 'pt') {
      if (o.ok) up(o.x, o.y);
    } else {
      const c = curve(objs, o);
      if (!c) continue;
      if (c.t === 'c' && o.t === 'ci') {
        up(c.x - c.r, c.y - c.r);
        up(c.x + c.r, c.y + c.r);
        cs.push({ id: o.id, c: { ...c }, obj: o });
      } else if (c.t === 'l' && o.t === 'ln') {
        ls.push({ id: o.id, c: { ...c }, obj: o });
      }
    }
  }

  // Apply deterministic up-to-0.05px vector overlap for tangent geometries
  if (overlapPx > 0) {
    const adjustedCircles = new Set<number>();

    for (const item of cs) {
      const o = item.obj;
      const tanList: number[] = [];
      if (o.tan !== undefined) tanList.push(o.tan);
      if (o.tan2 !== undefined) tanList.push(o.tan2);
      if (o.tanSet) tanList.push(...o.tanSet);

      if (tanList.length > 0) {
        const dirs: Array<{ dir: 'grow' | 'shrink'; T: Curve }> = [];
        for (const tid of tanList) {
          const T = curve(objs, getObj(objs, tid));
          if (T) dirs.push({ dir: overlapDirectionForCurve(item.c, T), T });
        }
        if (dirs.length === 1) {
          item.c.r += dirs[0].dir === 'grow' ? overlapPx : -overlapPx;
          adjustedCircles.add(item.id);
        } else if (dirs.length >= 2) {
          const growCount = dirs.filter((d) => d.dir === 'grow').length;
          if (growCount === dirs.length) {
            item.c.r += overlapPx;
          } else if (growCount === 0) {
            item.c.r = Math.max(1e-6, item.c.r - overlapPx);
          } else {
            const shrinkItem = dirs.find((d) => d.dir === 'shrink')?.T;
            if (shrinkItem && shrinkItem.t === 'c') {
              const dx = shrinkItem.x - item.c.x;
              const dy = shrinkItem.y - item.c.y;
              const D = Math.hypot(dx, dy) || 1;
              item.c.x += (dx / D) * (overlapPx * 0.5);
              item.c.y += (dy / D) * (overlapPx * 0.5);
            }
            item.c.r += overlapPx * 0.5;
          }
          adjustedCircles.add(item.id);
        }
      }
    }

    // Also catch any geometric pair of circles touching within < 0.05px (e.g., created by center/edge)
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        if (adjustedCircles.has(cs[j].id) || adjustedCircles.has(cs[i].id)) continue;
        const A = cs[i].c;
        const B = cs[j].c;
        const D = Math.hypot(B.x - A.x, B.y - A.y);
        if (Math.abs(D - (A.r + B.r)) < 0.05) {
          B.r += overlapPx;
          adjustedCircles.add(cs[j].id);
        } else if (Math.abs(D - Math.abs(A.r - B.r)) < 0.05) {
          if (B.r < A.r) B.r += overlapPx;
          else B.r = Math.max(1e-6, B.r - overlapPx);
          adjustedCircles.add(cs[j].id);
        }
      }
    }

    // Shift tangent lines inward by overlapPx toward their target circle center
    for (const item of ls) {
      const o = item.obj;
      if (o.to !== undefined) {
        const K = curve(objs, getObj(objs, o.to));
        if (K && K.t === 'c') {
          const n = Math.hypot(item.c.dx, item.c.dy) || 1;
          let nx = -item.c.dy / n;
          let ny = item.c.dx / n;
          const dot = (K.x - item.c.x) * nx + (K.y - item.c.y) * ny;
          if (dot < 0) {
            nx = -nx;
            ny = -ny;
          }
          item.c.x += nx * overlapPx;
          item.c.y += ny * overlapPx;
        }
      } else if (o.cc && (o.s ?? 1) === 1) {
        const A = curve(objs, getObj(objs, o.cc[0]));
        if (A && A.t === 'c') {
          const n = Math.hypot(item.c.dx, item.c.dy) || 1;
          let nx = -item.c.dy / n;
          let ny = item.c.dx / n;
          const dot = (A.x - item.c.x) * nx + (A.y - item.c.y) * ny;
          if (dot < 0) {
            nx = -nx;
            ny = -ny;
          }
          item.c.x += nx * overlapPx;
          item.c.y += ny * overlapPx;
        }
      }
    }
  }

  if (x0 > x1) {
    x0 = view.x;
    y0 = view.y;
    x1 = view.x + width / view.k;
    y1 = view.y + height / view.k;
  }

  const m = Math.max(20, 0.05 * Math.max(x1 - x0, y1 - y0));
  x0 -= m;
  y0 -= m;
  x1 += m;
  y1 += m;
  const f = (n: number) => +n.toFixed(4);
  const w = x1 - x0;
  const h = y1 - y0;
  const bgr = bg ? `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" fill="#fff"/>` : '';

  const phases = options?.phases;
  const shapes = options?.shapes ?? [];
  if (phases && phases.length > 0) {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const defaultPid = phases[0].id;
    const phaseGroups = phases
      .map((ph, idx) => {
        const pShapes = ph.showPath
          ? shapes.filter((sh) => sh.phaseId === ph.id && sh.d)
          : [];
        const pCs = ph.showGeometry
          ? cs.filter((item) => (item.obj.phaseId ?? defaultPid) === ph.id)
          : [];
        const pLs = ph.showGeometry
          ? ls.filter((item) => (item.obj.phaseId ?? defaultPid) === ph.id)
          : [];
        if (pShapes.length === 0 && pCs.length === 0 && pLs.length === 0) return '';

        const pathsSvg =
          pShapes.length > 0
            ? `<g id="fase-${idx + 1}-paths" fill="${esc(ph.color)}" fill-opacity="${f(ph.pathOpacity)}" fill-rule="evenodd" stroke="none">` +
              pShapes.map((sh) => `<path d="${sh.d}"/>`).join('') +
              '</g>'
            : '';

        const geomSvg =
          pCs.length > 0 || pLs.length > 0
            ? `<g id="fase-${idx + 1}-geometria" fill="none" stroke="${esc(ph.color)}" stroke-opacity="${f(ph.geometryOpacity)}" stroke-width="1.5" stroke-linecap="round">` +
              pCs.map((item) => `<circle cx="${f(item.c.x)}" cy="${f(item.c.y)}" r="${f(item.c.r)}"/>`).join('') +
              pLs
                .map((item) => {
                  const s = clipLine(item.c, x0, y0, x1, y1);
                  return s ? `<line x1="${f(s[0])}" y1="${f(s[1])}" x2="${f(s[2])}" y2="${f(s[3])}"/>` : '';
                })
                .join('') +
              '</g>'
            : '';

        return `<g id="fase-${idx + 1}-${esc(ph.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-'))}">${pathsSvg}${geomSvg}</g>`;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}">${bgr}${phaseGroups}</svg>`;
  }

  const circ =
    '<g id="circulos" fill="none" stroke="#000" stroke-width="1.5">' +
    cs.map((item) => `<circle cx="${f(item.c.x)}" cy="${f(item.c.y)}" r="${f(item.c.r)}"/>`).join('') +
    '</g>';
  const ret =
    '<g id="retas" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round">' +
    ls
      .map((item) => {
        const s = clipLine(item.c, x0, y0, x1, y1);
        return s ? `<line x1="${f(s[0])}" y1="${f(s[1])}" x2="${f(s[2])}" y2="${f(s[3])}"/>` : '';
      })
      .join('') +
    '</g>';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}">${bgr}${circ}${ret}</svg>`;
}

/**
 * Builds an independent copyable subgraph for the selected objects.
 * Relationships inside `selectedIds` stay linked; external parent dependencies
 * are converted to standalone movable points so pasted shapes can be moved freely.
 */
export function buildCopySubgraph(objs: GeomObj[], selectedIds: Set<number>): CopiedSubgraph | null {
  if (selectedIds.size === 0) return null;

  const temp: GeomObj[] = [];
  const oldToNew = new Map<number, number>();

  const ensureFreePoint = (x: number, y: number): number => {
    const id = temp.length;
    temp.push({ id, t: 'pt', free: true, x, y, ok: true });
    return id;
  };

  // 1. Copy selected points first (preserving internal parametric ones if all parents are selected)
  const selectedList = Array.from(selectedIds)
    .map((id) => getObj(objs, id))
    .filter((o): o is GeomObj => !!o && !o.dead)
    .sort((a, b) => a.id - b.id);

  const ensurePointCopied = (ptId: number): number => {
    const existing = oldToNew.get(ptId);
    if (existing !== undefined) return existing;
    const orig = getObj(objs, ptId);
    if (!orig || orig.t !== 'pt' || orig.dead || !orig.ok) {
      return ensureFreePoint(0, 0);
    }
    const id = temp.length;
    oldToNew.set(ptId, id);
    temp.push({ id, t: 'pt', free: true, x: orig.x, y: orig.y, ok: true });
    return id;
  };

  // First pass: create placeholders/copies for selected points
  for (const o of selectedList) {
    if (o.t === 'pt' && o.ok) {
      const parents = refsOf(o);
      const keepParametric = !o.free && parents.length > 0 && parents.every((p) => selectedIds.has(p));
      if (!keepParametric) {
        ensurePointCopied(o.id);
      }
    }
  }

  // Second pass: copy selected curves (preserving internal links or converting to standalone movable curves)
  for (const o of selectedList) {
    if (o.t === 'ln') {
      const parents = refsOf(o);
      const keepParametric = parents.length > 0 && parents.every((p) => selectedIds.has(p));
      if (keepParametric) {
        const cloned = { ...o, id: temp.length };
        if (cloned.a !== undefined) cloned.a = ensurePointCopied(cloned.a);
        if (cloned.b !== undefined) cloned.b = ensurePointCopied(cloned.b);
        oldToNew.set(o.id, cloned.id);
        temp.push(cloned);
      } else {
        const L = curve(objs, o);
        if (!L || L.t !== 'l') continue;
        let pA: number;
        let pB: number;
        if (o.a !== undefined && o.b !== undefined) {
          pA = ensurePointCopied(o.a);
          pB = ensurePointCopied(o.b);
        } else {
          const n = Math.hypot(L.dx, L.dy) || 1;
          const ux = (L.dx / n) * 100;
          const uy = (L.dy / n) * 100;
          pA = ensureFreePoint(L.x, L.y);
          pB = ensureFreePoint(L.x + ux, L.y + uy);
        }
        const id = temp.length;
        oldToNew.set(o.id, id);
        temp.push({ id, t: 'ln', a: pA, b: pB });
      }
    } else if (o.t === 'ci') {
      const parents = refsOf(o);
      const keepParametric = parents.length > 0 && parents.every((p) => selectedIds.has(p));
      if (keepParametric) {
        const cloned: CircleObj = {
          ...o,
          id: temp.length,
          tanSet: o.tanSet ? [...o.tanSet] : undefined,
          tanSigns: o.tanSigns ? [...o.tanSigns] : undefined,
          tanRef: o.tanRef ? { ...o.tanRef } : undefined,
        };
        if (cloned.c !== undefined) cloned.c = ensurePointCopied(cloned.c);
        if (cloned.p !== undefined) cloned.p = ensurePointCopied(cloned.p);
        if (cloned.d1 !== undefined) cloned.d1 = ensurePointCopied(cloned.d1);
        if (cloned.d2 !== undefined) cloned.d2 = ensurePointCopied(cloned.d2);
        if (cloned.e !== undefined) cloned.e = ensurePointCopied(cloned.e);
        oldToNew.set(o.id, cloned.id);
        temp.push(cloned);
      } else {
        const C = curve(objs, o);
        if (!C || C.t !== 'c') continue;
        const pCenter = o.c !== undefined ? ensurePointCopied(o.c) : ensureFreePoint(C.x, C.y);
        const pEdge = o.p !== undefined ? ensurePointCopied(o.p) : ensureFreePoint(C.x + C.r, C.y);
        const id = temp.length;
        oldToNew.set(o.id, id);
        temp.push({ id, t: 'ci', c: pCenter, p: pEdge });
      }
    }
  }

  // Third pass: wire up parametric points & parametric curve refs (tan, tan2, tanSet, to, cc, a, b, ci, tg, on)
  for (const o of selectedList) {
    if (o.t === 'pt' && o.ok && !oldToNew.has(o.id)) {
      const parents = refsOf(o);
      if (parents.every((p) => oldToNew.has(p))) {
        const cloned = { ...o, id: temp.length };
        if (cloned.a !== undefined) cloned.a = oldToNew.get(cloned.a);
        if (cloned.b !== undefined) cloned.b = oldToNew.get(cloned.b);
        if (cloned.ci !== undefined) cloned.ci = oldToNew.get(cloned.ci);
        if (cloned.tg !== undefined) cloned.tg = oldToNew.get(cloned.tg);
        if (cloned.on !== undefined) cloned.on = oldToNew.get(cloned.on);
        oldToNew.set(o.id, cloned.id);
        temp.push(cloned);
      }
    }
  }

  // Remap curve-to-curve references on kept parametric curves
  for (const item of temp) {
    if (item.t === 'ln') {
      if (item.to !== undefined && oldToNew.has(item.to)) item.to = oldToNew.get(item.to);
      if (item.cc) {
        item.cc = [
          oldToNew.get(item.cc[0]) ?? item.cc[0],
          oldToNew.get(item.cc[1]) ?? item.cc[1],
        ];
      }
    } else if (item.t === 'ci') {
      if (item.tan !== undefined && oldToNew.has(item.tan)) item.tan = oldToNew.get(item.tan);
      if (item.tan2 !== undefined && oldToNew.has(item.tan2)) item.tan2 = oldToNew.get(item.tan2);
      if (item.tanSet) {
        item.tanSet = item.tanSet.map((tid) => oldToNew.get(tid) ?? tid);
      }
    }
  }

  if (temp.length === 0) return null;
  recalc(temp);

  let sx = 0;
  let sy = 0;
  let cnt = 0;
  for (const item of temp) {
    if (item.t === 'pt' && item.ok) {
      sx += item.x;
      sy += item.y;
      cnt++;
    }
  }

  return {
    items: temp,
    anchor: cnt > 0 ? { x: sx / cnt, y: sy / cnt } : { x: 0, y: 0 },
  };
}

export function pasteSubgraph(
  objs: GeomObj[],
  copied: CopiedSubgraph,
  dx: number,
  dy: number,
  targetPhaseId?: string
): { next: GeomObj[]; pastedIds: number[] } {
  const next = cloneObjs(objs);
  const baseId = next.length;
  const pastedIds: number[] = [];

  for (const raw of copied.items) {
    const item =
      raw.t === 'ln' && raw.cc
        ? ({ ...raw, cc: [raw.cc[0], raw.cc[1]] } as GeomObj)
        : ({ ...raw } as GeomObj);
    const newId = baseId + raw.id;
    item.id = newId;
    if (targetPhaseId !== undefined) {
      item.phaseId = targetPhaseId;
    }

    if (item.t === 'pt') {
      if (item.free) {
        item.x += dx;
        item.y += dy;
      }
      if (item.a !== undefined) item.a += baseId;
      if (item.b !== undefined) item.b += baseId;
      if (item.ci !== undefined) item.ci += baseId;
      if (item.tg !== undefined) item.tg += baseId;
      if (item.on !== undefined) item.on += baseId;
    } else if (item.t === 'ln') {
      if (item.a !== undefined) item.a += baseId;
      if (item.b !== undefined) item.b += baseId;
      if (item.to !== undefined) item.to += baseId;
      if (item.cc) item.cc = [item.cc[0] + baseId, item.cc[1] + baseId];
    } else {
      if (item.c !== undefined) item.c += baseId;
      if (item.p !== undefined) item.p += baseId;
      if (item.d1 !== undefined) item.d1 += baseId;
      if (item.d2 !== undefined) item.d2 += baseId;
      if (item.e !== undefined) item.e += baseId;
      if (item.tan !== undefined) item.tan += baseId;
      if (item.tan2 !== undefined) item.tan2 += baseId;
      if (item.tanSet) item.tanSet = item.tanSet.map((tid) => tid + baseId);
      if (item.tanSigns) item.tanSigns = [...item.tanSigns];
      if (item.tanRef) item.tanRef = { x: item.tanRef.x + dx, y: item.tanRef.y + dy, r: item.tanRef.r };
    }

    next.push(item);
    pastedIds.push(newId);
  }

  recalc(next);
  return { next, pastedIds };
}

/**
 * Collects all movable root free points owned by a set of selected IDs so group/curve dragging
 * moves them together rigidly without breaking dependent curves.
 */
export function movableRootPointsForSelection(objs: GeomObj[], ids: Set<number>): number[] {
  const pts = new Set<number>();
  const visited = new Set<number>();

  const visit = (id: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    const o = getObj(objs, id);
    if (!o || o.dead) return;
    if (o.t === 'pt') {
      if (o.free) {
        pts.add(o.id);
      } else if (o.on === undefined) {
        // Intersection / tangency point: only chase parents if we want to move whole curve dependencies?
        // Only chase direct curve parents if those curves are also selected!
        for (const r of refsOf(o)) {
          if (ids.has(r)) visit(r);
        }
      }
    } else {
      // Curve (ln or ci): move its defining free points
      for (const r of refsOf(o)) {
        const refObj = getObj(objs, r);
        if (refObj && !refObj.dead && refObj.t === 'pt') {
          visit(r);
        }
      }
    }
  };

  for (const id of ids) {
    visit(id);
  }
  return Array.from(pts);
}

function offsetCurveAtRadius(T: Curve, refCx: number, refCy: number, oldR: number, newR: number): Curve | null {
  if (T.t === 'l') {
    const proj = projectOnCurve(T, refCx, refCy);
    const vx = refCx - proj.x;
    const vy = refCy - proj.y;
    const len = Math.hypot(vx, vy);
    if (len < 1e-9) {
      const n = Math.hypot(T.dx, T.dy) || 1;
      const nx = -T.dy / n;
      const ny = T.dx / n;
      return { t: 'l', x: T.x + nx * newR, y: T.y + ny * newR, dx: T.dx, dy: T.dy };
    }
    return {
      t: 'l',
      x: proj.x + (newR * vx) / len,
      y: proj.y + (newR * vy) / len,
      dx: T.dx,
      dy: T.dy,
    };
  }
  const D = Math.hypot(refCx - T.x, refCy - T.y);
  const dExt = Math.abs(D - (oldR + T.r));
  const dIn = Math.abs(D - (T.r - oldR));
  const dOut = Math.abs(D - (oldR - T.r));
  if (dIn < dExt && dIn < dOut) {
    if (newR >= T.r - 1e-4) return null;
    return { t: 'c', x: T.x, y: T.y, r: T.r - newR };
  }
  if (dOut < dExt && dOut < dIn) {
    if (newR <= T.r + 1e-4) return null;
    return { t: 'c', x: T.x, y: T.y, r: newR - T.r };
  }
  return { t: 'c', x: T.x, y: T.y, r: T.r + newR };
}

/**
 * Updates a circle's radius to `newR` while preserving its connected tangencies
 * (both upstream tangencies on the circle itself and downstream tangents via recalc).
 */
export function setCircleRadius(
  objs: GeomObj[],
  circleId: number,
  newR: number
): { ok: boolean; next?: GeomObj[]; reason?: string } {
  if (!Number.isFinite(newR) || newR <= 1e-4) {
    return { ok: false, reason: 'O valor precisa ser maior que zero.' };
  }

  const next = cloneObjs(objs);
  const o = getObj(next, circleId);
  if (!o || o.dead || o.t !== 'ci') {
    return { ok: false, reason: 'Círculo não encontrado.' };
  }

  const C = curve(next, o);
  if (!C || C.t !== 'c') {
    return { ok: false, reason: 'Geometria do círculo inválida.' };
  }

  if (o.c !== undefined && o.p !== undefined) {
    const pc = getObj(next, o.c);
    const pp = getObj(next, o.p);
    if (pp && pp.t === 'pt' && pp.free) {
      const ang = Math.hypot(pp.x - C.x, pp.y - C.y) > 1e-9 ? Math.atan2(pp.y - C.y, pp.x - C.x) : 0;
      pp.x = C.x + newR * Math.cos(ang);
      pp.y = C.y + newR * Math.sin(ang);
    } else if (pc && pc.t === 'pt' && pc.free && pp && pp.t === 'pt') {
      const ang = Math.hypot(pc.x - pp.x, pc.y - pp.y) > 1e-9 ? Math.atan2(pc.y - pp.y, pc.x - pp.x) : 0;
      pc.x = pp.x + newR * Math.cos(ang);
      pc.y = pp.y + newR * Math.sin(ang);
    } else {
      return { ok: false, reason: 'Centro e borda estão presos a outros objetos.' };
    }
  } else if (o.d1 !== undefined && o.d2 !== undefined) {
    const p1 = getObj(next, o.d1);
    const p2 = getObj(next, o.d2);
    if (!p1 || !p2 || p1.t !== 'pt' || p2.t !== 'pt') {
      return { ok: false, reason: 'Pontos do diâmetro inválidos.' };
    }
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    if (p1.free && p2.free) {
      p1.x = C.x - newR * ux;
      p1.y = C.y - newR * uy;
      p2.x = C.x + newR * ux;
      p2.y = C.y + newR * uy;
    } else if (p2.free) {
      p2.x = p1.x + 2 * newR * ux;
      p2.y = p1.y + 2 * newR * uy;
    } else if (p1.free) {
      p1.x = p2.x - 2 * newR * ux;
      p1.y = p2.y - 2 * newR * uy;
    } else {
      return { ok: false, reason: 'Os pontos do diâmetro estão presos a interseções.' };
    }
  } else if (o.c !== undefined && o.tan !== undefined) {
    const pc = getObj(next, o.c);
    const T = curve(next, getObj(next, o.tan));
    if (!pc || pc.t !== 'pt' || !T) {
      return { ok: false, reason: 'Referência de tangência inválida.' };
    }

    let off: Curve | null = null;
    if (T.t === 'l') {
      off = offsetCurveAtRadius(T, C.x, C.y, C.r, newR);
    } else {
      const m = o.m ?? 0;
      if (m === 1 && newR >= T.r - 1e-4) {
        return { ok: false, reason: 'Raio maior que o círculo tangente externo.' };
      }
      if (m === 2 && newR <= T.r + 1e-4) {
        return { ok: false, reason: 'Raio precisa envolver o círculo tangente.' };
      }
      const targetD = m === 0 ? T.r + newR : m === 1 ? T.r - newR : newR - T.r;
      off = { t: 'c', x: T.x, y: T.y, r: targetD };
    }
    if (!off) return { ok: false, reason: 'Raio incompatível com a tangência.' };

    if (pc.free) {
      if (off.t === 'l') {
        const proj = projectOnCurve(off, C.x, C.y);
        pc.x = proj.x;
        pc.y = proj.y;
      } else {
        const vx = C.x - off.x;
        const vy = C.y - off.y;
        const len = Math.hypot(vx, vy) || 1;
        pc.x = off.x + (off.r * vx) / len;
        pc.y = off.y + (off.r * vy) / len;
      }
    } else if (pc.on !== undefined) {
      const S = curve(next, getObj(next, pc.on));
      if (!S) return { ok: false, reason: 'Curva de apoio do centro inválida.' };
      let bestPt: [number, number] | null = null;
      let bestD = 1e18;
      for (const s of [1, -1]) {
        const pt = inter(S, off, s);
        if (pt) {
          const d = Math.hypot(pt[0] - C.x, pt[1] - C.y);
          if (d < bestD) {
            bestD = d;
            bestPt = pt;
          }
        }
      }
      if (!bestPt) {
        return { ok: false, reason: 'Raio incompatível com a curva onde o centro desliza.' };
      }
      pc.u = projectOnCurve(S, bestPt[0], bestPt[1]).u;
    } else {
      return { ok: false, reason: 'O centro está preso a uma interseção fixa.' };
    }
  } else if (o.e !== undefined && o.tan !== undefined) {
    const pe = getObj(next, o.e);
    const T1 = curve(next, getObj(next, o.tan));
    if (!pe || pe.t !== 'pt' || !T1) {
      return { ok: false, reason: 'Referência de tangência inválida.' };
    }
    const off1 = offsetCurveAtRadius(T1, C.x, C.y, C.r, newR);
    if (!off1) {
      return { ok: false, reason: 'Raio incompatível com a tangência conectada.' };
    }

    if (o.tan2 === undefined) {
      const circleA: CircleCurve = { t: 'c', x: pe.x, y: pe.y, r: newR };
      let bestPt: [number, number] | null = null;
      let bestD = 1e18;
      for (const s of [1, -1]) {
        const pt = inter(off1, circleA, s);
        if (pt) {
          const d = Math.hypot(pt[0] - C.x, pt[1] - C.y);
          if (d < bestD) {
            bestD = d;
            bestPt = pt;
          }
        }
      }
      if (!bestPt) {
        return { ok: false, reason: 'Raio incompatível com o ponto fixo e a tangente.' };
      }
      o.ang = Math.atan2(bestPt[1] - pe.y, bestPt[0] - pe.x);
    } else {
      const T2 = curve(next, getObj(next, o.tan2));
      if (!T2) return { ok: false, reason: 'Segunda tangente inválida.' };
      const off2 = offsetCurveAtRadius(T2, C.x, C.y, C.r, newR);
      if (!off2) {
        return { ok: false, reason: 'Raio incompatível com a segunda tangência.' };
      }
      let bestCenter: [number, number] | null = null;
      let bestD = 1e18;
      for (const s of [1, -1]) {
        const pt = inter(off1, off2, s);
        if (pt) {
          const d = Math.hypot(pt[0] - C.x, pt[1] - C.y);
          if (d < bestD) {
            bestD = d;
            bestCenter = pt;
          }
        }
      }
      if (!bestCenter) {
        return { ok: false, reason: 'Não existe círculo desse tamanho tangente às duas curvas.' };
      }
      if (!pe.free) {
        return { ok: false, reason: 'Ponto da borda preso; não é possível ajustar 2 tangências.' };
      }
      const dirX = pe.x - C.x;
      const dirY = pe.y - C.y;
      const dLen = Math.hypot(dirX, dirY) || 1;
      pe.x = bestCenter[0] + (newR * dirX) / dLen;
      pe.y = bestCenter[1] + (newR * dirY) / dLen;

      const roots = pccRoots(pe, T1, o.sg ?? 1, T2, o.sg2 ?? 1);
      let bestKk = -1;
      let bestRootErr = 1e18;
      roots.forEach((q, kk) => {
        if (q.r > 1e-9) {
          const err = Math.hypot(q.x - bestCenter![0], q.y - bestCenter![1]) + Math.abs(q.r - newR);
          if (err < bestRootErr) {
            bestRootErr = err;
            bestKk = kk;
          }
        }
      });
      if (bestKk < 0 || bestRootErr > 0.5) {
        return { ok: false, reason: 'Solução de dupla tangência não encontrada para esse raio.' };
      }
      o.kk = bestKk;
      o.ang = Math.atan2(bestCenter[1] - pe.y, bestCenter[0] - pe.x);
    }
  } else if (o.tanSet && o.tanSet.length >= 2) {
    if (o.tanSet.length >= 3) {
      return {
        ok: false,
        reason: 'Círculo tangente a 3 ou mais objetos tem raio fixado pelas tangências.',
      };
    }
    const T1 = targetFromObj(next, o.tanSet[0], (id) => curve(next, getObj(next, id)));
    const T2 = targetFromObj(next, o.tanSet[1], (id) => curve(next, getObj(next, id)));
    if (!T1 || !T2) {
      return { ok: false, reason: 'Objetos tangentes inválidos.' };
    }
    const sg1 = o.tanSigns?.[0] ?? 1;
    const sg2 = o.tanSigns?.[1] ?? 1;
    const off1 = targetOffsetCurve(T1, sg1, newR);
    const off2 = targetOffsetCurve(T2, sg2, newR);
    if (!off1 || !off2) {
      return { ok: false, reason: 'Raio incompatível com as tangências conectadas.' };
    }
    let bestCenter: [number, number] | null = null;
    let bestD = 1e18;
    for (const s of [1, -1]) {
      const pt = inter(off1, off2, s);
      if (pt) {
        const d = Math.hypot(pt[0] - C.x, pt[1] - C.y);
        if (d < bestD) {
          bestD = d;
          bestCenter = pt;
        }
      }
    }
    if (!bestCenter) {
      return { ok: false, reason: 'Não existe círculo desse tamanho tangente aos 2 objetos.' };
    }
    o.tanFixedR = true;
    o.tanRef = { x: bestCenter[0], y: bestCenter[1], r: newR };
  } else {
    return { ok: false, reason: 'Tipo de círculo não suporta edição direta.' };
  }

  recalc(next);
  const check = curve(next, getObj(next, circleId));
  if (!check || check.t !== 'c' || Math.abs(check.r - newR) > 0.1) {
    return { ok: false, reason: 'Esse raio viola as restrições das tangentes conectadas.' };
  }

  return { ok: true, next };
}

type TanTarget =
  | { kind: 'p'; id: number; x: number; y: number; r: 0 }
  | { kind: 'l'; id: number; nx: number; ny: number; d0: number; raw: LineCurve }
  | { kind: 'c'; id: number; x: number; y: number; r: number };

function targetFromObj(
  objs: GeomObj[],
  id: number | undefined,
  getCurve: (id: number | undefined) => Curve | null
): TanTarget | null {
  const o = getObj(objs, id);
  if (!o || o.dead) return null;
  if (o.t === 'pt') {
    if (!o.ok) return null;
    return { kind: 'p', id: o.id, x: o.x, y: o.y, r: 0 };
  }
  const cv = getCurve(o.id);
  if (!cv) return null;
  if (cv.t === 'l') {
    const n = Math.hypot(cv.dx, cv.dy);
    if (n < 1e-12) return null;
    const nx = -cv.dy / n;
    const ny = cv.dx / n;
    return { kind: 'l', id: o.id, nx, ny, d0: nx * cv.x + ny * cv.y, raw: cv };
  }
  return { kind: 'c', id: o.id, x: cv.x, y: cv.y, r: cv.r };
}

function targetOffsetCurve(T: TanTarget, sg: number, r: number): Curve | null {
  if (r <= 1e-9) return null;
  if (T.kind === 'p') {
    return { t: 'c', x: T.x, y: T.y, r };
  }
  if (T.kind === 'l') {
    const d = T.d0 + sg * r;
    return { t: 'l', x: T.nx * d, y: T.ny * d, dx: -T.ny, dy: T.nx };
  }
  if (sg === 1) {
    return { t: 'c', x: T.x, y: T.y, r: T.r + r };
  }
  if (sg === -1) {
    return r > T.r + 1e-9 ? { t: 'c', x: T.x, y: T.y, r: r - T.r } : null;
  }
  return T.r > r + 1e-9 ? { t: 'c', x: T.x, y: T.y, r: T.r - r } : null;
}

function signedRadiusAt(T: TanTarget, sg: number, x: number, y: number): number {
  if (T.kind === 'p') return Math.hypot(x - T.x, y - T.y);
  if (T.kind === 'l') return sg * (T.nx * x + T.ny * y - T.d0);
  const D = Math.hypot(x - T.x, y - T.y);
  if (sg === 1) return D - T.r;
  if (sg === -1) return D + T.r;
  return T.r - D;
}

function gradAt(T: TanTarget, sg: number, x: number, y: number): [number, number] {
  if (T.kind === 'l') return [sg * T.nx, sg * T.ny];
  const dx = x - T.x;
  const dy = y - T.y;
  const D = Math.hypot(dx, dy);
  if (D < 1e-12) return sg === -2 ? [-1, 0] : [1, 0];
  const s = sg === -2 ? -1 : 1;
  return [(s * dx) / D, (s * dy) / D];
}

function targetContactPoint(T: TanTarget, cx: number, cy: number, r: number): { x: number; y: number } {
  if (T.kind === 'p') return { x: T.x, y: T.y };
  if (T.kind === 'l') {
    const p = projectOnCurve(T.raw, cx, cy);
    return { x: p.x, y: p.y };
  }
  const dx = cx - T.x;
  const dy = cy - T.y;
  const D = Math.hypot(dx, dy);
  if (D < 1e-9) return { x: T.x + T.r, y: T.y };
  const dExt = Math.abs(D - (r + T.r));
  const dIn = Math.abs(D - (T.r - r));
  const dEnc = Math.abs(D - (r - T.r));
  const k = dEnc < dExt && dEnc < dIn && r > T.r ? -1 : 1;
  return { x: T.x + (k * T.r * dx) / D, y: T.y + (k * T.r * dy) / D };
}

function targetMinResidual(T: TanTarget, cx: number, cy: number, r: number): { err: number; sg: number } {
  if (T.kind === 'p') {
    return { err: Math.abs(Math.hypot(cx - T.x, cy - T.y) - r), sg: 1 };
  }
  if (T.kind === 'l') {
    const s1 = T.nx * cx + T.ny * cy - T.d0;
    const e1 = Math.abs(s1 - r);
    const e2 = Math.abs(-s1 - r);
    return e1 <= e2 ? { err: e1, sg: 1 } : { err: e2, sg: -1 };
  }
  const D = Math.hypot(cx - T.x, cy - T.y);
  const eExt = Math.abs(D - (r + T.r));
  const eEnc = r > T.r ? Math.abs(D - (r - T.r)) : 1e18;
  const eIn = r < T.r ? Math.abs(D - (T.r - r)) : 1e18;
  if (eEnc <= eExt && eEnc <= eIn) return { err: eEnc, sg: -1 };
  if (eIn <= eExt && eIn <= eEnc) return { err: eIn, sg: -2 };
  return { err: eExt, sg: 1 };
}

function isCopyOfTargetCircle(targets: TanTarget[], cx: number, cy: number, r: number): boolean {
  for (const T of targets) {
    if (T.kind === 'c' && Math.hypot(cx - T.x, cy - T.y) < 1e-3 && Math.abs(r - T.r) < 1e-3) {
      return true;
    }
  }
  return false;
}

function modesForTarget(T: TanTarget): number[] {
  if (T.kind === 'p') return [1];
  if (T.kind === 'l') return [1, -1];
  return [1, -1, -2];
}

function solve3x3(
  A: [[number, number, number], [number, number, number], [number, number, number]],
  b: [number, number, number]
): [number, number, number] | null {
  const M = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[piv][col])) piv = row;
    }
    if (Math.abs(M[piv][col]) < 1e-11) return null;
    if (piv !== col) {
      const tmp = M[col];
      M[col] = M[piv];
      M[piv] = tmp;
    }
    const div = M[col][col];
    for (let row = col + 1; row < 3; row++) {
      const f = M[row][col] / div;
      for (let k = col; k < 4; k++) M[row][k] -= f * M[col][k];
    }
  }
  const x2 = M[2][3] / M[2][2];
  const x1 = (M[1][3] - M[1][2] * x2) / M[1][1];
  const x0 = (M[0][3] - M[0][1] * x1 - M[0][2] * x2) / M[0][0];
  return Number.isFinite(x0) && Number.isFinite(x1) && Number.isFinite(x2) ? [x0, x1, x2] : null;
}

function apollonius3Candidates(T0: TanTarget, T1: TanTarget, T2: TanTarget): MultiTanSolution[] {
  const targets = [T0, T1, T2];
  // Compute centering origin + scale for numeric stability
  let ox = 0;
  let oy = 0;
  let countPts = 0;
  let maxR = 1;
  for (const T of targets) {
    if (T.kind === 'l') {
      ox += T.raw.x;
      oy += T.raw.y;
      countPts++;
    } else {
      ox += T.x;
      oy += T.y;
      countPts++;
      maxR = Math.max(maxR, T.r);
    }
  }
  ox /= Math.max(1, countPts);
  oy /= Math.max(1, countPts);

  let maxDist = maxR;
  for (const T of targets) {
    if (T.kind === 'l') {
      maxDist = Math.max(maxDist, Math.abs(T.nx * ox + T.ny * oy - T.d0));
    } else {
      maxDist = Math.max(maxDist, Math.hypot(T.x - ox, T.y - oy) + T.r);
    }
  }
  const scale = Math.max(1, maxDist);
  const invS = 1 / scale;

  const norm: TanTarget[] = targets.map((T) => {
    if (T.kind === 'p') {
      return { kind: 'p', id: T.id, x: (T.x - ox) * invS, y: (T.y - oy) * invS, r: 0 };
    }
    if (T.kind === 'l') {
      return {
        kind: 'l',
        id: T.id,
        nx: T.nx,
        ny: T.ny,
        d0: (T.d0 - T.nx * ox - T.ny * oy) * invS,
        raw: T.raw,
      };
    }
    return { kind: 'c', id: T.id, x: (T.x - ox) * invS, y: (T.y - oy) * invS, r: T.r * invS };
  });

  const out: MultiTanSolution[] = [];
  const tryPush = (nx: number, ny: number, nr: number) => {
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nr) || nr <= 1e-7) return;
    const cx = ox + nx * scale;
    const cy = oy + ny * scale;
    const r = nr * scale;
    if (r <= 1e-4 || isCopyOfTargetCircle(targets, cx, cy, r)) return;
    const tol = Math.max(1e-3, 1e-4 * r);
    const signs: number[] = [];
    let maxError = 0;
    for (const T of targets) {
      const res = targetMinResidual(T, cx, cy, r);
      if (res.err > tol) return;
      if (res.err > maxError) maxError = res.err;
      signs.push(res.sg);
    }
    for (const ex of out) {
      if (Math.hypot(ex.cx - cx, ex.cy - cy) < 1e-3 && Math.abs(ex.r - r) < 1e-3) return;
    }
    out.push({
      cx,
      cy,
      r,
      signs,
      contacts: targets.map((T) => targetContactPoint(T, cx, cy, r)),
      maxError,
      exact: true,
    });
  };

  const sOpts0 = norm[0].kind === 'p' ? [1] : [1, -1];
  const sOpts1 = norm[1].kind === 'p' ? [1] : [1, -1];
  const sOpts2 = norm[2].kind === 'p' ? [1] : [1, -1];

  const lineEq = (T: Extract<TanTarget, { kind: 'l' }>, s: number): [number, number, number, number] => [
    s * T.nx,
    s * T.ny,
    -1,
    s * T.d0,
  ];
  const cpDiffEq = (
    A: Exclude<TanTarget, { kind: 'l' }>,
    sA: number,
    B: Exclude<TanTarget, { kind: 'l' }>,
    sB: number
  ): [number, number, number, number] => [
    2 * (B.x - A.x),
    2 * (B.y - A.y),
    2 * (sB * B.r - sA * A.r),
    B.x * B.x + B.y * B.y - B.r * B.r - (A.x * A.x + A.y * A.y - A.r * A.r),
  ];

  const solveTwoLinOneQuad = (
    eq1: [number, number, number, number],
    eq2: [number, number, number, number],
    Q: Exclude<TanTarget, { kind: 'l' }>,
    sQ: number
  ) => {
    const [a1, b1, c1, d1] = eq1;
    const [a2, b2, c2, d2] = eq2;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) > 1e-8) {
      const p0 = (d1 * b2 - d2 * b1) / det;
      const p1 = (-c1 * b2 + c2 * b1) / det;
      const q0 = (a1 * d2 - a2 * d1) / det;
      const q1 = (-a1 * c2 + a2 * c1) / det;
      const ex = p0 - Q.x;
      const ey = q0 - Q.y;
      const qa = p1 * p1 + q1 * q1 - 1;
      const qb = 2 * (p1 * ex + q1 * ey - sQ * Q.r);
      const qc = ex * ex + ey * ey - Q.r * Q.r;
      const rs: number[] = [];
      if (Math.abs(qa) < 1e-11) {
        if (Math.abs(qb) > 1e-11) rs.push(-qc / qb);
      } else {
        const D = qb * qb - 4 * qa * qc;
        if (D >= -1e-10) {
          const sq = Math.sqrt(Math.max(0, D));
          rs.push((-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa));
        }
      }
      for (const r of rs) {
        tryPush(p0 + p1 * r, q0 + q1 * r, r);
      }
      return;
    }

    // Degenerate (parallel lines or collinear equal-radii circles): eliminate max xy coeff to find r
    let r1 = eq1;
    let r2 = eq2;
    if (Math.max(Math.abs(a2), Math.abs(b2)) > Math.max(Math.abs(a1), Math.abs(b1))) {
      r1 = eq2;
      r2 = eq1;
    }
    const useX = Math.abs(r1[0]) >= Math.abs(r1[1]);
    const piv = useX ? r1[0] : r1[1];
    if (Math.abs(piv) < 1e-10) return;
    const factor = (useX ? r2[0] : r2[1]) / piv;
    const remC = r2[2] - factor * r1[2];
    const remD = r2[3] - factor * r1[3];
    if (Math.abs(remC) < 1e-10) return;
    const r = remD / remC;
    if (r <= 1e-7) return;
    const rhs = r1[3] - r1[2] * r;
    const lineL: LineCurve = {
      t: 'l',
      x: useX ? rhs / r1[0] : 0,
      y: useX ? 0 : rhs / r1[1],
      dx: -r1[1],
      dy: r1[0],
    };
    const rad = Math.abs(r + sQ * Q.r);
    if (rad < 1e-9) {
      const foot = projectOnCurve(lineL, Q.x, Q.y);
      tryPush(foot.x, foot.y, r);
      return;
    }
    const circ: CircleCurve = { t: 'c', x: Q.x, y: Q.y, r: rad };
    for (const s of [1, -1]) {
      const pt = inter(lineL, circ, s);
      if (pt) tryPush(pt[0], pt[1], r);
    }
  };

  for (const s0 of sOpts0) {
    for (const s1 of sOpts1) {
      for (const s2 of sOpts2) {
        const paired: Array<{ t: TanTarget; s: number }> = [
          { t: norm[0], s: s0 },
          { t: norm[1], s: s1 },
          { t: norm[2], s: s2 },
        ];
        const lines = paired.filter((p): p is { t: Extract<TanTarget, { kind: 'l' }>; s: number } => p.t.kind === 'l');
        const cps = paired.filter((p): p is { t: Exclude<TanTarget, { kind: 'l' }>; s: number } => p.t.kind !== 'l');

        if (lines.length === 3) {
          const e0 = lineEq(lines[0].t, lines[0].s);
          const e1 = lineEq(lines[1].t, lines[1].s);
          const e2 = lineEq(lines[2].t, lines[2].s);
          const sol = solve3x3(
            [
              [e0[0], e0[1], e0[2]],
              [e1[0], e1[1], e1[2]],
              [e2[0], e2[1], e2[2]],
            ],
            [e0[3], e1[3], e2[3]]
          );
          if (sol) tryPush(sol[0], sol[1], sol[2]);
        } else if (lines.length === 2) {
          solveTwoLinOneQuad(
            lineEq(lines[0].t, lines[0].s),
            lineEq(lines[1].t, lines[1].s),
            cps[0].t,
            cps[0].s
          );
        } else if (lines.length === 1) {
          solveTwoLinOneQuad(
            lineEq(lines[0].t, lines[0].s),
            cpDiffEq(cps[0].t, cps[0].s, cps[1].t, cps[1].s),
            cps[0].t,
            cps[0].s
          );
        } else {
          solveTwoLinOneQuad(
            cpDiffEq(cps[0].t, cps[0].s, cps[1].t, cps[1].s),
            cpDiffEq(cps[0].t, cps[0].s, cps[2].t, cps[2].s),
            cps[0].t,
            cps[0].s
          );
        }
      }
    }
  }

  return out;
}

function solveTangent2Mode(
  T0: TanTarget,
  sg0: number,
  T1: TanTarget,
  sg1: number,
  seedX: number,
  seedY: number
): { cx: number; cy: number; r: number } | null {
  const trySeed = (sx: number, sy: number): { cx: number; cy: number; r: number } | null => {
    let px = sx;
    let py = sy;
    if (T0.kind !== 'l' && Math.hypot(px - T0.x, py - T0.y) < 1e-6) {
      px += 1e-2;
      py += 7e-3;
    }
    if (T1.kind !== 'l' && Math.hypot(px - T1.x, py - T1.y) < 1e-6) {
      px -= 7e-3;
      py += 1e-2;
    }

    for (let it = 0; it < 16; it++) {
      const f0 = signedRadiusAt(T0, sg0, px, py);
      const f1 = signedRadiusAt(T1, sg1, px, py);
      const h = f0 - f1;
      if (Math.abs(h) < 1e-9) break;
      const g0 = gradAt(T0, sg0, px, py);
      const g1 = gradAt(T1, sg1, px, py);
      const gx = g0[0] - g1[0];
      const gy = g0[1] - g1[1];
      const g2 = gx * gx + gy * gy;
      if (g2 < 1e-10) break;
      const step = h / g2;
      px -= step * gx;
      py -= step * gy;
      if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    }

    const r0 = signedRadiusAt(T0, sg0, px, py);
    const r1 = signedRadiusAt(T1, sg1, px, py);
    const rEst = (r0 + r1) / 2;
    if (!Number.isFinite(rEst) || rEst <= 1e-4) return null;

    let cx = px;
    let cy = py;
    const off0 = targetOffsetCurve(T0, sg0, rEst);
    const off1 = targetOffsetCurve(T1, sg1, rEst);
    if (off0 && off1) {
      let bestD = 1e18;
      let bestPt: [number, number] | null = null;
      for (const s of [1, -1]) {
        const pt = inter(off0, off1, s);
        if (pt) {
          const d = Math.hypot(pt[0] - px, pt[1] - py);
          if (d < bestD) {
            bestD = d;
            bestPt = pt;
          }
        }
      }
      if (bestPt && bestD < Math.max(5, 0.25 * rEst)) {
        cx = bestPt[0];
        cy = bestPt[1];
      }
    }

    const e0 = Math.abs(signedRadiusAt(T0, sg0, cx, cy) - rEst);
    const e1 = Math.abs(signedRadiusAt(T1, sg1, cx, cy) - rEst);
    const tol = Math.max(1e-2, 1e-3 * rEst);
    if (e0 > tol || e1 > tol) return null;
    if (isCopyOfTargetCircle([T0, T1], cx, cy, rEst)) return null;
    return { cx, cy, r: rEst };
  };

  const direct = trySeed(seedX, seedY);
  if (direct) return direct;

  // Fallback seeds (useful for internal or wrapped configurations)
  const p0 = T0.kind === 'l' ? projectOnCurve(T0.raw, seedX, seedY) : { x: T0.x, y: T0.y };
  const p1 = T1.kind === 'l' ? projectOnCurve(T1.raw, seedX, seedY) : { x: T1.x, y: T1.y };
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  const fallbacks: Array<[number, number]> = [
    [mx, my],
    [mx + (p1.y - p0.y) * 0.35, my - (p1.x - p0.x) * 0.35],
    [mx - (p1.y - p0.y) * 0.35, my + (p1.x - p0.x) * 0.35],
  ];
  for (const [fx, fy] of fallbacks) {
    const sol = trySeed(fx, fy);
    if (sol) return sol;
  }
  return null;
}

function solveTangent2All(
  T0: TanTarget,
  T1: TanTarget,
  x: number,
  y: number,
  hints?: Array<{ x: number; y: number }>
): MultiTanSolution[] {
  const cands: Array<MultiTanSolution & { score: number }> = [];
  for (const sg0 of modesForTarget(T0)) {
    for (const sg1 of modesForTarget(T1)) {
      const sol = solveTangent2Mode(T0, sg0, T1, sg1, x, y);
      if (!sol) continue;
      const c0 = targetContactPoint(T0, sol.cx, sol.cy, sol.r);
      const c1 = targetContactPoint(T1, sol.cx, sol.cy, sol.r);
      let dup = false;
      for (const ex of cands) {
        if (Math.hypot(ex.cx - sol.cx, ex.cy - sol.cy) < 1e-2 && Math.abs(ex.r - sol.r) < 1e-2) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      let hintDist = 0;
      if (hints && hints.length >= 2) {
        hintDist = Math.hypot(c0.x - hints[0].x, c0.y - hints[0].y) + Math.hypot(c1.x - hints[1].x, c1.y - hints[1].y);
      }
      const centerDist = Math.hypot(sol.cx - x, sol.cy - y);
      cands.push({
        cx: sol.cx,
        cy: sol.cy,
        r: sol.r,
        signs: [sg0, sg1],
        contacts: [c0, c1],
        maxError: 0,
        exact: true,
        score: centerDist + 0.35 * hintDist,
      });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  return cands.map(({ score: _s, ...rest }) => rest);
}

function polishLeastSquares4(
  targets: TanTarget[],
  initX: number,
  initY: number,
  initR: number,
  fixedSigns?: number[]
): MultiTanSolution | null {
  let cx = initX;
  let cy = initY;
  let r = Math.max(1, initR);

  for (let it = 0; it < 16; it++) {
    let j00 = 1e-4;
    let j01 = 0;
    let j02 = 0;
    let j11 = 1e-4;
    let j12 = 0;
    let j22 = 1e-4;
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;

    for (let i = 0; i < targets.length; i++) {
      const T = targets[i];
      const sg = fixedSigns ? fixedSigns[i] : targetMinResidual(T, cx, cy, r).sg;
      const err = signedRadiusAt(T, sg, cx, cy) - r;
      const [gx, gy] = gradAt(T, sg, cx, cy);
      const gz = -1;
      j00 += gx * gx;
      j01 += gx * gy;
      j02 += gx * gz;
      j11 += gy * gy;
      j12 += gy * gz;
      j22 += gz * gz;
      b0 -= gx * err;
      b1 -= gy * err;
      b2 -= gz * err;
    }

    const delta = solve3x3(
      [
        [j00, j01, j02],
        [j01, j11, j12],
        [j02, j12, j22],
      ],
      [b0, b1, b2]
    );
    if (!delta) break;
    cx += delta[0];
    cy += delta[1];
    r = Math.max(1e-3, r + delta[2]);
    if (Math.hypot(delta[0], delta[1], delta[2]) < 1e-8) break;
  }

  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 1e-3) return null;
  if (isCopyOfTargetCircle(targets, cx, cy, r)) return null;

  const signs: number[] = [];
  let maxError = 0;
  for (let i = 0; i < targets.length; i++) {
    const res = targetMinResidual(targets[i], cx, cy, r);
    signs.push(fixedSigns ? fixedSigns[i] : res.sg);
    if (res.err > maxError) maxError = res.err;
  }

  return {
    cx,
    cy,
    r,
    signs,
    contacts: targets.map((T) => targetContactPoint(T, cx, cy, r)),
    maxError,
    exact: maxError < Math.max(0.05, 1e-3 * r),
  };
}

function solveTangent4All(targets: TanTarget[], x: number, y: number): MultiTanSolution[] {
  const triples: Array<[number, number, number]> = [
    [0, 1, 2],
    [0, 1, 3],
    [0, 2, 3],
    [1, 2, 3],
  ];
  const rawSeeds: Array<{ cx: number; cy: number; r: number; fourthErr: number }> = [];
  const exactOut: MultiTanSolution[] = [];

  for (const [i, j, k] of triples) {
    const remIdx = 6 - i - j - k;
    const remT = targets[remIdx];
    const cands = apollonius3Candidates(targets[i], targets[j], targets[k]);
    for (const c of cands) {
      const err4 = targetMinResidual(remT, c.cx, c.cy, c.r).err;
      rawSeeds.push({ cx: c.cx, cy: c.cy, r: c.r, fourthErr: err4 });
      if (err4 < Math.max(0.15, 2e-3 * c.r)) {
        const polished = polishLeastSquares4(targets, c.cx, c.cy, c.r);
        if (polished && polished.exact) {
          let dup = false;
          for (const ex of exactOut) {
            if (Math.hypot(ex.cx - polished.cx, ex.cy - polished.cy) < 0.05 && Math.abs(ex.r - polished.r) < 0.05) {
              dup = true;
              break;
            }
          }
          if (!dup) exactOut.push(polished);
        }
      }
    }
  }

  const scoreSol = (s: MultiTanSolution) =>
    Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.r) + 0.18 * Math.hypot(x - s.cx, y - s.cy);

  if (exactOut.length > 0) {
    exactOut.sort((a, b) => scoreSol(a) - scoreSol(b));
    return exactOut;
  }

  // No exact 4-tangent circle exists: compute best least-squares tangent fits from top seeds
  rawSeeds.sort((a, b) => a.fourthErr - b.fourthErr);
  const approxOut: MultiTanSolution[] = [];
  const topSeeds = rawSeeds.slice(0, 12);
  let sx = 0;
  let sy = 0;
  for (const T of targets) {
    if (T.kind === 'l') {
      const p = projectOnCurve(T.raw, x, y);
      sx += p.x;
      sy += p.y;
    } else {
      sx += T.x;
      sy += T.y;
    }
  }
  topSeeds.push({ cx: sx / targets.length, cy: sy / targets.length, r: 50, fourthErr: 0 });

  for (const seed of topSeeds) {
    const fit = polishLeastSquares4(targets, seed.cx, seed.cy, seed.r);
    if (!fit) continue;
    let dup = false;
    for (const ex of approxOut) {
      if (Math.hypot(ex.cx - fit.cx, ex.cy - fit.cy) < 0.5 && Math.abs(ex.r - fit.r) < 0.5) {
        dup = true;
        break;
      }
    }
    if (!dup) approxOut.push(fit);
  }

  approxOut.sort((a, b) => a.maxError - b.maxError || scoreSol(a) - scoreSol(b));
  return approxOut;
}

export function solveMultiTangent(
  objs: GeomObj[],
  selected: TanTargetSel[],
  x: number,
  y: number,
  curveCache?: Array<Curve | null>
): MultiTanSolution[] {
  if (selected.length < 2 || selected.length > 4) return [];
  const targets: TanTarget[] = [];
  const hints: Array<{ x: number; y: number }> = [];
  for (const sel of selected) {
    const T = targetFromObj(objs, sel.id, (id) => curve(objs, getObj(objs, id), curveCache));
    if (!T) return [];
    targets.push(T);
    hints.push({ x: sel.hx, y: sel.hy });
  }

  if (targets.length === 2) {
    return solveTangent2All(targets[0], targets[1], x, y, hints);
  }

  if (targets.length === 3) {
    const cands = apollonius3Candidates(targets[0], targets[1], targets[2]);
    cands.sort((a, b) => {
      const sa = Math.abs(Math.hypot(x - a.cx, y - a.cy) - a.r) + 0.18 * Math.hypot(x - a.cx, y - a.cy);
      const sb = Math.abs(Math.hypot(x - b.cx, y - b.cy) - b.r) + 0.18 * Math.hypot(x - b.cx, y - b.cy);
      return sa - sb;
    });
    return cands;
  }

  return solveTangent4All(targets, x, y);
}

function resolveMultiTanCircleWith(
  objs: GeomObj[],
  o: CircleObj,
  getCurve: (id: number | undefined) => Curve | null
): CircleCurve | null {
  if (!o.tanSet || o.tanSet.length < 2 || !o.tanRef) return null;
  const targets: TanTarget[] = [];
  for (const id of o.tanSet) {
    const T = targetFromObj(objs, id, getCurve);
    if (!T) return null;
    targets.push(T);
  }
  const ref = o.tanRef;
  const signs = o.tanSigns;

  if (targets.length === 2) {
    const sg0 = signs?.[0] ?? 1;
    const sg1 = signs?.[1] ?? 1;
    if (o.tanFixedR) {
      const off0 = targetOffsetCurve(targets[0], sg0, ref.r);
      const off1 = targetOffsetCurve(targets[1], sg1, ref.r);
      if (off0 && off1) {
        let best: [number, number] | null = null;
        let bd = 1e18;
        for (const s of [1, -1]) {
          const pt = inter(off0, off1, s);
          if (pt) {
            const d = Math.hypot(pt[0] - ref.x, pt[1] - ref.y);
            if (d < bd) {
              bd = d;
              best = pt;
            }
          }
        }
        if (best) return { t: 'c', x: best[0], y: best[1], r: ref.r };
      }
    }
    const sol = solveTangent2Mode(targets[0], sg0, targets[1], sg1, ref.x, ref.y);
    return sol ? { t: 'c', x: sol.cx, y: sol.cy, r: sol.r } : null;
  }

  if (targets.length === 3) {
    const cands = apollonius3Candidates(targets[0], targets[1], targets[2]);
    if (cands.length === 0) return null;
    let best = cands[0];
    let bestScore = 1e18;
    for (const c of cands) {
      const signMatch =
        signs && signs.length === 3 && signs.every((s, idx) => s === c.signs[idx]) ? 0 : 1000;
      const d = Math.hypot(c.cx - ref.x, c.cy - ref.y) + Math.abs(c.r - ref.r) + signMatch;
      if (d < bestScore) {
        bestScore = d;
        best = c;
      }
    }
    return { t: 'c', x: best.cx, y: best.cy, r: best.r };
  }

  // 4 objects
  const cands = solveTangent4All(targets, ref.x, ref.y);
  if (cands.length > 0) {
    let best = cands[0];
    let bestScore = 1e18;
    for (const c of cands) {
      const signMatch =
        signs && signs.length === 4 && signs.every((s, idx) => s === c.signs[idx]) ? 0 : 500;
      const d = Math.hypot(c.cx - ref.x, c.cy - ref.y) + Math.abs(c.r - ref.r) + signMatch;
      if (d < bestScore) {
        bestScore = d;
        best = c;
      }
    }
    return { t: 'c', x: best.cx, y: best.cy, r: best.r };
  }

  const fallback = polishLeastSquares4(targets, ref.x, ref.y, ref.r, signs);
  return fallback ? { t: 'c', x: fallback.cx, y: fallback.cy, r: fallback.r } : null;
}

export function createDemoObjs(view: ViewState, width: number, height: number): GeomObj[] {
  const next: GeomObj[] = [];
  const cx = view.x + width / view.k / 2;
  const cy = view.y + height / view.k / 2;
  const r = Math.min(width, height) / view.k / 6.5;

  const p0 = addObj(next, { t: 'pt', free: true, x: cx, y: cy });
  const p1 = addObj(next, { t: 'pt', free: true, x: cx + r, y: cy });
  const c0 = addObj(next, { t: 'ci', c: p0, p: p1 });
  const c1 = addObj(next, { t: 'ci', c: p1, p: p0 });
  const a = addObj(next, { t: 'pt', free: false, x: 0, y: 0, a: c0, b: c1, s: 1 });
  const b = addObj(next, { t: 'pt', free: false, x: 0, y: 0, a: c0, b: c1, s: -1 });
  const c2 = addObj(next, { t: 'ci', c: a, p: p0 });
  const c3 = addObj(next, { t: 'ci', c: b, p: p0 });
  addObj(next, { t: 'ln', a, b });
  const l = addObj(next, { t: 'ln', a: p0, b: p1 });
  for (const c of [c2, c3]) {
    for (const s of [1, -1]) {
      addObj(next, { t: 'pt', free: false, x: 0, y: 0, a: c, b: l, s });
    }
  }
  const q = addObj(next, { t: 'pt', free: true, x: cx - r * 2.6, y: cy - r * 1.2 });
  const tc = addObj(next, { t: 'ci', c: q, tan: c0, m: 0 });
  addObj(next, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: tc, tg: c0 });

  return next;
}

function isAlreadyTangentTo(o: GeomObj, targetId: number): boolean {
  if (o.t === 'ci') {
    return o.tan === targetId || o.tan2 === targetId || (o.tanSet?.includes(targetId) ?? false);
  }
  if (o.t === 'ln') {
    return o.to === targetId || (o.cc?.includes(targetId) ?? false);
  }
  return false;
}

function isPointUsedElsewhere(objs: GeomObj[], ptId: number, ignoreObjId: number): boolean {
  for (const q of objs) {
    if (q.dead || q.id === ignoreObjId) continue;
    if (refsOf(q).includes(ptId)) return true;
  }
  return false;
}

export function canCurveConnectTangent(
  objs: GeomObj[],
  firstId: number,
  secondId: number,
  options?: { fixedCenter?: boolean; anchorEnd?: 'a' | 'b'; forDrag?: boolean }
): boolean {
  if (firstId === secondId) return false;
  const first = getObj(objs, firstId);
  const second = getObj(objs, secondId);
  if (!first || !second || first.dead || second.dead) return false;
  if (first.t === 'pt' || second.t === 'pt') return false;
  if (descOf(objs, firstId).has(secondId)) return false;
  if (isAlreadyTangentTo(first, secondId)) return false;

  if (first.t === 'ci') {
    if (first.tanSet && first.tanSet.length >= 2) return false;
    if (first.e !== undefined) return false;
    if (options?.fixedCenter) {
      if (first.c === undefined) return false;
      const pc = getObj(objs, first.c);
      return !!pc && pc.t === 'pt' && !!pc.ok;
    }
    return true;
  }

  // first.t === 'ln'
  if (second.t !== 'ci') return false;
  if (first.a === undefined || first.b === undefined) return false;
  const pa = getObj(objs, first.a);
  const pb = getObj(objs, first.b);
  if (!pa || !pb || pa.t !== 'pt' || pb.t !== 'pt' || !pa.ok || !pb.ok) return false;
  if (options?.anchorEnd === 'a') return pb.free;
  if (options?.anchorEnd === 'b') return pa.free;
  if (options?.forDrag) return pa.free && pb.free;
  return pa.free || pb.free;
}

export function computeTangencyCandidates(
  objs: GeomObj[],
  firstId: number,
  secondId: number,
  options?: {
    fixedCenter?: boolean;
    anchorEnd?: 'a' | 'b';
    forDrag?: boolean;
    curveCache?: Array<Curve | null>;
  }
): TangencyCandidate[] {
  if (!canCurveConnectTangent(objs, firstId, secondId, options)) return [];
  const first = getObj(objs, firstId)!;
  const second = getObj(objs, secondId)!;
  const cCache = options?.curveCache;
  const C1 = curve(objs, first, cCache);
  const C2 = curve(objs, second, cCache);
  if (!C1 || !C2) return [];

  const out: TangencyCandidate[] = [];

  if (C1.t === 'c' && C2.t === 'c' && first.t === 'ci') {
    let useFixedCenter = !!options?.fixedCenter;
    if (!useFixedCenter && first.c !== undefined && first.tan === undefined) {
      const pc = getObj(objs, first.c);
      if (pc && pc.t === 'pt' && !pc.free) {
        useFixedCenter = true;
      }
    }

    const dx = C1.x - C2.x;
    const dy = C1.y - C2.y;
    const D = Math.hypot(dx, dy);
    const ux = D > 1e-6 ? dx / D : 1;
    const uy = D > 1e-6 ? dy / D : 0;

    if (useFixedCenter) {
      if (D > C2.r + 1e-2) {
        const newR = D - C2.r;
        const contact = { x: C2.x + C2.r * ux, y: C2.y + C2.r * uy };
        out.push({
          key: `${firstId}-${secondId}-fc-ext`,
          firstId,
          secondId,
          contact,
          previewCurve: { t: 'c', x: C1.x, y: C1.y, r: newR },
          guideline: { x1: C1.x, y1: C1.y, x2: contact.x, y2: contact.y },
          kind: 'ci-ci',
          m: 0,
          fixedCenter: true,
          newCenter: { x: C1.x, y: C1.y },
          newRadius: newR,
          gap: Math.abs(C1.r - newR),
          label: 'Tangência externa',
        });
      }
      if (D < C2.r - 1e-2) {
        const newR = C2.r - D;
        const contact = { x: C2.x + C2.r * ux, y: C2.y + C2.r * uy };
        out.push({
          key: `${firstId}-${secondId}-fc-in`,
          firstId,
          secondId,
          contact,
          previewCurve: { t: 'c', x: C1.x, y: C1.y, r: newR },
          guideline: { x1: C1.x, y1: C1.y, x2: contact.x, y2: contact.y },
          kind: 'ci-ci',
          m: 1,
          fixedCenter: true,
          newCenter: { x: C1.x, y: C1.y },
          newRadius: newR,
          gap: Math.abs(C1.r - newR),
          label: 'Tangência interna',
        });
      }
      if (D > 1e-2) {
        const newR = D + C2.r;
        const contact = { x: C2.x - C2.r * ux, y: C2.y - C2.r * uy };
        out.push({
          key: `${firstId}-${secondId}-fc-enc`,
          firstId,
          secondId,
          contact,
          previewCurve: { t: 'c', x: C1.x, y: C1.y, r: newR },
          guideline: { x1: C1.x, y1: C1.y, x2: contact.x, y2: contact.y },
          kind: 'ci-ci',
          m: 2,
          fixedCenter: true,
          newCenter: { x: C1.x, y: C1.y },
          newRadius: newR,
          gap: Math.abs(C1.r - newR),
          label: 'Tangência envolvente',
        });
      }
      return out;
    }

    // Movable circle (preserves radius C1.r)
    const nearPt = { x: C2.x + C2.r * ux, y: C2.y + C2.r * uy };
    const farPt = { x: C2.x - C2.r * ux, y: C2.y - C2.r * uy };

    if (D < C2.r && C1.r < C2.r - 1e-2) {
      const cx = C2.x + (C2.r - C1.r) * ux;
      const cy = C2.y + (C2.r - C1.r) * uy;
      out.push({
        key: `${firstId}-${secondId}-mv-in-near`,
        firstId,
        secondId,
        contact: nearPt,
        previewCurve: { t: 'c', x: cx, y: cy, r: C1.r },
        guideline: { x1: cx, y1: cy, x2: nearPt.x, y2: nearPt.y },
        kind: 'ci-ci',
        m: 1,
        fixedCenter: false,
        newCenter: { x: cx, y: cy },
        newRadius: C1.r,
        gap: Math.abs(D - (C2.r - C1.r)),
        label: 'Tangência interna',
      });
    } else {
      const cx = C2.x + (C2.r + C1.r) * ux;
      const cy = C2.y + (C2.r + C1.r) * uy;
      out.push({
        key: `${firstId}-${secondId}-mv-ext`,
        firstId,
        secondId,
        contact: nearPt,
        previewCurve: { t: 'c', x: cx, y: cy, r: C1.r },
        guideline: { x1: cx, y1: cy, x2: nearPt.x, y2: nearPt.y },
        kind: 'ci-ci',
        m: 0,
        fixedCenter: false,
        newCenter: { x: cx, y: cy },
        newRadius: C1.r,
        gap: Math.abs(D - (C2.r + C1.r)),
        label: 'Tangência externa',
      });
    }

    if (C1.r > C2.r + 1e-2) {
      const cx = C2.x + (C1.r - C2.r) * ux;
      const cy = C2.y + (C1.r - C2.r) * uy;
      out.push({
        key: `${firstId}-${secondId}-mv-enc`,
        firstId,
        secondId,
        contact: farPt,
        previewCurve: { t: 'c', x: cx, y: cy, r: C1.r },
        guideline: { x1: cx, y1: cy, x2: farPt.x, y2: farPt.y },
        kind: 'ci-ci',
        m: 2,
        fixedCenter: false,
        newCenter: { x: cx, y: cy },
        newRadius: C1.r,
        gap: Math.abs(D - (C1.r - C2.r)),
        label: 'Tangência envolvente',
      });
    } else if (C1.r < C2.r - 1e-2) {
      const cx = C2.x - (C2.r - C1.r) * ux;
      const cy = C2.y - (C2.r - C1.r) * uy;
      out.push({
        key: `${firstId}-${secondId}-mv-in-far`,
        firstId,
        secondId,
        contact: farPt,
        previewCurve: { t: 'c', x: cx, y: cy, r: C1.r },
        guideline: { x1: cx, y1: cy, x2: farPt.x, y2: farPt.y },
        kind: 'ci-ci',
        m: 1,
        fixedCenter: false,
        newCenter: { x: cx, y: cy },
        newRadius: C1.r,
        gap: Math.hypot(cx - C1.x, cy - C1.y),
        label: 'Tangência interna',
      });
    }
    return out;
  }

  if (C1.t === 'c' && C2.t === 'l' && first.t === 'ci') {
    let useFixedCenter = !!options?.fixedCenter;
    if (!useFixedCenter && first.c !== undefined && first.tan === undefined) {
      const pc = getObj(objs, first.c);
      if (pc && pc.t === 'pt' && !pc.free) {
        useFixedCenter = true;
      }
    }
    const proj = projectOnCurve(C2, C1.x, C1.y);
    const vx = C1.x - proj.x;
    const vy = C1.y - proj.y;
    const d = Math.hypot(vx, vy);
    const lLen = Math.hypot(C2.dx, C2.dy) || 1;
    const nx = d > 1e-6 ? vx / d : -C2.dy / lLen;
    const ny = d > 1e-6 ? vy / d : C2.dx / lLen;
    const contact = { x: proj.x, y: proj.y };

    if (useFixedCenter) {
      if (d > 1e-2) {
        out.push({
          key: `${firstId}-${secondId}-ci-ln-fc`,
          firstId,
          secondId,
          contact,
          previewCurve: { t: 'c', x: C1.x, y: C1.y, r: d },
          guideline: { x1: C1.x, y1: C1.y, x2: contact.x, y2: contact.y },
          kind: 'ci-ln',
          m: 0,
          fixedCenter: true,
          newCenter: { x: C1.x, y: C1.y },
          newRadius: d,
          gap: Math.abs(C1.r - d),
          label: 'Tangente à reta',
        });
      }
    } else {
      const cx = contact.x + C1.r * nx;
      const cy = contact.y + C1.r * ny;
      out.push({
        key: `${firstId}-${secondId}-ci-ln-mv`,
        firstId,
        secondId,
        contact,
        previewCurve: { t: 'c', x: cx, y: cy, r: C1.r },
        guideline: { x1: cx, y1: cy, x2: contact.x, y2: contact.y },
        kind: 'ci-ln',
        m: 0,
        fixedCenter: false,
        newCenter: { x: cx, y: cy },
        newRadius: C1.r,
        gap: Math.abs(d - C1.r),
        label: 'Tangente à reta',
      });
    }
    return out;
  }

  if (C1.t === 'l' && C2.t === 'c' && first.t === 'ln' && first.a !== undefined && first.b !== undefined) {
    const pa = getObj(objs, first.a);
    const pb = getObj(objs, first.b);
    if (!pa || !pb || pa.t !== 'pt' || pb.t !== 'pt' || !pa.ok || !pb.ok) return out;

    // Rigid translation of a line while dragging the line itself
    if (options?.forDrag && !options?.anchorEnd && pa.free && pb.free) {
      const proj = projectOnCurve(C1, C2.x, C2.y);
      const vx = proj.x - C2.x;
      const vy = proj.y - C2.y;
      const d = Math.hypot(vx, vy);
      const lLen = Math.hypot(C1.dx, C1.dy) || 1;
      const nx = d > 1e-6 ? vx / d : -C1.dy / lLen;
      const ny = d > 1e-6 ? vy / d : C1.dx / lLen;
      const contact = { x: C2.x + C2.r * nx, y: C2.y + C2.r * ny };
      const dxShift = contact.x - proj.x;
      const dyShift = contact.y - proj.y;
      out.push({
        key: `${firstId}-${secondId}-ln-rigid`,
        firstId,
        secondId,
        contact,
        previewCurve: { t: 'l', x: C1.x + dxShift, y: C1.y + dyShift, dx: C1.dx, dy: C1.dy },
        guideline: { x1: C2.x, y1: C2.y, x2: contact.x, y2: contact.y },
        kind: 'ln-ci',
        newCenter: { x: dxShift, y: dyShift },
        gap: Math.abs(d - C2.r),
        label: 'Reta tangente',
      });
      return out;
    }

    const anchorEnd: 'a' | 'b' = options?.anchorEnd ?? (pb.free ? 'a' : 'b');
    const anchorPt = anchorEnd === 'a' ? pa : pb;
    const movingPt = anchorEnd === 'a' ? pb : pa;
    for (const s of [1, -1]) {
      const TL = tanLine(anchorPt, C2, s);
      if (!TL) continue;
      const proj = projectOnCurve(TL, C2.x, C2.y);
      const contact = { x: proj.x, y: proj.y };
      const forwardDot = (movingPt.x - anchorPt.x) * TL.dx + (movingPt.y - anchorPt.y) * TL.dy;
      const gap = forwardDot >= -1e-3 ? distToCurve(TL, movingPt.x, movingPt.y) : 1e9;
      out.push({
        key: `${firstId}-${secondId}-ln-${s}`,
        firstId,
        secondId,
        contact,
        previewCurve: TL,
        guideline: { x1: C2.x, y1: C2.y, x2: contact.x, y2: contact.y },
        kind: 'ln-ci',
        s,
        anchorEnd,
        gap,
        label: 'Reta tangente',
      });
    }
  }

  return out;
}

export function findDragTangencySnap(
  objs: GeomObj[],
  modifiedCurveId: number,
  options: {
    fixedCenter?: boolean;
    anchorEnd?: 'a' | 'b';
    cursorX: number;
    cursorY: number;
    viewK: number;
    snapPx?: number;
    proximityPx?: number;
    allowedIds?: Set<number>;
  }
): { candidates: TangencyCandidate[]; active: TangencyCandidate | null } {
  const cache = buildCurveCache(objs);
  const snapDist = (options.snapPx ?? DEFAULT_SNAP_PX) / options.viewK;
  const pointTouchDist = Math.max(13, (options.snapPx ?? DEFAULT_SNAP_PX) + 3) / options.viewK;
  const proxDist = (options.proximityPx ?? 64) / options.viewK;

  const candidates: TangencyCandidate[] = [];
  let active: TangencyCandidate | null = null;
  let bestActiveScore = 1e18;

  for (const target of objs) {
    if (
      target.dead ||
      target.id === modifiedCurveId ||
      target.t === 'pt' ||
      (options.allowedIds && !options.allowedIds.has(target.id))
    ) {
      continue;
    }
    const cands = computeTangencyCandidates(objs, modifiedCurveId, target.id, {
      fixedCenter: options.fixedCenter,
      anchorEnd: options.anchorEnd,
      forDrag: true,
      curveCache: cache,
    });
    for (const c of cands) {
      const ptrD = Math.hypot(options.cursorX - c.contact.x, options.cursorY - c.contact.y);
      if (c.gap <= proxDist || ptrD <= proxDist) {
        candidates.push(c);
      }
      if (ptrD <= pointTouchDist || c.gap <= snapDist) {
        const score = ptrD <= pointTouchDist ? ptrD * 0.5 : c.gap;
        if (score < bestActiveScore) {
          bestActiveScore = score;
          active = c;
        }
      }
    }
  }

  return { candidates, active };
}

export function applyDragTangencySnap(objs: GeomObj[], cand: TangencyCandidate): void {
  const first = getObj(objs, cand.firstId);
  if (!first || first.dead) return;

  if ((cand.kind === 'ci-ci' || cand.kind === 'ci-ln') && first.t === 'ci') {
    const C1 = curve(objs, first);
    if (!C1 || C1.t !== 'c') return;

    if (cand.fixedCenter && first.p !== undefined && cand.newRadius !== undefined) {
      const pp = getObj(objs, first.p);
      if (pp && pp.t === 'pt' && pp.free) {
        const ang = Math.hypot(pp.x - C1.x, pp.y - C1.y) > 1e-9 ? Math.atan2(pp.y - C1.y, pp.x - C1.x) : 0;
        pp.x = C1.x + cand.newRadius * Math.cos(ang);
        pp.y = C1.y + cand.newRadius * Math.sin(ang);
        recalc(objs);
      }
      return;
    }

    if (cand.newCenter) {
      const dx = cand.newCenter.x - C1.x;
      const dy = cand.newCenter.y - C1.y;
      if (first.c !== undefined) {
        const pc = getObj(objs, first.c);
        if (pc && pc.t === 'pt' && pc.free) {
          pc.x += dx;
          pc.y += dy;
        }
      }
      if (first.p !== undefined) {
        const pp = getObj(objs, first.p);
        if (pp && pp.t === 'pt' && pp.free && !isPointUsedElsewhere(objs, pp.id, first.id)) {
          pp.x += dx;
          pp.y += dy;
        }
      }
      if (first.d1 !== undefined) {
        const pd1 = getObj(objs, first.d1);
        if (pd1 && pd1.t === 'pt' && pd1.free) {
          pd1.x += dx;
          pd1.y += dy;
        }
      }
      if (first.d2 !== undefined) {
        const pd2 = getObj(objs, first.d2);
        if (pd2 && pd2.t === 'pt' && pd2.free) {
          pd2.x += dx;
          pd2.y += dy;
        }
      }
      recalc(objs);
    }
    return;
  }

  if (cand.kind === 'ln-ci' && first.t === 'ln') {
    if (cand.anchorEnd && first.a !== undefined && first.b !== undefined) {
      const movingId = cand.anchorEnd === 'a' ? first.b : first.a;
      const pm = getObj(objs, movingId);
      if (pm && pm.t === 'pt' && pm.free) {
        pm.x = cand.contact.x;
        pm.y = cand.contact.y;
        recalc(objs);
      }
    } else if (cand.newCenter && first.a !== undefined && first.b !== undefined) {
      const pa = getObj(objs, first.a);
      const pb = getObj(objs, first.b);
      if (pa && pa.t === 'pt' && pa.free) {
        pa.x += cand.newCenter.x;
        pa.y += cand.newCenter.y;
      }
      if (pb && pb.t === 'pt' && pb.free) {
        pb.x += cand.newCenter.x;
        pb.y += cand.newCenter.y;
      }
      recalc(objs);
    }
  }
}

export function applyTangencyConnection(objs: GeomObj[], cand: TangencyCandidate): void {
  const first = getObj(objs, cand.firstId);
  const second = getObj(objs, cand.secondId);
  if (!first || !second || first.dead || second.dead) return;

  if ((cand.kind === 'ci-ci' || cand.kind === 'ci-ln') && first.t === 'ci') {
    // Upgrade circle that already has 1 tangent into a 2-tangent circle preserving its radius
    if (first.tan !== undefined && first.tanSet === undefined && cand.newCenter && cand.newRadius) {
      const sg1 = first.m === 1 || first.m === 2 ? -1 : 1;
      const sg2 = cand.m === 1 || cand.m === 2 ? -1 : 1;
      const oldC = first.c;
      const oldTan = first.tan;
      delete first.c;
      delete first.p;
      delete first.tan;
      delete first.m;
      delete first.d1;
      delete first.d2;
      delete first.e;
      delete first.ang;
      delete first.sg;
      delete first.tan2;
      delete first.sg2;
      delete first.kk;
      first.tanSet = [oldTan, cand.secondId];
      first.tanSigns = [sg1, sg2];
      first.tanRef = { x: cand.newCenter.x, y: cand.newCenter.y, r: cand.newRadius };
      first.tanFixedR = true;
      if (oldC !== undefined && !isPointUsedElsewhere(objs, oldC, first.id)) {
        const pc = getObj(objs, oldC);
        if (pc && pc.t === 'pt' && pc.free) pc.dead = true;
      }
      const hasTp = objs.some(
        (q) => !q.dead && q.t === 'pt' && q.tp && q.ci === first.id && q.tg === cand.secondId
      );
      if (!hasTp) {
        addObj(objs, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: first.id, tg: cand.secondId });
      }
      recalc(objs);
      return;
    }

    let centerPtId: number | undefined;
    if (first.c !== undefined) {
      const pc = getObj(objs, first.c);
      if (pc && pc.t === 'pt') {
        if (!cand.fixedCenter && pc.free && cand.newCenter) {
          pc.x = cand.newCenter.x;
          pc.y = cand.newCenter.y;
        }
        centerPtId = pc.id;
      }
    }
    if (centerPtId === undefined) {
      const cx = cand.newCenter?.x ?? 0;
      const cy = cand.newCenter?.y ?? 0;
      centerPtId = addObj(objs, { t: 'pt', free: true, x: cx, y: cy });
    }

    const oldRefs = [first.p, first.d1, first.d2, first.e];
    delete first.p;
    delete first.d1;
    delete first.d2;
    delete first.e;
    delete first.ang;
    delete first.sg;
    delete first.tan2;
    delete first.sg2;
    delete first.kk;
    delete first.tanSet;
    delete first.tanSigns;
    delete first.tanRef;
    delete first.tanFixedR;

    first.c = centerPtId;
    first.tan = cand.secondId;
    first.m = cand.m ?? 0;

    for (const rid of oldRefs) {
      if (rid !== undefined && rid !== centerPtId && !isPointUsedElsewhere(objs, rid, first.id)) {
        const rp = getObj(objs, rid);
        if (rp && rp.t === 'pt' && rp.free) rp.dead = true;
      }
    }

    const hasTp = objs.some(
      (q) => !q.dead && q.t === 'pt' && q.tp && q.ci === first.id && q.tg === cand.secondId
    );
    if (!hasTp) {
      addObj(objs, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: first.id, tg: cand.secondId });
    }
    recalc(objs);
    return;
  }

  if (cand.kind === 'ln-ci' && first.t === 'ln' && second.t === 'ci') {
    const C2 = curve(objs, second);
    if (!C2 || C2.t !== 'c') return;

    if (cand.anchorEnd && first.a !== undefined && first.b !== undefined) {
      const anchorId = cand.anchorEnd === 'a' ? first.a : first.b;
      const movingId = cand.anchorEnd === 'a' ? first.b : first.a;
      delete first.b;
      delete first.cc;
      delete first.tt;
      first.a = anchorId;
      first.to = cand.secondId;
      first.s = cand.s ?? 1;

      if (!isPointUsedElsewhere(objs, movingId, first.id)) {
        const mp = getObj(objs, movingId);
        if (mp && mp.t === 'pt' && mp.free) mp.dead = true;
      }
      const hasTp = objs.some(
        (q) => !q.dead && q.t === 'pt' && q.tp && q.ci === cand.secondId && q.tg === first.id
      );
      if (!hasTp) {
        addObj(objs, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: cand.secondId, tg: first.id });
      }
      recalc(objs);
      return;
    }

    // Rigid line drag into tangency: shift anchor points, pick matching s
    if (first.a !== undefined && first.b !== undefined) {
      const pa = getObj(objs, first.a);
      const pb = getObj(objs, first.b);
      if (pa && pa.t === 'pt' && pa.ok) {
        if (cand.newCenter && pa.free) {
          pa.x += cand.newCenter.x;
          pa.y += cand.newCenter.y;
        }
        if (cand.newCenter && pb && pb.t === 'pt' && pb.free) {
          pb.x += cand.newCenter.x;
          pb.y += cand.newCenter.y;
        }
        let bestS = 1;
        let bestErr = 1e18;
        for (const s of [1, -1]) {
          const tl = tanLine(pa, C2, s);
          if (!tl) continue;
          const proj = projectOnCurve(tl, C2.x, C2.y);
          const err = Math.hypot(proj.x - cand.contact.x, proj.y - cand.contact.y);
          if (err < bestErr) {
            bestErr = err;
            bestS = s;
          }
        }
        const movingId = first.b;
        delete first.b;
        delete first.cc;
        delete first.tt;
        first.a = pa.id;
        first.to = cand.secondId;
        first.s = bestS;
        if (movingId !== undefined && !isPointUsedElsewhere(objs, movingId, first.id)) {
          const mp = getObj(objs, movingId);
          if (mp && mp.t === 'pt' && mp.free) mp.dead = true;
        }
        const hasTp = objs.some(
          (q) => !q.dead && q.t === 'pt' && q.tp && q.ci === cand.secondId && q.tg === first.id
        );
        if (!hasTp) {
          addObj(objs, { t: 'pt', free: false, x: 0, y: 0, tp: true, ci: cand.secondId, tg: first.id });
        }
        recalc(objs);
      }
    }
  }
}

export interface CircleEditInfo {
  canResize: boolean;
  /** Temporary rim resize grip when circle has no free blue edge point (or for direct radius drag) */
  resizeHandle?: {
    x: number;
    y: number;
    ux: number;
    uy: number;
    isTanOffset: boolean;
    hasFreeEdgePt: boolean;
  };
  canSlideTan2: boolean;
  parentIds: number[];
  constraintCount: number;
  isLocked: boolean;
}

export function getTangentConstraintInfo(
  objs: GeomObj[],
  id: number
): { parentIds: number[]; constraintCount: number; isLocked: boolean } {
  const o = getObj(objs, id);
  if (!o || o.dead) return { parentIds: [], constraintCount: 0, isLocked: false };

  if (o.t === 'ci') {
    if (o.tanSet && o.tanSet.length >= 2) {
      const parentIds = o.tanSet.filter((pid) => {
        const po = getObj(objs, pid);
        return !!po && !po.dead;
      });
      return {
        parentIds,
        constraintCount: o.tanSet.length,
        isLocked: o.tanSet.length >= 3,
      };
    }
    const parentIds: number[] = [];
    if (o.tan !== undefined) parentIds.push(o.tan);
    if (o.tan2 !== undefined) parentIds.push(o.tan2);
    if (o.e !== undefined && o.tan !== undefined) parentIds.push(o.e);
    const valid = parentIds.filter((pid) => {
      const po = getObj(objs, pid);
      return !!po && !po.dead;
    });
    const constraintCount = (o.tan !== undefined ? 1 : 0) + (o.tan2 !== undefined ? 1 : 0);
    const pe = o.e !== undefined ? getObj(objs, o.e) : undefined;
    const isLocked = o.tan !== undefined && o.tan2 !== undefined && !!pe && pe.t === 'pt' && !pe.free;
    return { parentIds: valid, constraintCount, isLocked };
  }

  if (o.t === 'ln') {
    if (o.cc) {
      const parentIds = o.cc.filter((pid) => {
        const po = getObj(objs, pid);
        return !!po && !po.dead;
      });
      return { parentIds, constraintCount: 2, isLocked: true };
    }
    if (o.to !== undefined) {
      const parentIds = [o.to].filter((pid) => {
        const po = getObj(objs, pid);
        return !!po && !po.dead;
      });
      return { parentIds, constraintCount: 1, isLocked: false };
    }
  }

  return { parentIds: [], constraintCount: 0, isLocked: false };
}

export function getCircleEditInfo(
  objs: GeomObj[],
  circleId: number,
  curveCache?: Array<Curve | null>
): CircleEditInfo {
  const o = getObj(objs, circleId);
  if (!o || o.dead || o.t !== 'ci') {
    return { canResize: false, canSlideTan2: false, parentIds: [], constraintCount: 0, isLocked: false };
  }
  const C = curve(objs, o, curveCache);
  if (!C || C.t !== 'c') {
    return { canResize: false, canSlideTan2: false, parentIds: [], constraintCount: 0, isLocked: false };
  }

  const cInfo = getTangentConstraintInfo(objs, circleId);
  const canSlideTan2 = !!(o.tanSet && o.tanSet.length === 2);

  let canResize = false;
  let isTanOffset = false;
  let hasFreeEdgePt = false;

  if (o.c !== undefined && o.p !== undefined) {
    const pc = getObj(objs, o.c);
    const pp = getObj(objs, o.p);
    hasFreeEdgePt = !!(pp && pp.t === 'pt' && pp.free);
    canResize = hasFreeEdgePt || !!(pc && pc.t === 'pt' && pc.free);
  } else if (o.d1 !== undefined && o.d2 !== undefined) {
    const p1 = getObj(objs, o.d1);
    const p2 = getObj(objs, o.d2);
    canResize = !!((p1 && p1.t === 'pt' && p1.free) || (p2 && p2.t === 'pt' && p2.free));
  } else if (o.c !== undefined && o.tan !== undefined) {
    const pc = getObj(objs, o.c);
    canResize = !!(pc && pc.t === 'pt' && (pc.free || pc.on !== undefined));
    isTanOffset = true;
  } else if (o.e !== undefined && o.tan !== undefined && o.tan2 === undefined) {
    const pe = getObj(objs, o.e);
    canResize = !!(pe && pe.t === 'pt' && pe.ok);
  } else if (o.tanSet && o.tanSet.length === 2) {
    canResize = true;
  }

  if (!canResize) {
    return {
      canResize: false,
      canSlideTan2,
      parentIds: cInfo.parentIds,
      constraintCount: cInfo.constraintCount,
      isLocked: cInfo.isLocked,
    };
  }

  // Pick a clean rim handle angle opposite any tangency contact points so it never collides with tp dots
  const contacts: Array<{ x: number; y: number }> = [];
  for (const q of objs) {
    if (!q.dead && q.t === 'pt' && q.ok && q.tp && (q.ci === o.id || q.tg === o.id)) {
      contacts.push({ x: q.x, y: q.y });
    }
  }

  let bestAng = 0;
  if (isTanOffset && contacts.length === 1) {
    bestAng = Math.atan2(C.y - contacts[0].y, C.x - contacts[0].x);
  } else if (contacts.length > 0) {
    let bestMinD = -1;
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      const hx = C.x + C.r * Math.cos(ang);
      const hy = C.y + C.r * Math.sin(ang);
      let minD = 1e18;
      for (const ct of contacts) {
        const d = Math.hypot(hx - ct.x, hy - ct.y);
        if (d < minD) minD = d;
      }
      if (minD > bestMinD) {
        bestMinD = minD;
        bestAng = ang;
      }
    }
  }

  const ux = Math.cos(bestAng);
  const uy = Math.sin(bestAng);

  return {
    canResize: true,
    resizeHandle: {
      x: C.x + C.r * ux,
      y: C.y + C.r * uy,
      ux,
      uy,
      isTanOffset,
      hasFreeEdgePt,
    },
    canSlideTan2,
    parentIds: cInfo.parentIds,
    constraintCount: cInfo.constraintCount,
    isLocked: cInfo.isLocked,
  };
}

export function releaseTangency(
  objs: GeomObj[],
  id: number,
  mode: 'one' | 'all' = 'one'
): { ok: boolean; next?: GeomObj[] } {
  const orig = getObj(objs, id);
  if (!orig || orig.dead) return { ok: false };

  const next = cloneObjs(objs);
  const o = getObj(next, id);
  if (!o || o.dead) return { ok: false };

  if (o.t === 'ci') {
    const C = curve(next, o);
    if (!C || C.t !== 'c') return { ok: false };

    if (o.tanSet && o.tanSet.length >= 2) {
      if (mode === 'one' && o.tanSet.length >= 3) {
        const removedId = o.tanSet.pop()!;
        if (o.tanSigns && o.tanSigns.length > o.tanSet.length) {
          o.tanSigns.pop();
        }
        o.tanFixedR = false;
        o.tanRef = { x: C.x, y: C.y, r: C.r };
        for (const q of next) {
          if (!q.dead && q.t === 'pt' && q.tp && q.ci === o.id && q.tg === removedId) {
            killObj(next, q.id);
          }
        }
        recalc(next);
        return { ok: true, next };
      }

      if (mode === 'one' && o.tanSet.length === 2) {
        const keptId = o.tanSet[0];
        const removedId = o.tanSet[1];
        const T = curve(next, getObj(next, keptId));
        let m = 0;
        if (T && T.t === 'c') {
          let bestErr = 1e18;
          for (const candM of [0, 1, 2]) {
            const rr = tanR(T, C.x, C.y, candM);
            if (rr !== null) {
              const err = Math.abs(rr - C.r);
              if (err < bestErr) {
                bestErr = err;
                m = candM;
              }
            }
          }
        }
        const cId = addObj(next, { t: 'pt', free: true, x: C.x, y: C.y });
        delete o.tanSet;
        delete o.tanSigns;
        delete o.tanRef;
        delete o.tanFixedR;
        o.c = cId;
        o.tan = keptId;
        o.m = m;
        for (const q of next) {
          if (!q.dead && q.t === 'pt' && q.tp && q.ci === o.id && q.tg === removedId) {
            killObj(next, q.id);
          }
        }
        recalc(next);
        return { ok: true, next };
      }

      // mode === 'all': convert to free circle
      const cId = addObj(next, { t: 'pt', free: true, x: C.x, y: C.y });
      const pId = addObj(next, { t: 'pt', free: true, x: C.x + C.r, y: C.y });
      delete o.tanSet;
      delete o.tanSigns;
      delete o.tanRef;
      delete o.tanFixedR;
      o.c = cId;
      o.p = pId;
      for (const q of next) {
        if (!q.dead && q.t === 'pt' && q.tp && q.ci === o.id) {
          killObj(next, q.id);
        }
      }
      recalc(next);
      return { ok: true, next };
    }

    if (o.tan !== undefined) {
      if (mode === 'one' && o.tan2 !== undefined && o.e !== undefined) {
        const pe = getObj(next, o.e);
        const removedId = o.tan2;
        delete o.tan2;
        delete o.sg2;
        delete o.kk;
        if (pe && pe.t === 'pt' && pe.ok) {
          o.ang = Math.atan2(C.y - pe.y, C.x - pe.x);
        }
        for (const q of next) {
          if (!q.dead && q.t === 'pt' && q.tp && q.ci === o.id && q.tg === removedId) {
            killObj(next, q.id);
          }
        }
        recalc(next);
        return { ok: true, next };
      }

      let cId = o.c;
      const existingC = cId !== undefined ? getObj(next, cId) : undefined;
      if (!existingC || existingC.t !== 'pt' || !existingC.free) {
        cId = addObj(next, { t: 'pt', free: true, x: C.x, y: C.y });
      }
      const pId = addObj(next, { t: 'pt', free: true, x: C.x + C.r, y: C.y });
      delete o.tan;
      delete o.m;
      delete o.e;
      delete o.ang;
      delete o.sg;
      delete o.tan2;
      delete o.sg2;
      delete o.kk;
      o.c = cId;
      o.p = pId;
      for (const q of next) {
        if (!q.dead && q.t === 'pt' && q.tp && q.ci === o.id) {
          killObj(next, q.id);
        }
      }
      recalc(next);
      return { ok: true, next };
    }

    return { ok: false };
  }

  if (o.t === 'ln') {
    const L = curve(next, o);
    if (!L || L.t !== 'l') return { ok: false };

    if (o.to !== undefined && o.a !== undefined) {
      const pa = getObj(next, o.a);
      const aId =
        pa && pa.t === 'pt' && pa.ok
          ? pa.id
          : addObj(next, { t: 'pt', free: true, x: L.x, y: L.y });
      const tpPt = next.find(
        (q): q is PointObj => !q.dead && q.t === 'pt' && !!q.tp && q.ok === true && q.tg === o.id
      );
      const bId = tpPt
        ? addObj(next, { t: 'pt', free: true, x: tpPt.x, y: tpPt.y })
        : addObj(next, { t: 'pt', free: true, x: L.x + L.dx, y: L.y + L.dy });
      delete o.to;
      delete o.s;
      o.a = aId;
      o.b = bId;
      for (const q of next) {
        if (!q.dead && q.t === 'pt' && q.tp && q.tg === o.id) {
          killObj(next, q.id);
        }
      }
      recalc(next);
      return { ok: true, next };
    }

    if (o.cc) {
      const tpPts = next.filter(
        (q): q is PointObj => !q.dead && q.t === 'pt' && !!q.tp && q.ok === true && q.tg === o.id
      );
      const n = Math.hypot(L.dx, L.dy) || 1;
      const ux = L.dx / n;
      const uy = L.dy / n;
      const pA = tpPts[0] ?? { x: L.x, y: L.y };
      const pB = tpPts[1] ?? { x: pA.x + 120 * ux, y: pA.y + 120 * uy };
      const aId = addObj(next, { t: 'pt', free: true, x: pA.x, y: pA.y });
      const bId = addObj(next, { t: 'pt', free: true, x: pB.x, y: pB.y });
      delete o.cc;
      delete o.s;
      delete o.tt;
      o.a = aId;
      o.b = bId;
      for (const q of next) {
        if (!q.dead && q.t === 'pt' && q.tp && q.tg === o.id) {
          killObj(next, q.id);
        }
      }
      recalc(next);
      return { ok: true, next };
    }
  }

  return { ok: false };
}



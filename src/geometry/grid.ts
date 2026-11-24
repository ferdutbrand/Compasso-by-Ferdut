export type GridKind = 'none' | 'modular' | 'isometric' | 'fibonacci' | 'phi' | 'polar';
export type SizeRule = 'free' | 'fibonacci' | 'golden' | 'modular';

export interface GridConfig {
  enabled: boolean;
  kind: GridKind;
  unit: number;
  subdivisions: number;
  snap: boolean;
  sizeRule: SizeRule;
  lockScale: boolean;
  originX: number;
  originY: number;
  fibSteps: number;
  fibShowCircles: boolean;
  fibShowSpiral: boolean;
  fibShowLabels: boolean;
  fibRotation: 0 | 1 | 2 | 3;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  enabled: false,
  kind: 'fibonacci',
  unit: 20,
  subdivisions: 2,
  snap: true,
  sizeRule: 'free',
  lockScale: false,
  originX: 460,
  originY: 320,
  fibSteps: 9,
  fibShowCircles: true,
  fibShowSpiral: true,
  fibShowLabels: true,
  fibRotation: 0,
};

export const PHI = (1 + Math.sqrt(5)) / 2;
export const FIB_SEQ = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233] as const;

export interface FibTile {
  index: number;
  fibVal: number;
  x: number;
  y: number;
  size: number;
  cx: number;
  cy: number;
  label: string;
  arcD: string;
}

function rot90(x: number, y: number, q: 0 | 1 | 2 | 3): [number, number] {
  if (q === 0) return [x, y];
  if (q === 1) return [-y, x];
  if (q === 2) return [-x, -y];
  return [y, -x];
}

export function computeFibonacciTiles(cfg: GridConfig): FibTile[] {
  const u = Math.max(4, cfg.unit);
  const steps = Math.max(3, Math.min(FIB_SEQ.length, cfg.fibSteps));
  const raw: Array<{
    x: number;
    y: number;
    s: number;
    fibVal: number;
    sx: number;
    sy: number;
    ex: number;
    ey: number;
  }> = [];

  let minX = 0;
  let minY = 0;
  let maxX = u;
  let maxY = u;

  for (let i = 0; i < steps; i++) {
    const fibVal = FIB_SEQ[i];
    const s = fibVal * u;
    let rx = 0;
    let ry = 0;
    let sx = 0;
    let sy = 0;
    let ex = 0;
    let ey = 0;

    if (i === 0) {
      rx = 0;
      ry = 0;
      minX = 0;
      minY = 0;
      maxX = s;
      maxY = s;
      sx = rx;
      sy = ry + s;
      ex = rx + s;
      ey = ry;
    } else {
      const dir = i % 4;
      if (dir === 1) {
        // Right
        rx = maxX;
        ry = minY;
        maxX += s;
        sx = rx;
        sy = ry;
        ex = rx + s;
        ey = ry + s;
      } else if (dir === 2) {
        // Bottom
        rx = minX;
        ry = maxY;
        maxY += s;
        sx = rx + s;
        sy = ry;
        ex = rx;
        ey = ry + s;
      } else if (dir === 3) {
        // Left
        rx = minX - s;
        ry = minY;
        minX -= s;
        sx = rx + s;
        sy = ry + s;
        ex = rx;
        ey = ry;
      } else {
        // Top (dir === 0, i >= 4)
        rx = minX;
        ry = minY - s;
        minY -= s;
        sx = rx;
        sy = ry + s;
        ex = rx + s;
        ey = ry;
      }
    }
    raw.push({ x: rx, y: ry, s, fibVal, sx, sy, ex, ey });
  }

  // Center the spiral rectangle nicely around origin
  const rawCx = (minX + maxX) * 0.5;
  const rawCy = (minY + maxY) * 0.5;

  return raw.map((t, index) => {
    const [p0x, p0y] = rot90(t.x - rawCx, t.y - rawCy, cfg.fibRotation);
    const [p1x, p1y] = rot90(t.x + t.s - rawCx, t.y + t.s - rawCy, cfg.fibRotation);
    const x = Math.min(p0x, p1x) + cfg.originX;
    const y = Math.min(p0y, p1y) + cfg.originY;
    const [rsx, rsy] = rot90(t.sx - rawCx, t.sy - rawCy, cfg.fibRotation);
    const [rex, rey] = rot90(t.ex - rawCx, t.ey - rawCy, cfg.fibRotation);
    const sx = rsx + cfg.originX;
    const sy = rsy + cfg.originY;
    const ex = rex + cfg.originX;
    const ey = rey + cfg.originY;
    const r = Math.round(t.s * 1000) / 1000;
    return {
      index,
      fibVal: t.fibVal,
      x,
      y,
      size: t.s,
      cx: x + t.s * 0.5,
      cy: y + t.s * 0.5,
      label: `${t.fibVal}u`,
      arcD: `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
    };
  });
}

export function getSizeRuleOptions(
  rule: SizeRule,
  unit: number,
  subdivisions: number = 1
): Array<{ value: number; tag: string }> {
  const u = Math.max(4, unit);
  if (rule === 'fibonacci') {
    // Deduplicate leading [1, 1] for presets while keeping exact Fibonacci values
    const uniqueFibs = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
    return uniqueFibs.map((f) => ({
      value: Math.round(f * u * 100) / 100,
      tag: `Fib ${f}`,
    }));
  }
  if (rule === 'golden') {
    const exps = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
    return exps.map((k) => ({
      value: Math.round(u * Math.pow(PHI, k) * 100) / 100,
      tag: k === 0 ? 'φ⁰' : `φ${k > 0 ? `^${k}` : `^${k}`}`,
    }));
  }
  if (rule === 'modular') {
    const step = subdivisions >= 2 ? u / 2 : u;
    const out: Array<{ value: number; tag: string }> = [];
    for (let k = 1; k <= 16; k++) {
      const mult = subdivisions >= 2 ? k * 0.5 : k;
      out.push({
        value: Math.round(k * step * 100) / 100,
        tag: `${mult}M`,
      });
    }
    return out;
  }
  return [];
}

export function snapSizeByRule(
  rawSize: number,
  cfg: GridConfig
): { snapped: number; tag: string | null } {
  if (cfg.sizeRule === 'free' || !Number.isFinite(rawSize) || rawSize <= 0) {
    return { snapped: rawSize, tag: null };
  }
  const u = Math.max(4, cfg.unit);
  if (cfg.sizeRule === 'modular') {
    const step = cfg.subdivisions >= 2 ? u / 2 : u;
    const k = Math.max(1, Math.round(rawSize / step));
    const snapped = Math.round(k * step * 1000) / 1000;
    const mult = cfg.subdivisions >= 2 ? k * 0.5 : k;
    return { snapped, tag: `Mod ${mult}M` };
  }
  const opts = getSizeRuleOptions(cfg.sizeRule, u, cfg.subdivisions);
  if (opts.length === 0) return { snapped: rawSize, tag: null };
  let best = opts[0];
  let bestD = Math.abs(rawSize - best.value);
  for (let i = 1; i < opts.length; i++) {
    const d = Math.abs(rawSize - opts[i].value);
    if (d < bestD) {
      bestD = d;
      best = opts[i];
    }
  }
  return { snapped: best.value, tag: best.tag };
}

function projectToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number; d: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 1e-12 ? Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return { x, y, d: Math.hypot(px - x, py - y) };
}

export function snapToGrid(
  x: number,
  y: number,
  viewK: number,
  snapPx: number,
  cfg: GridConfig
): { x: number; y: number; tag: 'Grid' | 'Grid Fibonacci' } | null {
  if (!cfg.enabled || !cfg.snap || cfg.kind === 'none') return null;
  const Rv = Math.max(12, snapPx) / viewK;
  const Rl = Math.max(8, snapPx) / viewK;
  const u = Math.max(4, cfg.unit);

  if (cfg.kind === 'modular') {
    const step = u / Math.max(1, cfg.subdivisions);
    const gx = Math.round((x - cfg.originX) / step) * step + cfg.originX;
    const gy = Math.round((y - cfg.originY) / step) * step + cfg.originY;
    const dx = Math.abs(gx - x);
    const dy = Math.abs(gy - y);
    if (Math.hypot(dx, dy) <= Rv) {
      return { x: gx, y: gy, tag: 'Grid' };
    }
    if (dx <= Rl && (dy > Rl || dx <= dy)) {
      return { x: gx, y, tag: 'Grid' };
    }
    if (dy <= Rl) {
      return { x, y: gy, tag: 'Grid' };
    }
    return null;
  }

  if (cfg.kind === 'isometric') {
    const dx = u;
    const dy = (u * Math.sqrt(3)) / 2;
    const baseRow = Math.round((y - cfg.originY) / dy);
    let bestPt: { x: number; y: number; d: number } | null = null;
    for (let r = baseRow - 1; r <= baseRow + 1; r++) {
      const rowShift = ((r % 2) + 2) % 2 === 1 ? dx * 0.5 : 0;
      const baseCol = Math.round((x - cfg.originX - rowShift) / dx);
      for (let c = baseCol - 1; c <= baseCol + 1; c++) {
        const gx = cfg.originX + rowShift + c * dx;
        const gy = cfg.originY + r * dy;
        const d = Math.hypot(gx - x, gy - y);
        if (d <= Rv && (!bestPt || d < bestPt.d)) {
          bestPt = { x: gx, y: gy, d };
        }
      }
    }
    if (bestPt) {
      return { x: bestPt.x, y: bestPt.y, tag: 'Grid' };
    }

    // Snap onto horizontal and ±60° lattice lines
    let bestLine: { x: number; y: number; d: number } | null = null;
    const hY = cfg.originY + baseRow * dy;
    const hDist = Math.abs(hY - y);
    if (hDist <= Rl) {
      bestLine = { x, y: hY, d: hDist };
    }
    const relX = x - cfg.originX;
    const relY = y - cfg.originY;
    const invSqrt3 = 1 / Math.sqrt(3);
    // +60° family (matches WorkGridLayer: x - y/sqrt(3) = originX + k*u)
    const kPos = Math.round((relX - relY * invSqrt3) / u);
    const nx1 = Math.sqrt(3) / 2;
    const ny1 = -0.5;
    const off1 = nx1 * (relX - kPos * u) + ny1 * relY;
    if (Math.abs(off1) <= Rl && (!bestLine || Math.abs(off1) < bestLine.d)) {
      bestLine = { x: x - off1 * nx1, y: y - off1 * ny1, d: Math.abs(off1) };
    }
    // -60° family (matches WorkGridLayer: x + y/sqrt(3) = originX + k*u)
    const kNeg = Math.round((relX + relY * invSqrt3) / u);
    const ny2 = 0.5;
    const off2 = nx1 * (relX - kNeg * u) + ny2 * relY;
    if (Math.abs(off2) <= Rl && (!bestLine || Math.abs(off2) < bestLine.d)) {
      bestLine = { x: x - off2 * nx1, y: y - off2 * ny2, d: Math.abs(off2) };
    }
    return bestLine ? { x: bestLine.x, y: bestLine.y, tag: 'Grid' } : null;
  }

  if (cfg.kind === 'fibonacci') {
    const tiles = computeFibonacciTiles(cfg);
    let bestV: { x: number; y: number; d: number } | null = null;
    const tryV = (px: number, py: number) => {
      const d = Math.hypot(px - x, py - y);
      if (d <= Rv && (!bestV || d < bestV.d)) {
        bestV = { x: px, y: py, d };
      }
    };
    for (const t of tiles) {
      tryV(t.x, t.y);
      tryV(t.x + t.size, t.y);
      tryV(t.x + t.size, t.y + t.size);
      tryV(t.x, t.y + t.size);
      tryV(t.cx, t.cy);
    }
    if (bestV) {
      return { x: (bestV as { x: number; y: number }).x, y: (bestV as { x: number; y: number }).y, tag: 'Grid Fibonacci' };
    }

    // Snap onto tile edges or inscribed circles
    let bestEdge: { x: number; y: number; d: number } | null = null;
    const trySeg = (x1: number, y1: number, x2: number, y2: number) => {
      const p = projectToSegment(x, y, x1, y1, x2, y2);
      if (p.d <= Rl && (!bestEdge || p.d < bestEdge.d)) {
        bestEdge = p;
      }
    };
    for (const t of tiles) {
      const x1 = t.x;
      const y1 = t.y;
      const x2 = t.x + t.size;
      const y2 = t.y + t.size;
      trySeg(x1, y1, x2, y1);
      trySeg(x2, y1, x2, y2);
      trySeg(x2, y2, x1, y2);
      trySeg(x1, y2, x1, y1);
      if (cfg.fibShowCircles) {
        const r = t.size * 0.5;
        const dc = Math.hypot(x - t.cx, y - t.cy);
        const rimErr = Math.abs(dc - r);
        if (rimErr <= Rl && dc > 1e-6 && (!bestEdge || rimErr < bestEdge.d)) {
          bestEdge = {
            x: t.cx + (r * (x - t.cx)) / dc,
            y: t.cy + (r * (y - t.cy)) / dc,
            d: rimErr,
          };
        }
      }
    }
    return bestEdge ? { x: (bestEdge as { x: number; y: number }).x, y: (bestEdge as { x: number; y: number }).y, tag: 'Grid Fibonacci' } : null;
  }

  if (cfg.kind === 'phi') {
    const radii = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((k) => u * Math.pow(PHI, k));
    const xs = [cfg.originX];
    const ys = [cfg.originY];
    for (const r of radii) {
      xs.push(cfg.originX + r, cfg.originX - r);
      ys.push(cfg.originY + r, cfg.originY - r);
    }
    let bestX = cfg.originX;
    let bestDx = 1e18;
    for (const gx of xs) {
      const d = Math.abs(gx - x);
      if (d < bestDx) {
        bestDx = d;
        bestX = gx;
      }
    }
    let bestY = cfg.originY;
    let bestDy = 1e18;
    for (const gy of ys) {
      const d = Math.abs(gy - y);
      if (d < bestDy) {
        bestDy = d;
        bestY = gy;
      }
    }
    if (Math.hypot(bestX - x, bestY - y) <= Rv) {
      return { x: bestX, y: bestY, tag: 'Grid Fibonacci' };
    }
    if (bestDx <= Rl && (bestDy > Rl || bestDx <= bestDy)) {
      return { x: bestX, y, tag: 'Grid Fibonacci' };
    }
    if (bestDy <= Rl) {
      return { x, y: bestY, tag: 'Grid Fibonacci' };
    }
    return null;
  }

  if (cfg.kind === 'polar') {
    const tag: 'Grid' | 'Grid Fibonacci' = cfg.sizeRule === 'fibonacci' ? 'Grid Fibonacci' : 'Grid';
    const dx = x - cfg.originX;
    const dy = y - cfg.originY;
    const dist = Math.hypot(dx, dy);
    if (dist <= Rv) {
      return { x: cfg.originX, y: cfg.originY, tag };
    }
    const radii =
      cfg.sizeRule === 'fibonacci'
        ? [1, 2, 3, 5, 8, 13, 21, 34, 55].map((f) => f * u)
        : Array.from({ length: 16 }, (_, idx) => (idx + 1) * u);
    const maxR = radii[radii.length - 1] ?? u * 16;
    let bestR = radii[0];
    let bestDr = 1e18;
    for (const r of radii) {
      const d = Math.abs(r - dist);
      if (d < bestDr) {
        bestDr = d;
        bestR = r;
      }
    }
    const sectors = Math.max(4, cfg.subdivisions * 4);
    const stepA = (Math.PI * 2) / sectors;
    const ang = Math.round(Math.atan2(dy, dx) / stepA) * stepA;
    const gx = cfg.originX + bestR * Math.cos(ang);
    const gy = cfg.originY + bestR * Math.sin(ang);
    if (Math.hypot(gx - x, gy - y) <= Rv) {
      return { x: gx, y: gy, tag };
    }
    // Snap onto concentric ring or radial ray
    const rayProj = projectToSegment(
      x,
      y,
      cfg.originX,
      cfg.originY,
      cfg.originX + maxR * Math.cos(ang),
      cfg.originY + maxR * Math.sin(ang)
    );
    if (bestDr <= Rl && (rayProj.d > Rl || bestDr <= rayProj.d)) {
      const theta = Math.atan2(dy, dx);
      return { x: cfg.originX + bestR * Math.cos(theta), y: cfg.originY + bestR * Math.sin(theta), tag };
    }
    if (rayProj.d <= Rl) {
      return { x: rayProj.x, y: rayProj.y, tag };
    }
    return null;
  }

  return null;
}

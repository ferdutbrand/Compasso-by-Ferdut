import {
  addObj,
  alignObjects,
  buildCopySubgraph,
  commonTan,
  curve,
  distributeObjects,
  getObj,
  getObjBounds,
  groupObjects,
  killObj,
  mirrorObjects,
  pasteSubgraph,
  recalc,
  setCircleRadius,
  setPolygonSide,
  solveMultiTangent,
  tanLine,
  tanSolve,
  ungroupObjects,
} from '../src/geometry/engine';
import { combineClosedCurvesAsShape } from '../src/geometry/shapeBuilder';
import {
  computeFibonacciTiles,
  DEFAULT_GRID_CONFIG,
  getSizeRuleOptions,
  PHI,
  snapSizeByRule,
  snapToGrid,
  type GridConfig,
} from '../src/geometry/grid';
import type { CircleCurve, CircleObj, GeomObj, PointObj, PolyObj } from '../src/geometry/types';

interface TestResult {
  name: string;
  suite: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

const results: TestResult[] = [];
let currentSuite = 'Geral';

function describe(name: string, fn: () => void): void {
  currentSuite = name;
  fn();
}

function test(name: string, fn: () => void): void {
  const t0 = performance.now();
  try {
    fn();
    results.push({
      name,
      suite: currentSuite,
      passed: true,
      durationMs: performance.now() - t0,
    });
  } catch (err) {
    results.push({
      name,
      suite: currentSuite,
      passed: false,
      durationMs: performance.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertClose(actual: number, expected: number, eps = 1e-4, label = 'valor'): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > eps) {
    throw new Error(`${label}: esperado ${expected}, obtido ${actual} (diff=${Math.abs(actual - expected)})`);
  }
}

function makeCircle(objs: GeomObj[], cx: number, cy: number, r: number, scaleLocked = false): number {
  const c = addObj(objs, { t: 'pt', free: true, x: cx, y: cy, ok: true });
  const p = addObj(objs, { t: 'pt', free: true, x: cx + r, y: cy, ok: true });
  return addObj(objs, { t: 'ci', c, p, ...(scaleLocked ? { scaleLocked: true } : {}) });
}

function makeSquare(objs: GeomObj[], cx: number, cy: number, side: number): number {
  const halfDiag = (side * Math.SQRT2) / 2;
  const ang = -Math.PI / 4;
  const c = addObj(objs, { t: 'pt', free: true, x: cx, y: cy, ok: true });
  const p = addObj(objs, {
    t: 'pt',
    free: true,
    x: cx + halfDiag * Math.cos(ang),
    y: cy + halfDiag * Math.sin(ang),
    ok: true,
  });
  return addObj(objs, { t: 'pg', c, p, sides: 4 });
}

describe('1. Cópia e Colagem (Copy/Paste)', () => {
  test('Copia e cola círculo mantendo raio exato e deslocamento independente', () => {
    const objs: GeomObj[] = [];
    const cid = makeCircle(objs, 100, 120, 45);
    const sub = buildCopySubgraph(objs, new Set([cid]));
    assert(sub !== null, 'Subgrafo copiado não deve ser nulo');

    const { next, pastedIds } = pasteSubgraph(objs, sub, 60, -20);
    const pastedCircle = pastedIds
      .map((id) => getObj(next, id))
      .find((o): o is CircleObj => !!o && o.t === 'ci');
    assert(pastedCircle !== undefined, 'Círculo colado deve existir');

    const origCurve = curve(next, getObj(next, cid)!) as CircleCurve;
    const copyCurve = curve(next, pastedCircle) as CircleCurve;
    assertClose(copyCurve.x, 160, 1e-4, 'cx colado');
    assertClose(copyCurve.y, 100, 1e-4, 'cy colado');
    assertClose(copyCurve.r, origCurve.r, 1e-4, 'raio colado');

    // Mover original não afeta cópia
    const origCenter = getObj(next, (getObj(next, cid) as CircleObj).c!) as PointObj;
    origCenter.x += 200;
    recalc(next);
    const copyAfter = curve(next, pastedCircle) as CircleCurve;
    assertClose(copyAfter.x, 160, 1e-4, 'cópia permanece independente');
  });

  test('Copia e cola grupo remapeando groupId sem colidir com original', () => {
    const objs: GeomObj[] = [];
    const c1 = makeCircle(objs, 50, 50, 20);
    const c2 = makeCircle(objs, 120, 50, 20);
    const grp = groupObjects(objs, new Set([c1, c2]), 'grp-orig');
    assert(grp.ok && grp.next, 'Agrupamento inicial deve funcionar');

    const sub = buildCopySubgraph(grp.next, new Set([c1, c2]));
    assert(sub !== null, 'Subgrafo de grupo deve ser gerado');
    const { next, pastedIds } = pasteSubgraph(grp.next, sub, 0, 100);
    const pastedCircles = pastedIds
      .map((id) => getObj(next, id))
      .filter((o): o is CircleObj => !!o && o.t === 'ci');
    assert(pastedCircles.length === 2, 'Dois círculos devem ser colados');
    assert(
      pastedCircles[0].groupId !== undefined &&
        pastedCircles[0].groupId === pastedCircles[1].groupId &&
        pastedCircles[0].groupId !== 'grp-orig',
      'groupId colado deve ser remapeado de forma única'
    );
  });
});

describe('2. Grid Fibonacci, Modular e Regras de Tamanho', () => {
  test('Gera blocos da espiral de Fibonacci proporcionais ao unit', () => {
    const cfg: GridConfig = { ...DEFAULT_GRID_CONFIG, enabled: true, kind: 'fibonacci', unit: 20, fibSteps: 7 };
    const tiles = computeFibonacciTiles(cfg);
    assert(tiles.length === 7, 'Deve gerar 7 blocos de Fibonacci');
    const expected = [20, 20, 40, 60, 100, 160, 260];
    tiles.forEach((t, i) => assertClose(t.size, expected[i], 1e-6, `tile[${i}].size`));
  });

  test('Snap funciona corretamente nos grids Modular, Isométrico, Fibonacci, Phi e Polar', () => {
    const modCfg: GridConfig = { ...DEFAULT_GRID_CONFIG, enabled: true, kind: 'modular', unit: 20, subdivisions: 2, originX: 0, originY: 0 };
    const modSnap = snapToGrid(31, 49, 1, 10, modCfg);
    assert(modSnap !== null && modSnap.tag === 'Grid', 'Snap modular deve responder');
    assertClose(modSnap.x, 30, 1e-4, 'modular x');
    assertClose(modSnap.y, 50, 1e-4, 'modular y');

    const isoCfg: GridConfig = { ...DEFAULT_GRID_CONFIG, enabled: true, kind: 'isometric', unit: 40, originX: 0, originY: 0 };
    const isoSnap = snapToGrid(41, 1, 1, 12, isoCfg);
    assert(isoSnap !== null, 'Snap isométrico deve responder');
    assertClose(isoSnap.x, 40, 1e-4, 'iso x');
    assertClose(isoSnap.y, 0, 1e-4, 'iso y');

    const fibCfg: GridConfig = { ...DEFAULT_GRID_CONFIG, enabled: true, kind: 'fibonacci', unit: 20, fibSteps: 6, originX: 200, originY: 200 };
    const tiles = computeFibonacciTiles(fibCfg);
    const fibSnap = snapToGrid(tiles[2].cx + 2, tiles[2].cy - 2, 1, 12, fibCfg);
    assert(fibSnap !== null && fibSnap.tag === 'Grid Fibonacci', 'Snap Fibonacci deve encaixar no centro do tile');
    assertClose(fibSnap.x, tiles[2].cx, 1e-4, 'fib cx');

    const phiCfg: GridConfig = { ...DEFAULT_GRID_CONFIG, enabled: true, kind: 'phi', unit: 20, originX: 100, originY: 100 };
    const phiSnap = snapToGrid(100 + 20 * PHI + 1, 100, 1, 10, phiCfg);
    assert(phiSnap !== null && phiSnap.tag === 'Grid Fibonacci', 'Snap Phi deve responder');
    assertClose(phiSnap.x, 100 + 20 * PHI, 1e-3, 'phi x');

    const polarCfg: GridConfig = { ...DEFAULT_GRID_CONFIG, enabled: true, kind: 'polar', unit: 25, subdivisions: 2, originX: 0, originY: 0 };
    const polarSnap = snapToGrid(51, 1, 1, 10, polarCfg);
    assert(polarSnap !== null, 'Snap polar deve responder');
    assertClose(polarSnap.x, 50, 1e-4, 'polar x');
  });

  test('Regras de tamanho Fibonacci, Áurea (Phi) e Modular ajustam raios e lados', () => {
    const fibRule: GridConfig = { ...DEFAULT_GRID_CONFIG, unit: 10, sizeRule: 'fibonacci' };
    const fibSnap = snapSizeByRule(49, fibRule);
    assertClose(fibSnap.snapped, 50, 1e-4, 'Fib 5 * 10 = 50');

    const goldenRule: GridConfig = { ...DEFAULT_GRID_CONFIG, unit: 20, sizeRule: 'golden' };
    const gSnap = snapSizeByRule(20 * PHI + 1, goldenRule);
    assertClose(gSnap.snapped, Math.round(20 * PHI * 100) / 100, 1e-2, 'Golden φ^1');

    const modRule: GridConfig = { ...DEFAULT_GRID_CONFIG, unit: 20, subdivisions: 2, sizeRule: 'modular' };
    const mSnap = snapSizeByRule(29, modRule);
    assertClose(mSnap.snapped, 30, 1e-4, 'Modular 1.5M');

    assert(getSizeRuleOptions('fibonacci', 10).length > 5, 'Opções Fibonacci geradas');
  });
});

describe('3. Sistema de Tangências (1 a 4 Objetos)', () => {
  test('Calcula reta tangente a círculo a partir de ponto externo', () => {
    const L1 = tanLine({ x: 0, y: 0 }, { t: 'c', x: 100, y: 0, r: 50 }, 1);
    const L2 = tanLine({ x: 0, y: 0 }, { t: 'c', x: 100, y: 0, r: 50 }, -1);
    assert(L1 !== null && L2 !== null, 'Duas retas tangentes devem existir');
    // Distância do centro (100, 0) até a reta tangente deve ser exatamente r=50
    const d1 = Math.abs((100 - L1.x) * L1.dy - (0 - L1.y) * L1.dx) / Math.hypot(L1.dx, L1.dy);
    assertClose(d1, 50, 1e-3, 'distância reta-centro');
  });

  test('Calcula tangente comum externa e interna entre dois círculos', () => {
    const A: CircleCurve = { t: 'c', x: 0, y: 0, r: 30 };
    const B: CircleCurve = { t: 'c', x: 120, y: 0, r: 20 };
    const ext = commonTan(A, B, 1, 1);
    const int = commonTan(A, B, 1, -1);
    assert(ext !== null && int !== null, 'Tangentes comuns externa e interna devem existir');
  });

  test('Resolve círculo tangente a 1 objeto passando por ponto de borda (tanSolve)', () => {
    const objs: GeomObj[] = [];
    const c1 = makeCircle(objs, 100, 100, 40);
    // Ponto inicial A=(180, 100), cursor próximo ao ponto oposto (140, 100) -> círculo de r=20 centrado em (160, 100), tangente a c1 em (140, 100)
    const s = tanSolve(objs, { x: 180, y: 100 }, 140, 100, new Set(), 1, new Set(), 10);
    assert(s !== null, 'Deve encontrar solução tangente a 1 círculo passando pelo ponto');
    assert(s.tan === c1, 'Alvo tangente deve ser c1');
    const distCenters = Math.hypot(s.cx - 100, s.cy - 100);
    const err = Math.min(Math.abs(distCenters - (40 + s.r)), Math.abs(distCenters - Math.abs(40 - s.r)));
    assertClose(err, 0, 1e-2, 'erro de tangência a 1 círculo');
  });

  test('Resolve círculo tangente a 2, 3 e 4 alvos (solveMultiTangent)', () => {
    const objs: GeomObj[] = [];
    const c1 = makeCircle(objs, 0, 0, 30);
    const c2 = makeCircle(objs, 100, 0, 30);
    const c3 = makeCircle(objs, 50, 90, 30);

    // 2 alvos (2 círculos + posição do cursor)
    const sol2 = solveMultiTangent(
      objs,
      [
        { id: c1, hx: 20, hy: 20 },
        { id: c2, hx: 80, hy: 20 },
      ],
      50,
      40
    );
    assert(sol2.length >= 1, 'Deve resolver tangência a 2 círculos');

    // 3 alvos (Apolônio CCC)
    const sol3 = solveMultiTangent(
      objs,
      [
        { id: c1, hx: 20, hy: 20 },
        { id: c2, hx: 80, hy: 20 },
        { id: c3, hx: 50, hy: 60 },
      ],
      50,
      35
    );
    assert(sol3.length >= 1, 'Deve resolver tangência a 3 círculos (Apolônio)');
    const best3 = sol3[0];
    for (const [cx, cy] of [
      [0, 0],
      [100, 0],
      [50, 90],
    ]) {
      const dc = Math.hypot(best3.cx - cx, best3.cy - cy);
      const tanErr = Math.min(Math.abs(dc - (30 + best3.r)), Math.abs(dc - Math.abs(30 - best3.r)));
      assertClose(tanErr, 0, 1e-2, 'erro de tangência em 3 círculos');
    }

    // 4 alvos (4 círculos simétricos)
    const objs4: GeomObj[] = [];
    const q1 = makeCircle(objs4, -50, -50, 20);
    const q2 = makeCircle(objs4, 50, -50, 20);
    const q3 = makeCircle(objs4, 50, 50, 20);
    const q4 = makeCircle(objs4, -50, 50, 20);
    const sol4 = solveMultiTangent(
      objs4,
      [
        { id: q1, hx: -35, hy: -35 },
        { id: q2, hx: 35, hy: -35 },
        { id: q3, hx: 35, hy: 35 },
        { id: q4, hx: -35, hy: 35 },
      ],
      0,
      50.71
    );
    assert(sol4.length >= 1, 'Deve resolver tangência a 4 círculos simétricos');
    const centered4 = sol4.find((s) => Math.hypot(s.cx, s.cy) < 1e-2);
    assert(centered4 !== undefined, 'Deve incluir solução centralizada tangente aos 4 círculos');
    assertClose(centered4.r, 50 * Math.SQRT2 - 20, 1e-2, 'raio tangente aos 4 círculos');
  });
});

describe('4. Exclusão Limpa de Objetos (killObj)', () => {
  test('Remove pontos órfãos ao excluir círculo ou quadrado, mantendo pontos compartilhados', () => {
    const objs: GeomObj[] = [];
    const c1 = makeCircle(objs, 100, 100, 30);
    const c1Obj = getObj(objs, c1) as CircleObj;
    const c1Center = c1Obj.c!;
    const c1Edge = c1Obj.p!;

    // Cria segundo círculo compartilhando o mesmo centro
    const sharedEdge = addObj(objs, { t: 'pt', free: true, x: 160, y: 100, ok: true });
    const c2 = addObj(objs, { t: 'ci', c: c1Center, p: sharedEdge });

    // Excluir c1 deve remover c1 e seu ponto exclusivo c1Edge, mas preservar c1Center (usado por c2)
    killObj(objs, c1);
    assert(getObj(objs, c1)?.dead === true, 'c1 deve ficar dead');
    assert(getObj(objs, c1Edge)?.dead === true, 'ponto exclusivo de c1 deve ser removido');
    assert(getObj(objs, c1Center)?.dead !== true, 'ponto compartilhado com c2 deve ser preservado');

    // Excluir c2 agora deve remover c2, sharedEdge e também c1Center (que virou órfão)
    killObj(objs, c2);
    assert(getObj(objs, c2)?.dead === true, 'c2 deve ficar dead');
    assert(getObj(objs, sharedEdge)?.dead === true, 'borda de c2 deve ficar dead');
    assert(getObj(objs, c1Center)?.dead === true, 'centro órfão deve ser removido da tela');
  });
});

describe('5. Menus Situacionais: Alinhar, Distribuir (Auto e px), Agrupar, Simetria e Escala', () => {
  test('Alinha múltiplos objetos pela esquerda, centro X e base', () => {
    const objs: GeomObj[] = [];
    const c1 = makeCircle(objs, 50, 50, 20); // minX=30, maxX=70, maxY=70
    const c2 = makeCircle(objs, 150, 100, 30); // minX=120, maxX=180, maxY=130

    const leftRes = alignObjects(objs, new Set([c1, c2]), 'left');
    assert(leftRes.ok && leftRes.next, 'Alinhamento à esquerda deve funcionar');
    const b1 = getObjBounds(leftRes.next, c1)!;
    const b2 = getObjBounds(leftRes.next, c2)!;
    assertClose(b1.minX, b2.minX, 1e-4, 'minX alinhado');

    const bottomRes = alignObjects(leftRes.next, new Set([c1, c2]), 'bottom');
    assert(bottomRes.ok && bottomRes.next, 'Alinhamento à base deve funcionar');
    const bb1 = getObjBounds(bottomRes.next, c1)!;
    const bb2 = getObjBounds(bottomRes.next, c2)!;
    assertClose(bb1.maxY, bb2.maxY, 1e-4, 'maxY alinhado');
  });

  test('Distribui 3 objetos automaticamente e 2+ objetos com espaçamento exato em pixels', () => {
    const objs: GeomObj[] = [];
    const c1 = makeCircle(objs, 20, 50, 20); // [0..40]
    const c2 = makeCircle(objs, 70, 50, 20); // [50..90]
    const c3 = makeCircle(objs, 220, 50, 20); // [200..240]

    // Automática: span = 240 - 0 = 240, sumW = 120 => gap = 60 => c2 deve ir para [100..140]
    const autoRes = distributeObjects(objs, new Set([c1, c2, c3]), 'horiz');
    assert(autoRes.ok && autoRes.next, 'Distribuição automática horizontal deve funcionar');
    const b2Auto = getObjBounds(autoRes.next, c2)!;
    assertClose(b2Auto.minX, 100, 1e-4, 'c2 minX auto');

    // Com pixel gap = 15px em 2 objetos (c1 e c2)
    const objs2: GeomObj[] = [];
    const s1 = makeSquare(objs2, 20, 50, 40); // [0..40]
    const s2 = makeSquare(objs2, 200, 50, 40); // [180..220]
    const pxRes = distributeObjects(objs2, new Set([s1, s2]), 'horiz', undefined, 15);
    assert(pxRes.ok && pxRes.next, 'Distribuição com gap em pixels para 2 objetos deve funcionar');
    const bs1 = getObjBounds(pxRes.next, s1)!;
    const bs2 = getObjBounds(pxRes.next, s2)!;
    assertClose(bs2.minX - bs1.maxX, 15, 1e-3, 'gap horizontal de 15px entre s1 e s2');
  });

  test('Agrupar/Desagrupar e Simetria H/V preservam integridade geométrica', () => {
    const objs: GeomObj[] = [];
    const c1 = makeCircle(objs, 40, 40, 15);
    const c2 = makeCircle(objs, 100, 80, 25);

    const g = groupObjects(objs, new Set([c1, c2]), 'grp-test');
    assert(g.ok && g.next, 'Agrupamento deve suceder');
    assert(getObj(g.next, c1)?.groupId === 'grp-test', 'c1 no grupo');
    assert(getObj(g.next, c2)?.groupId === 'grp-test', 'c2 no grupo');

    const mir = mirrorObjects(g.next, new Set([c1]), 'h');
    assert(mir.ok && mir.next && mir.createdIds, 'Espelhamento horizontal deve criar cópia');

    const ug = ungroupObjects(mir.next, new Set([c1]));
    assert(ug.ok && ug.next, 'Desagrupamento deve funcionar');
    assert(getObj(ug.next, c1)?.groupId === undefined, 'c1 desagrupado');
    assert(getObj(ug.next, c2)?.groupId === undefined, 'c2 do mesmo grupo também desagrupado');
  });

  test('Bloqueio de escala (scaleLocked) impede alteração de raio e lado', () => {
    const objs: GeomObj[] = [];
    const cLocked = makeCircle(objs, 100, 100, 35, true);
    const resC = setCircleRadius(objs, cLocked, 80);
    assert(resC.ok === false, 'Círculo com scaleLocked não pode ter raio alterado');

    const pLocked = makeSquare(objs, 200, 200, 50);
    (getObj(objs, pLocked) as PolyObj).scaleLocked = true;
    const resP = setPolygonSide(objs, pLocked, 120);
    assert(resP.ok === false, 'Polígono com scaleLocked não pode ter lado alterado');
  });
});

describe('6. Construtor de Formas & Operações Booleanas', () => {
  test('Combina círculo e quadrado em união vetorial SVG válida', () => {
    const c: CircleCurve = { t: 'c', x: 100, y: 100, r: 40 };
    const objs: GeomObj[] = [];
    const sqId = makeSquare(objs, 130, 100, 60);
    const sqCurve = curve(objs, getObj(objs, sqId)!)!;
    assert(sqCurve.t === 'p', 'Curva deve ser polígono');
    const shape = combineClosedCurvesAsShape([c, sqCurve], 'union', 'phase-1', 'sh-test', 'phase');
    assert(shape !== null && shape.d.length > 10 && shape.d.includes('M '), 'Deve gerar path SVG válido da união');
  });
});

// Execução e resumo estruturado
const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed);

console.log(`\n=== Relatório de Testes Compasso (${passed}/${total} aprovados) ===`);
for (const r of results) {
  const icon = r.passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] [${r.suite}] ${r.name} (${r.durationMs.toFixed(2)} ms)`);
  if (!r.passed && r.error) {
    console.error(`       Erro: ${r.error}`);
  }
}

if (failed.length > 0) {
  process.exit(1);
}

// Engines A and A′: rasterize, then trace with imagetracerjs.
//
// Engine A is a port of fontify's outline pipeline, kept as-is: the same PEN,
// the same 480 px raster, the same imagetracerjs options and the same orient()
// winding fix. Only the coordinate mapping changes, from fontify's 160-unit
// cell to our font-unit cell (and sidebearings move to the font builder).
//
// Ported from fontify by Alexander Kroeker, src/fontBuilder.ts (MIT):
// https://github.com/alexkroeker177/fontify
//
// Engine A′ swaps the fixed round pen for perfect-freehand polygons (pressure /
// simulated pressure) and feeds them to the same tracer, which isolates the pen
// effect from the tracing effect.

import ImageTracer from 'imagetracerjs'
import { getStroke } from 'perfect-freehand'
import type { CellBox } from '../model/metrics'
import type { Pen, Stroke } from '../model/project'
import { PT_STRIDE } from '../model/project'
import { strokeInput } from './pressure'
import { createRasterCanvas, type Ctx2D } from './raster'
import type { Contour, OutlineEngine } from './types'

// --- fontify constants (unchanged) ---
const FONTIFY_CELL = 160
const TRACE = 480
export const PEN = 9 // in fontify cell units: 27 px at the 480 px raster

type Seg = { type: 'L' | 'Q'; x1: number; y1: number; x2: number; y2: number; x3?: number; y3?: number }
type Traced = { segments: Seg[]; isholepath: boolean }

function rasterContext(): Ctx2D {
  const canvas = createRasterCanvas(TRACE, TRACE)
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Ctx2D
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, TRACE, TRACE)
  return ctx
}

/** Font units → raster pixels for our cell. */
function toRaster(cell: CellBox) {
  const s = TRACE / cell.width
  return {
    x: (x: number) => (x - cell.left) * s,
    y: (y: number) => (cell.top - y) * s,
  }
}

// fontify trace(): stroke the polylines with a round PEN, then trace.
function rasterStrokesA(strokes: Stroke[], cell: CellBox): Ctx2D {
  const ctx = rasterContext()
  const m = toRaster(cell)
  ctx.lineWidth = PEN * (TRACE / FONTIFY_CELL)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#000'
  for (const s of strokes) {
    const n = s.pts.length / PT_STRIDE
    if (!n) continue
    ctx.beginPath()
    ctx.moveTo(m.x(s.pts[0]), m.y(s.pts[1]))
    if (n === 1) ctx.lineTo(m.x(s.pts[0]) + 0.01, m.y(s.pts[1]))
    for (let i = 1; i < n; i++) ctx.lineTo(m.x(s.pts[i * PT_STRIDE]), m.y(s.pts[i * PT_STRIDE + 1]))
    ctx.stroke()
  }
  return ctx
}

// A′: fill perfect-freehand polygons instead of stroking a fixed pen.
function rasterStrokesA2(strokes: Stroke[], pen: Pen, cell: CellBox): Ctx2D {
  const ctx = rasterContext()
  const m = toRaster(cell)
  ctx.fillStyle = '#000'
  for (const s of strokes) {
    const poly = freehandPolygon(s, pen)
    if (poly.length < 3) continue
    ctx.beginPath()
    ctx.moveTo(m.x(poly[0][0]), m.y(poly[0][1]))
    for (let i = 1; i < poly.length; i++) ctx.lineTo(m.x(poly[i][0]), m.y(poly[i][1]))
    ctx.closePath()
    ctx.fill('nonzero')
  }
  return ctx
}

export function freehandPolygon(s: Stroke, pen: Pen): number[][] {
  const { points, simulate } = strokeInput(s, pen.pressure)
  if (!points.length) return []
  return getStroke(points, {
    size: pen.size,
    thinning: pen.thinning,
    smoothing: pen.smoothing,
    streamline: pen.streamline,
    simulatePressure: simulate,
    last: true,
    start: { taper: pen.taper ? pen.taper * pen.size * 4 : 0, cap: true },
    end: { taper: pen.taper ? pen.taper * pen.size * 4 : 0, cap: true },
  })
}

// --- fontify's tracer settings and layer pick (unchanged) ---
function traceImage(ctx: Ctx2D): Traced[] {
  const traced = ImageTracer.imagedataToTracedata(ctx.getImageData(0, 0, TRACE, TRACE), {
    pal: [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 255 },
    ],
    colorsampling: 0,
    numberofcolors: 2,
    mincolorratio: 0,
    ltres: 1,
    qtres: 1,
    pathomit: 8,
    rightangleenhance: false,
    blurradius: 0,
    roundcoords: 2,
  })
  const darkIndex = traced.palette.findIndex(
    (c: { r: number; g: number; b: number }) => c.r + c.g + c.b < 384,
  )
  const layer: Traced[] = traced.layers[darkIndex] ?? []
  return layer.filter(p => p.segments && p.segments.length > 2)
}

// Raster space → font units. Winding is fixed in raster space first (fontify's
// orient), the y-flip then turns outers counter-clockwise in font space.
function toContours(paths: Traced[], cell: CellBox): Contour[] {
  const k = cell.width / TRACE
  const fx = (x: number) => x * k + cell.left
  const fy = (y: number) => cell.top - y * k
  const out: Contour[] = []
  for (const traced of paths) {
    const segs = orient(traced)
    if (!segs.length) continue
    const c: Contour = [{ type: 'M', x: fx(segs[0].x1), y: fy(segs[0].y1) }]
    for (const s of segs) {
      if (s.type === 'L') c.push({ type: 'L', x: fx(s.x2), y: fy(s.y2) })
      else c.push({ type: 'Q', x1: fx(s.x2), y1: fy(s.y2), x: fx(s.x3!), y: fy(s.y3!) })
    }
    out.push(c)
  }
  return out
}

// The y-flip into font coordinates inverts winding, and nonzero fill needs holes
// wound opposite to outer contours - normalize both explicitly.
function orient(traced: Traced): Seg[] {
  const area = signedArea(traced.segments)
  const needReverse = traced.isholepath ? area < 0 : area > 0
  return needReverse ? reverse(traced.segments) : traced.segments
}

function signedArea(segs: Seg[]): number {
  let a = 0
  for (const s of segs) {
    const [ex, ey] = s.type === 'Q' ? [s.x3!, s.y3!] : [s.x2, s.y2]
    a += s.x1 * ey - ex * s.y1
  }
  return a / 2
}

function reverse(segs: Seg[]): Seg[] {
  return segs
    .slice()
    .reverse()
    .map(s =>
      s.type === 'L'
        ? { type: 'L' as const, x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 }
        : { type: 'Q' as const, x1: s.x3!, y1: s.y3!, x2: s.x2, y2: s.y2, x3: s.x1, y3: s.y1 },
    )
}

export const engineA: OutlineEngine = {
  id: 'A',
  label: 'A · fontify trace',
  outline(strokes, _pen, cell) {
    if (!strokes.length) return []
    return toContours(traceImage(rasterStrokesA(strokes, cell)), cell)
  },
}

export const engineA2: OutlineEngine = {
  id: 'A2',
  label: 'A′ · trace + pressure',
  outline(strokes, pen, cell) {
    if (!strokes.length) return []
    return toContours(traceImage(rasterStrokesA2(strokes, pen, cell)), cell)
  },
}

import type { Contour, PathCmd } from '../engines/types'

export interface Bounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

/** Exact bounds of a set of contours (including cubic/quadratic extrema). */
export function contourBounds(contours: Contour[]): Bounds | null {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
  const add = (x: number, y: number) => {
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  for (const c of contours) {
    let px = 0, py = 0
    for (const cmd of c) {
      if (cmd.type === 'C') {
        for (const t of cubicExtrema(px, cmd.x1, cmd.x2, cmd.x)) add(cubicAt(px, cmd.x1, cmd.x2, cmd.x, t), cubicAt(py, cmd.y1, cmd.y2, cmd.y, t))
        for (const t of cubicExtrema(py, cmd.y1, cmd.y2, cmd.y)) add(cubicAt(px, cmd.x1, cmd.x2, cmd.x, t), cubicAt(py, cmd.y1, cmd.y2, cmd.y, t))
      } else if (cmd.type === 'Q') {
        for (const t of quadExtrema(px, cmd.x1, cmd.x)) add(quadAt(px, cmd.x1, cmd.x, t), quadAt(py, cmd.y1, cmd.y, t))
        for (const t of quadExtrema(py, cmd.y1, cmd.y)) add(quadAt(px, cmd.x1, cmd.x, t), quadAt(py, cmd.y1, cmd.y, t))
      }
      add(cmd.x, cmd.y)
      px = cmd.x
      py = cmd.y
    }
  }
  return isFinite(xMin) ? { xMin, xMax, yMin, yMax } : null
}

function cubicAt(a: number, b: number, c: number, d: number, t: number) {
  const mt = 1 - t
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d
}
function quadAt(a: number, b: number, c: number, t: number) {
  const mt = 1 - t
  return mt * mt * a + 2 * mt * t * b + t * t * c
}
function cubicExtrema(a: number, b: number, c: number, d: number): number[] {
  // derivative: 3[(b-a)(1-t)^2 + 2(c-b)(1-t)t + (d-c)t^2]
  const A = -a + 3 * b - 3 * c + d
  const B = 2 * (a - 2 * b + c)
  const C = b - a
  const out: number[] = []
  if (Math.abs(A) < 1e-9) {
    if (Math.abs(B) > 1e-9) out.push(-C / B)
  } else {
    const disc = B * B - 4 * A * C
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      out.push((-B + s) / (2 * A), (-B - s) / (2 * A))
    }
  }
  return out.filter(t => t > 0 && t < 1)
}
function quadExtrema(a: number, b: number, c: number): number[] {
  const den = a - 2 * b + c
  if (Math.abs(den) < 1e-9) return []
  const t = (a - b) / den
  return t > 0 && t < 1 ? [t] : []
}

export function mapContours(contours: Contour[], fx: (x: number) => number, fy: (y: number) => number): Contour[] {
  return contours.map(c =>
    c.map((cmd): PathCmd => {
      switch (cmd.type) {
        case 'M':
        case 'L':
          return { type: cmd.type, x: fx(cmd.x), y: fy(cmd.y) }
        case 'Q':
          return { type: 'Q', x1: fx(cmd.x1), y1: fy(cmd.y1), x: fx(cmd.x), y: fy(cmd.y) }
        case 'C':
          return { type: 'C', x1: fx(cmd.x1), y1: fy(cmd.y1), x2: fx(cmd.x2), y2: fy(cmd.y2), x: fx(cmd.x), y: fy(cmd.y) }
      }
    }),
  )
}

export interface Spaced {
  contours: Contour[]
  advance: number
  lsb: number
  rsb: number
  bounds: Bounds
}

/** Sidebearings from the glyph's own width (fontify uses a flat 40 units). */
export function spaceGlyph(contours: Contour[], bearing: number | ((width: number) => number) = 40): Spaced | null {
  const b = contourBounds(contours)
  if (!b) return null
  const width = b.xMax - b.xMin
  const sb = typeof bearing === 'number' ? bearing : bearing(width)
  const shift = sb - b.xMin
  const moved = mapContours(contours, x => x + shift, y => y)
  return {
    contours: moved,
    advance: Math.round(width + 2 * sb),
    lsb: sb,
    rsb: sb,
    bounds: { ...b, xMin: b.xMin + shift, xMax: b.xMax + shift },
  }
}

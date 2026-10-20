// Edge profiles: for horizontal bands of a glyph, the leftmost and rightmost
// ink x. Spacing and kerning both read the shape through these.
import type { Contour } from '../engines/types'

export interface Profile {
  y0: number
  bandH: number
  left: Float64Array // NaN where the band has no ink
  right: Float64Array
}

/** Sample every segment densely (≈ `step` font units). */
export function flattenContours(contours: Contour[], step = 10): [number, number][] {
  const out: [number, number][] = []
  for (const c of contours) {
    let px = c[0]?.x ?? 0
    let py = c[0]?.y ?? 0
    const sx = px
    const sy = py
    const seg = (fx: (t: number) => number, fy: (t: number) => number, approxLen: number) => {
      const n = Math.max(1, Math.ceil(approxLen / step))
      for (let i = 1; i <= n; i++) out.push([fx(i / n), fy(i / n)])
    }
    out.push([px, py])
    const segments = [...c.slice(1), { type: 'L' as const, x: sx, y: sy }]
    for (const cmd of segments) {
      const x0 = px, y0 = py
      if (cmd.type === 'C') {
        const len = Math.hypot(cmd.x1 - x0, cmd.y1 - y0) + Math.hypot(cmd.x2 - cmd.x1, cmd.y2 - cmd.y1) + Math.hypot(cmd.x - cmd.x2, cmd.y - cmd.y2)
        const b = (a: number, b1: number, b2: number, d: number) => (t: number) => {
          const m = 1 - t
          return m * m * m * a + 3 * m * m * t * b1 + 3 * m * t * t * b2 + t * t * t * d
        }
        seg(b(x0, cmd.x1, cmd.x2, cmd.x), b(y0, cmd.y1, cmd.y2, cmd.y), len)
      } else if (cmd.type === 'Q') {
        const len = Math.hypot(cmd.x1 - x0, cmd.y1 - y0) + Math.hypot(cmd.x - cmd.x1, cmd.y - cmd.y1)
        const q = (a: number, b1: number, d: number) => (t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b1 + t * t * d
        seg(q(x0, cmd.x1, cmd.x), q(y0, cmd.y1, cmd.y), len)
      } else if (cmd.type === 'L' || cmd.type === 'M') {
        seg(t => x0 + (cmd.x - x0) * t, t => y0 + (cmd.y - y0) * t, Math.hypot(cmd.x - x0, cmd.y - y0))
      }
      px = cmd.x
      py = cmd.y
    }
  }
  return out
}

export function edgeProfile(contours: Contour[], y0: number, y1: number, bands: number, dilate = 0): Profile {
  const bandH = (y1 - y0) / bands
  const left = new Float64Array(bands).fill(NaN)
  const right = new Float64Array(bands).fill(NaN)
  for (const [x, y] of flattenContours(contours)) {
    const b = Math.floor((y - y0) / bandH)
    if (b < 0 || b >= bands) continue
    if (!(left[b] <= x)) left[b] = x
    if (!(right[b] >= x)) right[b] = x
  }
  if (!dilate) return { y0, bandH, left, right }
  // Grow each band by its neighbours so diagonal near-misses count.
  const l2 = new Float64Array(bands).fill(NaN)
  const r2 = new Float64Array(bands).fill(NaN)
  for (let b = 0; b < bands; b++) {
    for (let d = -dilate; d <= dilate; d++) {
      const k = b + d
      if (k < 0 || k >= bands || Number.isNaN(left[k])) continue
      if (!(l2[b] <= left[k])) l2[b] = left[k]
      if (!(r2[b] >= right[k])) r2[b] = right[k]
    }
  }
  return { y0, bandH, left: l2, right: r2 }
}

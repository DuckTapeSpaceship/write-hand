// Winding helpers. Font space is y-up; outers wind counter-clockwise (positive
// area), holes clockwise. The signedArea/reverse idea comes from fontify's
// fontBuilder.ts (MIT, github.com/alexkroeker177/fontify).
import type { Contour, PathCmd } from '../engines/types'

/** Signed area of the contour's on-curve polygon (positive = CCW, y up). */
export function signedArea(c: Contour): number {
  let a = 0
  for (let i = 0; i < c.length; i++) {
    const p = c[i]
    const q = c[(i + 1) % c.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

export function reverseContour(c: Contour): Contour {
  if (c.length < 2) return c
  const out: Contour = [{ type: 'M', x: c[c.length - 1].x, y: c[c.length - 1].y }]
  // Segment i goes from end(i-1) to end(i); reversed it goes end(i) → end(i-1).
  for (let i = c.length - 1; i >= 1; i--) {
    const cmd = c[i]
    const prev = c[i - 1]
    out.push(reverseSeg(cmd, prev.x, prev.y))
  }
  // Close the loop: the original start point was reached implicitly.
  const first = c[0]
  const last = out[out.length - 1]
  if (last.x !== first.x || last.y !== first.y) out.push({ type: 'L', x: first.x, y: first.y })
  // Drop a closing segment that returns to the new start (implicit close).
  const end = out[out.length - 1]
  if (out.length > 2 && end.type === 'L' && end.x === out[0].x && end.y === out[0].y) out.pop()
  return out
}

function reverseSeg(cmd: PathCmd, toX: number, toY: number): PathCmd {
  switch (cmd.type) {
    case 'Q':
      return { type: 'Q', x1: cmd.x1, y1: cmd.y1, x: toX, y: toY }
    case 'C':
      return { type: 'C', x1: cmd.x2, y1: cmd.y2, x2: cmd.x1, y2: cmd.y1, x: toX, y: toY }
    default:
      return { type: 'L', x: toX, y: toY }
  }
}

function pointInPolygon(x: number, y: number, c: Contour): boolean {
  let inside = false
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const xi = c[i].x, yi = c[i].y, xj = c[j].x, yj = c[j].y
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Orient every contour by nesting depth: even depth = outer (CCW), odd = hole (CW). */
export function fixWinding(contours: Contour[]): Contour[] {
  return contours.map((c, i) => {
    const probe = c[0]
    let depth = 0
    for (let j = 0; j < contours.length; j++) {
      if (j !== i && Math.abs(signedArea(contours[j])) > Math.abs(signedArea(c)) && pointInPolygon(probe.x, probe.y, contours[j])) depth++
    }
    const wantPositive = depth % 2 === 0
    const a = signedArea(c)
    return (a > 0) === wantPositive ? c : reverseContour(c)
  })
}

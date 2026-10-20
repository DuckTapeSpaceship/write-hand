import { FillRule, unionD, type PathsD } from 'clipper2-ts'

export type Poly = number[][] // [[x, y], ...]

/** Union of (possibly self-intersecting) polygons under the nonzero rule.
 *  Each input is oriented positive first: perfect-freehand winds an outline by
 *  stroke direction, and two strokes drawn in opposite directions would cancel
 *  to winding 0 where they cross, punching a hole. Clipper2 returns outers with
 *  positive area (counter-clockwise, y up) and holes negative. */
export function unionPolygons(polys: Poly[], precision = 2): Poly[] {
  const subject: PathsD = []
  for (const p of polys) {
    if (p.length < 3) continue
    const path = p.map(([x, y]) => ({ x, y }))
    subject.push(polyArea(p) < 0 ? path.reverse() : path)
  }
  if (!subject.length) return []
  const out = unionD(subject, [], FillRule.NonZero, precision)
  return out.map(path => path.map(pt => [pt.x, pt.y]))
}

function polyArea(p: Poly): number {
  let a = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1]
  return a / 2
}

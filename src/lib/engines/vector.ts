// Engine B (vector): perfect-freehand outline per stroke → Clipper2 nonzero
// union → Schneider cubic fit → winding fix. No raster step, so it runs
// anywhere (worker, Node) and its output scales with the stroke data.
import { DEFAULT_FIT, fitClosedPolygon, type FitOptions } from '../geom/fit'
import { unionPolygons } from '../geom/union'
import { fixWinding } from '../geom/winding'
import { freehandPolygon } from './freehand'
import type { Contour, OutlineEngine } from './types'

export function vectorOutline(polys: number[][][], fit: FitOptions = DEFAULT_FIT): Contour[] {
  const merged = unionPolygons(polys)
  const contours: Contour[] = []
  for (const poly of merged) {
    const c = fitClosedPolygon(poly, fit)
    if (c.length >= 3) contours.push(c)
  }
  return fixWinding(contours)
}

export const engineB: OutlineEngine = {
  id: 'B',
  label: 'B · vector',
  outline(strokes, pen) {
    if (!strokes.length) return []
    return vectorOutline(strokes.map(s => freehandPolygon(s, pen)))
  },
}

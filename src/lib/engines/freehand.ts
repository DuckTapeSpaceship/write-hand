import { getStroke } from 'perfect-freehand'
import type { Pen, Stroke } from '../model/project'
import { strokeInput } from './pressure'

/** One stroke → its perfect-freehand outline polygon, in font units. */
export function freehandPolygon(s: Stroke, pen: Pen): number[][] {
  const { points, simulate } = strokeInput(s, pen.pressure)
  if (!points.length) return []
  const taper = pen.taper ? pen.taper * pen.size * 4 : 0
  return getStroke(points, {
    size: pen.size,
    thinning: pen.thinning,
    smoothing: pen.smoothing,
    streamline: pen.streamline,
    simulatePressure: simulate,
    last: true,
    start: { taper, cap: true },
    end: { taper, cap: true },
  })
}

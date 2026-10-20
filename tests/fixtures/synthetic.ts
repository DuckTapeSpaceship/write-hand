import type { Stroke } from '../../src/lib/model/project'

/** A polyline stroke sampled every ~10 units, in font units. */
export function line(pts: [number, number][], step = 10): Stroke {
  const out: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
    for (let k = 0; k < n; k++) out.push(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, 0.5, out.length)
  }
  const last = pts[pts.length - 1]
  out.push(last[0], last[1], 0.5, out.length)
  return { pts: out, pointer: 'mouse' }
}

export const MARK_STROKES: Record<string, Stroke[]> = {
  'mark.acute': [line([[480, 520], [580, 640]])],
  'mark.grave': [line([[420, 640], [520, 520]])],
  'mark.circumflex': [line([[400, 520], [500, 640], [600, 520]])],
  'mark.dieresis': [line([[420, 580], [422, 582]]), line([[580, 580], [582, 582]])],
  'mark.tilde': [line([[380, 560], [440, 610], [560, 560], [620, 610]])],
  'mark.ring': [line(Array.from({ length: 25 }, (_, i) => [500 + 50 * Math.cos((i / 24) * Math.PI * 2), 600 + 50 * Math.sin((i / 24) * Math.PI * 2)] as [number, number]))],
  'mark.cedilla': [line([[500, 0], [500, -80], [580, -120], [500, -200]])],
}

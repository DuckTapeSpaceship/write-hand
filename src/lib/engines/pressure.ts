import type { PressureMode, Stroke } from '../model/project'
import { PT_STRIDE } from '../model/project'

// Three pressure sources, so the pen effect can be developed without a pen:
//  real      - the device reported `pressure` (Apple Pencil, S Pen, Wacom)
//  simulated - perfect-freehand's simulatePressure: faster movement = thinner
//  synthetic - a deterministic curve baked into the points (fixtures, tests)

export type SyntheticCurve = 'taper' | 'sine' | 'ramp' | 'flat'

export const SYNTHETIC_CURVES: SyntheticCurve[] = ['taper', 'sine', 'ramp', 'flat']

/** Pressure at arc-length fraction u ∈ [0, 1]. Always in [0.15, 0.95]. */
export function syntheticPressure(curve: SyntheticCurve, u: number): number {
  return Math.min(0.95, Math.max(0.15, rawCurve(curve, Math.min(1, Math.max(0, u)))))
}

function rawCurve(curve: SyntheticCurve, t: number): number {
  switch (curve) {
    case 'taper': {
      // ease in over the first 20 %, out over the last 25 %
      const inn = smoothstep(Math.min(1, t / 0.2))
      const out = smoothstep(Math.min(1, (1 - t) / 0.25))
      return 0.15 + 0.8 * Math.min(inn, out)
    }
    case 'sine':
      return 0.55 + 0.35 * Math.sin(t * Math.PI * 4)
    case 'ramp':
      return 0.15 + 0.8 * t
    case 'flat':
      return 0.5
  }
}

function smoothstep(x: number): number {
  return x * x * (3 - 2 * x)
}

/** Returns a copy of the stroke with the curve baked into the pressure channel.
 *  The pointer becomes 'pen' so the real-pressure path is exercised. */
export function applySyntheticPressure(stroke: Stroke, curve: SyntheticCurve): Stroke {
  const pts = stroke.pts.slice()
  const n = pts.length / PT_STRIDE
  const cum = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    const dx = pts[i * PT_STRIDE] - pts[(i - 1) * PT_STRIDE]
    const dy = pts[i * PT_STRIDE + 1] - pts[(i - 1) * PT_STRIDE + 1]
    cum[i] = cum[i - 1] + Math.hypot(dx, dy)
  }
  const total = cum[n - 1] || 1
  for (let i = 0; i < n; i++) pts[i * PT_STRIDE + 2] = syntheticPressure(curve, n > 1 ? cum[i] / total : 0.5)
  return { pts, pointer: 'pen' }
}

/** True when the stroke carries device pressure worth using. */
export function hasRealPressure(stroke: Stroke): boolean {
  if (stroke.pointer !== 'pen') return false
  let min = Infinity
  let max = -Infinity
  for (let i = 2; i < stroke.pts.length; i += PT_STRIDE) {
    const p = stroke.pts[i]
    if (p < min) min = p
    if (p > max) max = p
  }
  return max > 0 && max - min > 0.02
}

export interface PressureInput {
  points: [number, number, number][]
  simulate: boolean
}

/** Resolve which pressure source a stroke uses for perfect-freehand. */
export function strokeInput(stroke: Stroke, mode: PressureMode): PressureInput {
  const real = mode === 'real' || (mode === 'auto' && hasRealPressure(stroke))
  const points: [number, number, number][] = []
  for (let i = 0; i + 3 < stroke.pts.length; i += PT_STRIDE) {
    const p = real ? stroke.pts[i + 2] : 0.5
    points.push([stroke.pts[i], stroke.pts[i + 1], p])
  }
  return { points, simulate: !real && mode !== 'none' }
}

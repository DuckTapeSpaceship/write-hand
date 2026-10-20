import type { Metrics } from './metrics'

export type PointerKind = 'pen' | 'touch' | 'mouse'

/** pts is flat [x, y, pressure, t, x, y, pressure, t, ...] in font units / ms. */
export interface Stroke {
  pts: number[]
  pointer: PointerKind
}

export const PT_STRIDE = 4

export type SlotKind = 'base' | 'alt' | 'liga' | 'mark'

export interface Slot {
  id: string // 'a', 'a.alt1', 'f_f', 'mark.acute'
  kind: SlotKind
  unicode?: number
  strokes: Stroke[]
  rev: number
}

export type PenStyle = 'fineliner' | 'marker' | 'brush'
export type PressureMode = 'auto' | 'real' | 'simulated' | 'none'

export interface Pen {
  style: PenStyle
  /** Nib diameter in font units. */
  size: number
  thinning: number
  smoothing: number
  streamline: number
  taper: number
  pressure: PressureMode
}

export const PEN_PRESETS: Record<PenStyle, Pen> = {
  fineliner: { style: 'fineliner', size: 56, thinning: 0.25, smoothing: 0.5, streamline: 0.35, taper: 0, pressure: 'auto' },
  marker: { style: 'marker', size: 84, thinning: 0.05, smoothing: 0.6, streamline: 0.35, taper: 0, pressure: 'auto' },
  brush: { style: 'brush', size: 96, thinning: 0.7, smoothing: 0.55, streamline: 0.4, taper: 0.25, pressure: 'auto' },
}

export interface Project {
  schema: 2
  name: string
  metrics: Metrics
  pen: Pen
  slots: Record<string, Slot>
  sample: string
}

export function strokePoints(s: Stroke): { x: number; y: number; p: number; t: number }[] {
  const out = []
  for (let i = 0; i + PT_STRIDE - 1 < s.pts.length; i += PT_STRIDE) {
    out.push({ x: s.pts[i], y: s.pts[i + 1], p: s.pts[i + 2], t: s.pts[i + 3] })
  }
  return out
}

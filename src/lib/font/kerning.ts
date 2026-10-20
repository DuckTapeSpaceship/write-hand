// Auto-kerning from facing edge profiles. For a pair (L, R) the gap in each
// band is L's right sidebearing at that height plus R's left one; the
// effective gap blends the narrowest point with the average (so round shapes
// aren't penalised). Kerning corrects outliers only, against a reference gap
// measured on straight-sided pairs (n n, H H, m m):
//  - tighten when the effective gap is clearly wider than the reference (To, Ty, f.)
//  - loosen only to stop a collision (the narrowest gap under half the reference)
import type { Contour } from '../engines/types'
import type { Metrics } from '../model/metrics'
import { edgeProfile, type Profile } from './profile'
import { baseBearing } from './spacing'

export interface KernGlyph {
  name: string
  contours: Contour[] // already spaced (lsb applied)
  advance: number
}

export type KernTable = Map<string, Map<string, number>>

const BANDS = 40
const MIN_KERN = 12

function gaps(L: Profile, advL: number, R: Profile): { eff: number; min: number } | null {
  let min = Infinity
  let sum = 0
  let n = 0
  for (let b = 0; b < BANDS; b++) {
    const lr = L.right[b]
    const rl = R.left[b]
    if (Number.isNaN(lr) || Number.isNaN(rl)) continue
    const g = advL - lr + rl
    if (g < min) min = g
    sum += g
    n++
  }
  if (!n) return null
  return { eff: 0.6 * min + 0.4 * (sum / n), min }
}

export function computeKerning(glyphs: KernGlyph[], metrics: Metrics): KernTable {
  const y0 = metrics.descender
  const y1 = metrics.ascender
  const prof = new Map<string, Profile>()
  for (const g of glyphs) if (g.contours.length) prof.set(g.name, edgeProfile(g.contours, y0, y1, BANDS, 1))
  const adv = new Map(glyphs.map(g => [g.name, g.advance]))

  const refs: number[] = []
  for (const r of ['n', 'H', 'm']) {
    const p = prof.get(r)
    if (!p) continue
    const g = gaps(p, adv.get(r)!, p)
    if (g) refs.push(g.eff)
  }
  const desired = refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : 2 * baseBearing(metrics.xHeight)

  const table: KernTable = new Map()
  const names = [...prof.keys()]
  for (const l of names) {
    const L = prof.get(l)!
    const advL = adv.get(l)!
    for (const r of names) {
      const g = gaps(L, advL, prof.get(r)!)
      if (!g) continue
      let k = 0
      const deadZone = Math.max(MIN_KERN, 0.2 * desired)
      if (g.min < 0.5 * desired) k = 0.5 * desired - g.min
      else if (desired - g.eff < -deadZone) k = desired - g.eff
      const lo = -0.4 * Math.min(advL, adv.get(r)!)
      k = Math.round(Math.max(lo, Math.min(0.5 * desired, k)) / 5) * 5
      if (Math.abs(k) < MIN_KERN) continue
      let row = table.get(l)
      if (!row) table.set(l, (row = new Map()))
      row.set(r, k)
    }
  }
  return table
}

// Accented letters from drawn marks: the base outline plus the mark outline,
// with the mark centred over (or under) the base's ink. i and j lose their dot
// first (strokes that sit small and above the x-height are treated as dots).
import type { Contour } from '../engines/types'
import type { Metrics } from '../model/metrics'
import type { Stroke } from '../model/project'
import { PT_STRIDE } from '../model/project'
import { edgeProfile } from './profile'
import { contourBounds, mapContours } from './spacing'

export type MarkName = 'grave' | 'acute' | 'circumflex' | 'tilde' | 'dieresis' | 'ring' | 'cedilla'

export const MARKS: { name: MarkName; label: string; unicode?: number; below?: boolean }[] = [
  { name: 'acute', label: '´', unicode: 0x00b4 },
  { name: 'grave', label: 'ˋ' }, // U+0060 ` is its own (recommended) slot
  { name: 'circumflex', label: 'ˆ', unicode: 0x02c6 },
  { name: 'dieresis', label: '¨', unicode: 0x00a8 },
  { name: 'tilde', label: '˜', unicode: 0x02dc },
  { name: 'ring', label: '˚', unicode: 0x02da },
  { name: 'cedilla', label: '¸', unicode: 0x00b8, below: true },
]

export const MARK_BY_NAME = new Map(MARKS.map(m => [m.name, m]))

/** Western European accented letters: character → [base slot, mark]. */
export const DECOMPOSE: Record<string, [string, MarkName]> = {}
const add = (bases: string, mark: MarkName, composed: string) => [...composed].forEach((ch, i) => (DECOMPOSE[ch] = [[...bases][i], mark]))
add('AEIOUaeiou', 'grave', 'ÀÈÌÒÙàèìòù')
add('AEIOUYaeiouy', 'acute', 'ÁÉÍÓÚÝáéíóúý')
add('AEIOUaeiou', 'circumflex', 'ÂÊÎÔÛâêîôû')
add('ANOano', 'tilde', 'ÃÑÕãñõ')
add('AEIOUYaeiouy', 'dieresis', 'ÄËÏÖÜŸäëïöüÿ')
add('Aa', 'ring', 'Åå')
add('Cc', 'cedilla', 'Çç')

export const COMPOSED_CHARS = Object.keys(DECOMPOSE)

export function markSlotId(m: MarkName): string {
  return `mark.${m}`
}

/** Can `ch` be composed from what has been drawn? */
export function composable(ch: string, has: (slotId: string) => boolean): boolean {
  const d = DECOMPOSE[ch]
  return !!d && has(d[0]) && has(markSlotId(d[1]))
}

/** Drop dot strokes from i / j: small strokes whose ink sits above the x-height. */
export function dotlessStrokes(strokes: Stroke[], m: Metrics): Stroke[] {
  const kept = strokes.filter(s => {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity
    for (let i = 0; i < s.pts.length; i += PT_STRIDE) {
      minY = Math.min(minY, s.pts[i + 1])
      maxY = Math.max(maxY, s.pts[i + 1])
      minX = Math.min(minX, s.pts[i])
      maxX = Math.max(maxX, s.pts[i])
    }
    const small = maxY - minY < m.xHeight * 0.3 && maxX - minX < m.xHeight * 0.3
    const high = minY > m.xHeight * 0.85
    return !(small && high)
  })
  return kept.length ? kept : strokes
}

/** Place the mark over (or under) the base. Both are unspaced outlines in
 *  cell coordinates; the result is too. */
export function composeOutlines(base: Contour[], mark: Contour[], below: boolean, m: Metrics): Contour[] {
  const bb = contourBounds(base)
  const mb = contourBounds(mark)
  if (!bb || !mb) return base
  const gap = Math.round(m.xHeight * 0.08)
  // Centre on the ink near the attaching edge (a handwritten 'a' leans), not the bbox.
  const band = (bb.yMax - bb.yMin) * 0.3
  const zone = below ? edgeProfile(base, bb.yMin, bb.yMin + band, 4) : edgeProfile(base, bb.yMax - band, bb.yMax, 4)
  let l = Infinity, r = -Infinity
  for (let i = 0; i < 4; i++) {
    if (Number.isNaN(zone.left[i])) continue
    l = Math.min(l, zone.left[i])
    r = Math.max(r, zone.right[i])
  }
  const cx = Number.isFinite(l) ? (l + r) / 2 : (bb.xMin + bb.xMax) / 2
  const dx = cx - (mb.xMin + mb.xMax) / 2
  const dy = below ? bb.yMin + Math.round(m.xHeight * 0.03) - mb.yMax : bb.yMax + gap - mb.yMin
  return [...base, ...mapContours(mark, x => x + dx, y => y + dy)]
}

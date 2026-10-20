// Slots → outlines (via an engine, cached) → spaced glyphs → composed accents
// → kerning → font binary.
import type { Contour, OutlineEngine } from '../engines/types'
import { cellBox, type Metrics } from '../model/metrics'
import type { Pen, Stroke } from '../model/project'
import { buildFont, type BuiltFont, type GlyphInput } from './build'
import { COMPOSED_CHARS, composeOutlines, DECOMPOSE, dotlessStrokes, MARK_BY_NAME, markSlotId, type MarkName } from './compose'
import { computeKerning } from './kerning'
import { baseGlyphName, slotGlyphName } from './names'
import { spaceGlyphOptical } from './spacing'

export interface SlotInput {
  id: string
  strokes: Stroke[]
  rev?: number
}

export interface GlyphStat {
  id: string
  ms: number
  nodes: number
  cached: boolean
}

export interface AssembleInput {
  family: string
  metrics: Metrics
  pen: Pen
  engine: OutlineEngine
  slots: SlotInput[]
  cache?: Map<string, Contour[]>
  /** Defaults to true. */
  kerning?: boolean
}

export interface Assembled extends BuiltFont {
  stats: GlyphStat[]
  outlineMs: number
  glyphCount: number
  kernPairs: number
}

const penKey = (p: Pen) => `${p.style}:${p.size}:${p.thinning}:${p.smoothing}:${p.streamline}:${p.taper}:${p.pressure}`

export function parseSlotId(id: string): { kind: 'base' | 'alt' | 'liga' | 'mark'; base?: string; components?: string[]; unicode?: number; mark?: MarkName } {
  const alt = /^(.+)\.alt(\d+)$/u.exec(id)
  if (alt) return { kind: 'alt', base: alt[1] }
  if (id.startsWith('mark.')) {
    const mark = id.slice(5) as MarkName
    return { kind: 'mark', mark, unicode: MARK_BY_NAME.get(mark)?.unicode }
  }
  const chars = [...id]
  if (chars.length === 1) return { kind: 'base', unicode: id.codePointAt(0) }
  if (id.includes('_')) return { kind: 'liga', components: id.split('_') }
  return { kind: 'base' }
}

export function outlineSlot(input: AssembleInput, slot: SlotInput): { contours: Contour[]; ms: number; cached: boolean } {
  const key = `${slot.id}#${slot.rev ?? 0}#${penKey(input.pen)}#${input.engine.id}`
  const hit = input.cache?.get(key)
  if (hit) return { contours: hit, ms: 0, cached: true }
  const t0 = performance.now()
  const contours = input.engine.outline(slot.strokes, input.pen, cellBox(input.metrics))
  const ms = performance.now() - t0
  input.cache?.set(key, contours)
  return { contours, ms, cached: false }
}

export function assembleFont(input: AssembleInput): Assembled {
  const { metrics } = input
  const glyphs: GlyphInput[] = []
  const stats: GlyphStat[] = []
  const drawn = new Map<string, SlotInput>()
  const outlines = new Map<string, Contour[]>()
  let outlineMs = 0

  const push = (name: string, unicode: number | undefined, contours: Contour[]) => {
    const spaced = spaceGlyphOptical(contours, metrics.xHeight, metrics.capHeight)
    if (!spaced) return false
    glyphs.push({ name, unicode, contours: spaced.contours, advance: spaced.advance })
    return true
  }

  for (const slot of input.slots) {
    if (!slot.strokes.length) continue
    const info = parseSlotId(slot.id)
    const { contours, ms, cached } = outlineSlot(input, slot)
    outlineMs += ms
    if (!push(slotGlyphName(slot.id), info.kind === 'base' || info.kind === 'mark' ? info.unicode : undefined, contours)) continue
    drawn.set(slot.id, slot)
    outlines.set(slot.id, contours)
    stats.push({ id: slot.id, ms, cached, nodes: contours.reduce((n, c) => n + c.length, 0) })
  }

  // Accented letters, unless drawn directly.
  for (const ch of COMPOSED_CHARS) {
    if (drawn.has(ch)) continue
    const [baseId, mark] = DECOMPOSE[ch]
    const base = drawn.get(baseId)
    const markOutline = outlines.get(markSlotId(mark))
    if (!base || !markOutline) continue
    let baseOutline = outlines.get(baseId)!
    if (baseId === 'i' || baseId === 'j') {
      const dotless = dotlessStrokes(base.strokes, metrics)
      if (dotless !== base.strokes) {
        const r = outlineSlot(input, { id: `${baseId}#dotless`, strokes: dotless, rev: base.rev })
        outlineMs += r.ms
        baseOutline = r.contours
      }
    }
    push(baseGlyphName(ch.codePointAt(0)!), ch.codePointAt(0), composeOutlines(baseOutline, markOutline, !!MARK_BY_NAME.get(mark)?.below, metrics))
  }

  const alternates = new Map<string, string[]>()
  const ligatures: { components: string[]; glyph: string }[] = []
  for (const id of drawn.keys()) {
    const info = parseSlotId(id)
    if (info.kind === 'alt' && drawn.has(info.base!)) {
      const list = alternates.get(info.base!) ?? []
      list.push(id)
      alternates.set(info.base!, list)
    }
    if (info.kind === 'liga' && info.components!.every(c => drawn.has(c))) {
      ligatures.push({ components: info.components!.map(slotGlyphName), glyph: slotGlyphName(id) })
    }
  }
  const altSpec = [...alternates.entries()].map(([base, alts]) => ({
    base: slotGlyphName(base),
    alts: alts.sort((a, b) => altNum(a) - altNum(b)).map(slotGlyphName),
  }))

  const kerning = input.kerning === false ? undefined : computeKerning(glyphs, metrics)
  let kernPairs = 0
  for (const row of kerning?.values() ?? []) kernPairs += row.size

  const built = buildFont({
    family: input.family,
    metrics,
    glyphs,
    alternates: altSpec,
    ligatures,
    kerning,
    spaceAdvance: spaceWidth(glyphs, metrics),
  })
  return { ...built, stats, outlineMs, glyphCount: glyphs.length, kernPairs }
}

const altNum = (id: string) => Number(/\.alt(\d+)$/.exec(id)?.[1] ?? 0)

/** About 55 % of the median lowercase advance, so word gaps match the hand. */
function spaceWidth(glyphs: GlyphInput[], m: Metrics): number {
  const lower = glyphs.filter(g => g.unicode !== undefined && g.unicode >= 97 && g.unicode <= 122).map(g => g.advance).sort((a, b) => a - b)
  if (lower.length < 3) return Math.round(m.upm * 0.3)
  const median = lower[Math.floor(lower.length / 2)]
  return Math.round(Math.max(m.upm * 0.2, Math.min(m.upm * 0.4, median * 0.55)))
}

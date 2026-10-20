// Slots → outlines (via an engine, cached) → spaced glyphs → font binary.
import type { Contour, OutlineEngine } from '../engines/types'
import { cellBox, type Metrics } from '../model/metrics'
import type { Pen, Stroke } from '../model/project'
import { buildFont, type BuiltFont, type GlyphInput } from './build'
import { slotGlyphName } from './names'
import { spaceGlyph } from './spacing'

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
}

export interface Assembled extends BuiltFont {
  stats: GlyphStat[]
  outlineMs: number
  glyphCount: number
}

const penKey = (p: Pen) => `${p.style}:${p.size}:${p.thinning}:${p.smoothing}:${p.streamline}:${p.taper}:${p.pressure}`

export function parseSlotId(id: string): { kind: 'base' | 'alt' | 'liga' | 'mark'; base?: string; components?: string[]; unicode?: number } {
  const alt = /^(.+)\.alt(\d+)$/u.exec(id)
  if (alt) return { kind: 'alt', base: alt[1] }
  if (id.startsWith('mark.')) return { kind: 'mark' }
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
  const glyphs: GlyphInput[] = []
  const stats: GlyphStat[] = []
  const drawn = new Set<string>()
  let outlineMs = 0

  for (const slot of input.slots) {
    if (!slot.strokes.length) continue
    const info = parseSlotId(slot.id)
    if (info.kind === 'mark') continue // composed in P2
    const { contours, ms, cached } = outlineSlot(input, slot)
    outlineMs += ms
    const spaced = spaceGlyph(contours)
    if (!spaced) continue
    const name = slotGlyphName(slot.id)
    glyphs.push({ name, unicode: info.kind === 'base' ? info.unicode : undefined, contours: spaced.contours, advance: spaced.advance })
    drawn.add(slot.id)
    stats.push({ id: slot.id, ms, cached, nodes: contours.reduce((n, c) => n + c.length, 0) })
  }

  const alternates = new Map<string, string[]>()
  const ligatures: { components: string[]; glyph: string }[] = []
  for (const id of drawn) {
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

  const built = buildFont({ family: input.family, metrics: input.metrics, glyphs, alternates: altSpec, ligatures })
  return { ...built, stats, outlineMs, glyphCount: glyphs.length }
}

const altNum = (id: string) => Number(/\.alt(\d+)$/.exec(id)?.[1] ?? 0)

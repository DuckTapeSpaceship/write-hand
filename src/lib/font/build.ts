import { Font, Glyph, Path } from 'opentype.js'
import type { Contour } from '../engines/types'
import type { Metrics } from '../model/metrics'
import { buildGsub } from './gsub'
import { spliceTables } from './sfnt'

export interface GlyphInput {
  name: string
  unicode?: number
  contours: Contour[]
  advance: number
}

export interface FontInput {
  family: string
  style?: string
  metrics: Metrics
  glyphs: GlyphInput[]
  /** Names: base → alternates in cycle order. */
  alternates?: { base: string; alts: string[] }[]
  ligatures?: { components: string[]; glyph: string }[]
  /** Pre-serialized GPOS table (kerning), spliced in as-is. */
  gpos?: Uint8Array | null
  spaceAdvance?: number
}

export interface BuiltFont {
  buffer: ArrayBuffer
  /** Glyph name → glyph id. */
  glyphIds: Map<string, number>
}

export function buildFont(input: FontInput): BuiltFont {
  const { metrics } = input
  const glyphs: Glyph[] = [
    new Glyph({ name: '.notdef', advanceWidth: Math.round(metrics.upm * 0.5), path: notdefPath(metrics) }),
    new Glyph({ name: 'space', unicode: 32, advanceWidth: input.spaceAdvance ?? Math.round(metrics.upm * 0.3), path: new Path() }),
  ]
  const glyphIds = new Map<string, number>([
    ['.notdef', 0],
    ['space', 1],
  ])
  for (const g of input.glyphs) {
    if (glyphIds.has(g.name)) throw new Error(`duplicate glyph name ${g.name}`)
    glyphIds.set(g.name, glyphs.length)
    glyphs.push(
      new Glyph({
        name: g.name,
        unicode: g.unicode,
        advanceWidth: Math.max(0, Math.round(g.advance)),
        path: toPath(g.contours),
      }),
    )
  }

  const font = new Font({
    familyName: input.family.trim() || 'Write-Hand',
    styleName: input.style ?? 'Regular',
    unitsPerEm: metrics.upm,
    ascender: metrics.ascender,
    descender: metrics.descender,
    glyphs,
  })
  const os2 = (font.tables as Record<string, any>).os2
  if (os2) {
    os2.sxHeight = metrics.xHeight
    os2.sCapHeight = metrics.capHeight
  }

  const id = (name: string) => glyphIds.get(name)
  const alternates = (input.alternates ?? [])
    .filter(a => id(a.base) !== undefined)
    .map(a => ({ base: id(a.base)!, alts: a.alts.map(id).filter((g): g is number => g !== undefined) }))
  const ligatures = (input.ligatures ?? [])
    .filter(l => id(l.glyph) !== undefined && l.components.every(c => id(c) !== undefined))
    .map(l => ({ components: l.components.map(c => id(c)!), glyph: id(l.glyph)! }))

  const gsub = buildGsub({ numGlyphs: glyphs.length, alternates, ligatures })
  const raw = font.toArrayBuffer()
  const buffer = spliceTables(raw, { GSUB: gsub, GPOS: input.gpos ?? null })
  return { buffer, glyphIds }
}

function toPath(contours: Contour[]): Path {
  const p = new Path()
  const r = Math.round
  for (const c of contours) {
    for (const cmd of c) {
      switch (cmd.type) {
        case 'M': p.moveTo(r(cmd.x), r(cmd.y)); break
        case 'L': p.lineTo(r(cmd.x), r(cmd.y)); break
        case 'Q': p.quadraticCurveTo(r(cmd.x1), r(cmd.y1), r(cmd.x), r(cmd.y)); break
        case 'C': p.curveTo(r(cmd.x1), r(cmd.y1), r(cmd.x2), r(cmd.y2), r(cmd.x), r(cmd.y)); break
      }
    }
    if (c.length) p.close()
  }
  return p
}

function notdefPath(m: Metrics): Path {
  const p = new Path()
  const w = Math.round(m.upm * 0.5)
  const t = 50
  const h = m.capHeight
  p.moveTo(t, 0); p.lineTo(w - t, 0); p.lineTo(w - t, h); p.lineTo(t, h); p.close()
  p.moveTo(t * 2, t); p.lineTo(t * 2, h - t); p.lineTo(w - t * 2, h - t); p.lineTo(w - t * 2, t); p.close()
  return p
}

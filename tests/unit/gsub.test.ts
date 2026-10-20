import { describe, expect, it } from 'vitest'
import { buildFont, type GlyphInput } from '../../src/lib/font/build'
import { DEFAULT_METRICS } from '../../src/lib/model/metrics'
import type { Contour } from '../../src/lib/engines/types'
import { shape } from '../helpers'

const box = (w: number, h: number): Contour[] => [
  [
    { type: 'M', x: 40, y: 0 },
    { type: 'L', x: 40 + w, y: 0 },
    { type: 'L', x: 40 + w, y: h },
    { type: 'L', x: 40, y: h },
  ],
]

function glyph(name: string, unicode?: number): GlyphInput {
  return { name, unicode, contours: box(200 + name.length * 10, 400), advance: 300 }
}

function font(opts: { alts?: Record<string, string[]>; ligatures?: [string[], string][] }) {
  const names = new Set<string>(['h', 'e', 'l', 'o', 'f', 'i'])
  for (const [b, alts] of Object.entries(opts.alts ?? {})) {
    names.add(b)
    alts.forEach(a => names.add(a))
  }
  for (const [, g] of opts.ligatures ?? []) names.add(g)
  const glyphs = [...names].map(n => glyph(n, n.length === 1 ? n.codePointAt(0) : undefined))
  return buildFont({
    family: 'Spike',
    metrics: DEFAULT_METRICS,
    glyphs,
    alternates: Object.entries(opts.alts ?? {}).map(([base, alts]) => ({ base, alts })),
    ligatures: (opts.ligatures ?? []).map(([components, glyph]) => ({ components, glyph })),
  }).buffer
}

describe('GSUB calt cycling', () => {
  const oneAlt = font({ alts: { l: ['l.alt1'] } })
  const twoAlts = font({ alts: { l: ['l.alt1', 'l.alt2'], e: ['e.alt1'] } })

  it('shapes "hello" to l, l.alt1', () => {
    expect(shape(oneAlt, 'hello')).toEqual(['h', 'e', 'l', 'l.alt1', 'o'])
  })

  it('cycles back to the base after the last alternate', () => {
    expect(shape(oneAlt, 'llll')).toEqual(['l', 'l.alt1', 'l', 'l.alt1'])
    expect(shape(twoAlts, 'llll')).toEqual(['l', 'l.alt1', 'l.alt2', 'l'])
  })

  it('looks back up to 3 glyphs', () => {
    expect(shape(oneAlt, 'lol')).toEqual(['l', 'o', 'l.alt1'])
    expect(shape(oneAlt, 'lool')).toEqual(['l', 'o', 'o', 'l.alt1'])
    // 4 back is out of reach
    expect(shape(oneAlt, 'loool')).toEqual(['l', 'o', 'o', 'o', 'l'])
  })

  it('cycles each letter independently', () => {
    expect(shape(twoAlts, 'eel')).toEqual(['e', 'e.alt1', 'l'])
    expect(shape(twoAlts, 'hello')).toEqual(['h', 'e', 'l', 'l.alt1', 'o'])
  })

  it('ss01 turns cycling off, and -calt disables it', () => {
    expect(shape(oneAlt, 'hello', 'ss01')).toEqual(['h', 'e', 'l', 'l', 'o'])
    expect(shape(oneAlt, 'hello', '-calt')).toEqual(['h', 'e', 'l', 'l', 'o'])
  })
})

describe('GSUB liga', () => {
  const f = font({ alts: { f: ['f.alt1'] }, ligatures: [[['f', 'f'], 'f_f']] })

  it('forms drawn ligatures before calt runs', () => {
    expect(shape(f, 'off')).toEqual(['o', 'f_f'])
    expect(shape(f, 'off', '-liga')).toEqual(['o', 'f', 'f.alt1'])
  })
})

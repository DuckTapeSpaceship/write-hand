// Fixture strokes → engine B (each pen preset) → OTF → HarfBuzz. Fonts are
// written to tests/.out/fonts/ for `npm run verify` (OTS).
import { mkdirSync, writeFileSync } from 'node:fs'
import { parse } from 'opentype.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ENGINE } from '../../src/lib/engines'
import { applySyntheticPressure } from '../../src/lib/engines/pressure'
import { assembleFont, type SlotInput } from '../../src/lib/font/assemble'
import { DEFAULT_METRICS } from '../../src/lib/model/metrics'
import { PEN_PRESETS, type PenStyle } from '../../src/lib/model/project'
import { loadStrokeFixture, shape } from '../helpers'
import { MARK_STROKES } from '../fixtures/synthetic'
import { compress, decompress } from 'woff2-encoder'

const OUT = new URL('../.out/fonts/', import.meta.url)
beforeAll(() => mkdirSync(OUT, { recursive: true }))

const sample = loadStrokeFixture('sample')
const handwriting = loadStrokeFixture('handwriting-mouse')
const STYLES = Object.keys(PEN_PRESETS) as PenStyle[]

function build(slots: SlotInput[], style: PenStyle, family: string) {
  return assembleFont({ family, metrics: DEFAULT_METRICS, pen: PEN_PRESETS[style], engine: DEFAULT_ENGINE, slots })
}

const tapered = (slots: SlotInput[]) => slots.map(s => ({ ...s, strokes: s.strokes.map(st => applySyntheticPressure(st, 'taper')) }))

describe.each(STYLES)('pen %s', style => {
  it('sample set: cycling alternates and ligatures shape in HarfBuzz', () => {
    const font = build(sample, style, `Sample ${style}`)
    writeFileSync(new URL(`sample-${style}.otf`, OUT), new Uint8Array(font.buffer))
    expect(font.glyphCount).toBe(sample.length)
    expect(shape(font.buffer, 'hello')).toEqual(['h', 'e', 'l', 'l.alt1', 'o'])
    expect(shape(font.buffer, 'hello lilly')).toEqual(['h', 'e', 'l', 'l.alt1', 'o', 'space', 'l', 'i', 'l.alt1', 'l', 'y'])
    expect(shape(font.buffer, 'off')).toEqual(['o', 'f_f'])
    expect(shape(font.buffer, 'off', '-liga')).toEqual(['o', 'f', 'f'])

    const parsed = parse(font.buffer)
    for (const ch of 'helloaidnty') {
      const g = parsed.charToGlyph(ch)
      expect(g.name, ch).toBe(ch)
      expect(g.path.commands.length, ch).toBeGreaterThan(4)
      expect(g.advanceWidth, ch).toBeGreaterThan(80)
    }
  })

  it('sample set with synthetic pen pressure', () => {
    const font = build(tapered(sample), style, `Taper ${style}`)
    writeFileSync(new URL(`sample-${style}-taper.otf`, OUT), new Uint8Array(font.buffer))
    expect(shape(font.buffer, 'hello')).toEqual(['h', 'e', 'l', 'l.alt1', 'o'])
  })

  it('real mouse handwriting: liga forms l_l before calt cycles', () => {
    const font = build(handwriting, style, `Hand ${style}`)
    writeFileSync(new URL(`handwriting-${style}.otf`, OUT), new Uint8Array(font.buffer))
    expect(font.glyphCount).toBe(handwriting.length)
    expect(shape(font.buffer, 'hello')).toEqual(['h', 'e', 'l_l', 'o'])
    expect(shape(font.buffer, 'hello', '-liga')).toEqual(['h', 'e', 'l', 'l.alt1', 'o'])
    expect(shape(font.buffer, 'lll', '-liga')).toEqual(['l', 'l.alt1', 'l.alt2'])
    expect(shape(font.buffer, 'lilt')).toEqual(['l', 'i', 'l.alt1', 't'])
    expect(shape(font.buffer, 'off')).toEqual(['o', 'f_f'])
  })
})

describe('accents + kerning', () => {
  it('composes accented letters from drawn marks and passes HarfBuzz', () => {
    const slots = [...handwriting, ...Object.entries(MARK_STROKES).map(([id, strokes]) => ({ id, strokes }))]
    const font = build(slots, 'fineliner', 'Hand Accents')
    writeFileSync(new URL('handwriting-accents.otf', OUT), new Uint8Array(font.buffer))
    const parsed = parse(font.buffer)
    // handwriting fixture has a d e h i l n o t y f H
    for (const ch of 'áàâãäåéèêëíìîïóòôõöñýÿ') expect(parsed.charToGlyph(ch).index, ch).toBeGreaterThan(1)
    expect(shape(font.buffer, 'défi')).toEqual(['d', 'uni00E9', 'f', 'i'])
    expect(font.kernPairs).toBeGreaterThan(0)
  })

  it('compresses to WOFF2 and round-trips', async () => {
    const font = build(handwriting, 'fineliner', 'Hand Woff2')
    const woff2 = await compress(font.buffer)
    writeFileSync(new URL('handwriting.woff2', OUT), woff2)
    expect(String.fromCharCode(...woff2.slice(0, 4))).toBe('wOF2')
    expect(woff2.byteLength).toBeLessThan(font.buffer.byteLength)
    const back = await decompress(woff2)
    expect(parse(back.buffer.slice(back.byteOffset, back.byteOffset + back.byteLength)).numGlyphs).toBe(parse(font.buffer).numGlyphs)
  })
})

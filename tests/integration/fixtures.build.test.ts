// Fixture strokes → each engine → OTF → HarfBuzz. Fonts are written to
// tests/.out/fonts/ for `npm run verify` (OTS).
import { mkdirSync, writeFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
import { parse } from 'opentype.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ENGINES, ENGINE_IDS } from '../../src/lib/engines'
import { applySyntheticPressure } from '../../src/lib/engines/pressure'
import { setCanvasFactory, type RasterCanvas } from '../../src/lib/engines/raster'
import { assembleFont } from '../../src/lib/font/assemble'
import { DEFAULT_METRICS } from '../../src/lib/model/metrics'
import { PEN_PRESETS } from '../../src/lib/model/project'
import { loadStrokeFixture, shape } from '../helpers'

const OUT = new URL('../.out/fonts/', import.meta.url)

beforeAll(() => {
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as RasterCanvas)
  mkdirSync(OUT, { recursive: true })
})
afterAll(() => setCanvasFactory(null))

const slots = loadStrokeFixture('sample')
const handwriting = loadStrokeFixture('handwriting-mouse')

describe.each(ENGINE_IDS)('engine %s · real mouse handwriting', id => {
  it('builds, and liga forms l_l before calt cycles', () => {
    const font = assembleFont({ family: `Hand ${id}`, metrics: DEFAULT_METRICS, pen: PEN_PRESETS.fineliner, engine: ENGINES[id], slots: handwriting })
    writeFileSync(new URL(`handwriting-${id}.otf`, OUT), new Uint8Array(font.buffer))
    expect(font.glyphCount).toBe(handwriting.length)
    expect(shape(font.buffer, 'hello')).toEqual(['h', 'e', 'l_l', 'o'])
    expect(shape(font.buffer, 'hello', '-liga')).toEqual(['h', 'e', 'l', 'l.alt1', 'o'])
    expect(shape(font.buffer, 'lll', '-liga')).toEqual(['l', 'l.alt1', 'l.alt2'])
    expect(shape(font.buffer, 'lilt')).toEqual(['l', 'i', 'l.alt1', 't'])
    expect(shape(font.buffer, 'off')).toEqual(['o', 'f_f'])
  })
})

describe.each(ENGINE_IDS)('engine %s', id => {
  const build = (pressured = false) =>
    assembleFont({
      family: `Sample ${id}`,
      metrics: DEFAULT_METRICS,
      pen: PEN_PRESETS.fineliner,
      engine: ENGINES[id],
      slots: pressured ? slots.map(s => ({ ...s, strokes: s.strokes.map(st => applySyntheticPressure(st, 'taper')) })) : slots,
    })

  it('builds a font that HarfBuzz shapes with cycling alternates and ligatures', () => {
    const font = build()
    writeFileSync(new URL(`sample-${id}.otf`, OUT), new Uint8Array(font.buffer))
    expect(font.glyphCount).toBe(slots.length)
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

  it('builds with synthetic pen pressure', () => {
    const font = build(true)
    writeFileSync(new URL(`sample-${id}-taper.otf`, OUT), new Uint8Array(font.buffer))
    expect(shape(font.buffer, 'hello')).toEqual(['h', 'e', 'l', 'l.alt1', 'o'])
  })
})

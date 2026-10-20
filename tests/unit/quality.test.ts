import { describe, expect, it } from 'vitest'
import { parse } from 'opentype.js'
import { DEFAULT_ENGINE } from '../../src/lib/engines'
import { assembleFont, type SlotInput } from '../../src/lib/font/assemble'
import { opticalBearings } from '../../src/lib/font/spacing'
import { DEFAULT_METRICS } from '../../src/lib/model/metrics'
import { cellBox } from '../../src/lib/model/metrics'
import { PEN_PRESETS, type Stroke } from '../../src/lib/model/project'
import { shapePositions, shape } from '../helpers'
import { line } from '../fixtures/synthetic'

const circle = (cx: number, cy: number, rx: number, ry: number): Stroke =>
  line(Array.from({ length: 49 }, (_, i) => [cx + rx * Math.cos((i / 48) * Math.PI * 2), cy + ry * Math.sin((i / 48) * Math.PI * 2)] as [number, number]))

const SLOTS: SlotInput[] = [
  { id: 'T', strokes: [line([[250, 680], [750, 680]]), line([[500, 680], [500, 0]])] },
  { id: 'H', strokes: [line([[330, 680], [330, 0]]), line([[670, 680], [670, 0]]), line([[330, 340], [670, 340]])] },
  { id: 'o', strokes: [circle(500, 210, 170, 205)] },
  { id: 'n', strokes: [line([[380, 420], [380, 0]]), line([[380, 300], [450, 410], [560, 410], [620, 300], [620, 0]])] },
  { id: 'i', strokes: [line([[500, 420], [500, 0]]), line([[500, 600], [502, 602]])] },
  { id: 'e', strokes: [line([[340, 210], [660, 210], [640, 330], [500, 415], [360, 330], [340, 200], [400, 60], [520, 0], [650, 50]])] },
  { id: 'c', strokes: [line([[650, 350], [560, 415], [420, 380], [345, 210], [420, 40], [560, 0], [650, 60]])] },
  { id: 'mark.acute', strokes: [line([[480, 520], [580, 640]])] },
  { id: 'mark.cedilla', strokes: [line([[500, 0], [500, -80], [580, -120], [500, -200]])] },
]

const build = (kerning = true) =>
  assembleFont({ family: 'Q', metrics: DEFAULT_METRICS, pen: PEN_PRESETS.fineliner, engine: DEFAULT_ENGINE, slots: SLOTS, kerning })

describe('optical spacing', () => {
  it('gives round sides less sidebearing than straight ones', () => {
    const o = DEFAULT_ENGINE.outline(SLOTS[2].strokes, PEN_PRESETS.fineliner, cellBox(DEFAULT_METRICS))
    const n = DEFAULT_ENGINE.outline(SLOTS[3].strokes, PEN_PRESETS.fineliner, cellBox(DEFAULT_METRICS))
    const so = opticalBearings(o, 420, 680)!
    const sn = opticalBearings(n, 420, 680)!
    expect(sn.lsb).toBeGreaterThanOrEqual(38) // straight stem: (almost) the full 42
    expect(so.lsb).toBeLessThan(sn.lsb)
    expect(so.rsb).toBeLessThan(sn.rsb)
  })
})

describe('auto-kerning (GPOS PairPos 2)', () => {
  const font = build()
  const plain = build(false)

  it('tucks o under the T bar, leaves straight pairs alone', () => {
    const adv = (f: ArrayBuffer, text: string, feats = '') => shapePositions(f, text, feats).map(p => p.xAdvance)
    const [tKern] = adv(font.buffer, 'To')
    const [tPlain] = adv(plain.buffer, 'To')
    expect(tPlain - tKern).toBeGreaterThan(60)
    expect(adv(font.buffer, 'To', '-kern')[0]).toBe(tPlain)
    expect(adv(font.buffer, 'HH')[0]).toBe(adv(plain.buffer, 'HH')[0])
    expect(adv(font.buffer, 'nn')[0]).toBe(adv(plain.buffer, 'nn')[0])
    expect(font.kernPairs).toBeGreaterThan(0)
  })

  it('is readable by opentype.js too', () => {
    const f = parse(font.buffer)
    expect(f.getKerningValue(f.charToGlyph('T'), f.charToGlyph('o'))).toBeLessThan(-60)
  })
})

describe('accent composition', () => {
  const font = build()
  const f = parse(font.buffer)

  it('composes é, í, ó, ç from drawn bases and marks', () => {
    for (const ch of 'éíóçÉ'.slice(0, 4)) expect(f.charToGlyph(ch).index, ch).toBeGreaterThan(0)
    expect(f.charToGlyph('É').index).toBe(0) // no E drawn
    expect(f.charToGlyph('´').index).toBeGreaterThan(0) // the mark itself is a glyph
    expect(shape(font.buffer, 'é')).toEqual(['uni00E9'])
  })

  it('puts the acute above the base and the cedilla below', () => {
    const e = f.charToGlyph('e').getBoundingBox()
    const eacute = f.charToGlyph('é').getBoundingBox()
    expect(eacute.y2).toBeGreaterThan(e.y2 + 80)
    expect(eacute.y1).toBeCloseTo(e.y1, -1)
    const c = f.charToGlyph('c').getBoundingBox()
    const ccedilla = f.charToGlyph('ç').getBoundingBox()
    expect(ccedilla.y1).toBeLessThan(c.y1 - 100)
  })

  it('drops the dot from i before adding the accent', () => {
    const i = f.charToGlyph('i').getBoundingBox()
    const iacute = f.charToGlyph('í').getBoundingBox()
    // The dotted i reaches ~630. Anchored on the stem the accent tops out
    // ~660; anchored on the dot it would reach ~840.
    expect(i.y2).toBeGreaterThan(580)
    expect(iacute.y2).toBeLessThan(700)
  })
})

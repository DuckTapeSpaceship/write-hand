import { describe, expect, it } from 'vitest'
import { ALL_SLOTS, REQUIRED_IDS, tierSlots } from '../../src/lib/model/charset'
import { slotGlyphName } from '../../src/lib/font/names'
import { migrate, newProject } from '../../src/lib/store/migrate'
import { coverage, pickAuto, segment } from '../../src/lib/preview/sentences'

describe('charset tiers', () => {
  it('required is a–z, A–Z, 0–9 and . , \' ? !', () => {
    expect(REQUIRED_IDS.length).toBe(26 + 26 + 10 + 5)
    expect(REQUIRED_IDS).toContain("'")
  })
  it('recommended is the rest of keyboard punctuation, no overlap', () => {
    const rec = tierSlots('recommended').map(s => s.id)
    expect(rec.length).toBe(32 - 5)
    expect(rec.some(id => REQUIRED_IDS.includes(id))).toBe(false)
    expect(new Set(ALL_SLOTS.map(s => s.id)).size).toBe(ALL_SLOTS.length)
  })
  it('every slot has a unique glyph name', () => {
    const names = ALL_SLOTS.map(s => slotGlyphName(s.id))
    expect(new Set(names).size).toBe(names.length)
    expect(slotGlyphName('a.alt1')).toBe('a.alt1')
    expect(slotGlyphName('0')).toBe('zero')
    expect(slotGlyphName('?')).toBe('uni003F')
  })
})

describe('sentences', () => {
  const has = (set: string) => (ch: string) => set.includes(ch)
  it('segments missing characters but keeps present runs together', () => {
    expect(segment('hello world', has('helo'))).toEqual([
      { text: 'hello ', missing: false },
      { text: 'w', missing: true },
      { text: 'o', missing: false },
      { text: 'r', missing: true },
      { text: 'l', missing: false },
      { text: 'd', missing: true },
    ])
  })
  it('auto picks the sentence best covered by drawn letters', () => {
    expect(coverage('a cat', has('act'))).toBe(1)
    expect(pickAuto(has('acthe'))).toBe('a cat ate a hat')
    const pick = pickAuto(has('helo'))
    expect(coverage(pick, has('helo'))).toBeGreaterThanOrEqual(0.6)
    expect(pick).toMatch(/hello/)
    expect(pickAuto(() => false)).toBe('Hello! This is my handwriting.')
  })
})

describe('project migration', () => {
  it('accepts a valid project and drops broken strokes', () => {
    const p = newProject()
    p.slots.a = { id: 'a', kind: 'base', unicode: 97, rev: 3, strokes: [{ pts: [1, 2, 0.5, 0], pointer: 'pen' }] }
    ;(p.slots as Record<string, unknown>).b = { id: 'b', kind: 'base', strokes: [{ pts: [1, 2, 3] }] }
    const m = migrate(JSON.parse(JSON.stringify(p)))
    expect(Object.keys(m.slots)).toEqual(['a'])
    expect(m.slots.a.rev).toBe(3)
  })
  it('rejects garbage', () => {
    expect(() => migrate(null)).toThrow()
    expect(() => migrate({ schema: 1 })).toThrow(/schema/)
  })
})

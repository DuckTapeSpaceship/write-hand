import { describe, expect, it } from 'vitest'
import { parse } from 'opentype.js'
import { readFileSync } from 'node:fs'
import { checksum, readSfnt, spliceTables, writeSfnt } from '../../src/lib/font/sfnt'

const ash = readFileSync(new URL('../fixtures/AshFont.ttf', import.meta.url))
const buf = ash.buffer.slice(ash.byteOffset, ash.byteOffset + ash.byteLength)

describe('sfnt splicer', () => {
  it('round-trips a font with valid table checksums and checkSumAdjustment', () => {
    const out = writeSfnt(readSfnt(buf))
    const bytes = new Uint8Array(out)
    expect(checksum(bytes)).toBe(0xb1b0afba)
    const dv = new DataView(out)
    const n = dv.getUint16(4)
    for (let i = 0; i < n; i++) {
      const rec = 12 + i * 16
      const tag = String.fromCharCode(...bytes.slice(rec, rec + 4))
      const off = dv.getUint32(rec + 8)
      const len = dv.getUint32(rec + 12)
      expect(off % 4, tag).toBe(0)
      let data = bytes.slice(off, off + len)
      if (tag === 'head') {
        data = data.slice()
        new DataView(data.buffer).setUint32(8, 0)
      }
      expect(dv.getUint32(rec + 4), tag).toBe(checksum(data))
    }
    expect(parse(out).numGlyphs).toBe(parse(buf).numGlyphs)
  })

  it('adds and drops tables', () => {
    const added = spliceTables(buf, { TEST: new Uint8Array([1, 2, 3]) })
    expect(readSfnt(added).tables.get('TEST')).toEqual(new Uint8Array([1, 2, 3]))
    const dropped = spliceTables(added, { TEST: null })
    expect(readSfnt(dropped).tables.has('TEST')).toBe(false)
  })
})

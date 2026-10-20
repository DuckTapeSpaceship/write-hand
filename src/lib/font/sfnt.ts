// Minimal sfnt (OpenType) table splicer: read the table directory, replace or
// add tables, then rewrite the directory, checksums and head.checkSumAdjustment.

export interface Sfnt {
  version: number
  tables: Map<string, Uint8Array>
}

export function readSfnt(buf: ArrayBuffer | Uint8Array): Sfnt {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = dv.getUint32(0)
  const numTables = dv.getUint16(4)
  const tables = new Map<string, Uint8Array>()
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    const tag = String.fromCharCode(bytes[rec], bytes[rec + 1], bytes[rec + 2], bytes[rec + 3])
    const offset = dv.getUint32(rec + 8)
    const length = dv.getUint32(rec + 12)
    tables.set(tag, bytes.slice(offset, offset + length))
  }
  return { version, tables }
}

export function checksum(data: Uint8Array): number {
  let sum = 0
  const n = data.length
  for (let i = 0; i < n; i += 4) {
    const word = ((data[i] << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0)) >>> 0
    sum = (sum + word) >>> 0
  }
  return sum
}

export function writeSfnt(font: Sfnt): ArrayBuffer {
  const tags = [...font.tables.keys()].sort()
  const n = tags.length
  const entrySelector = Math.floor(Math.log2(n))
  const searchRange = 2 ** entrySelector * 16
  const rangeShift = n * 16 - searchRange

  let size = 12 + 16 * n
  const offsets: number[] = []
  for (const tag of tags) {
    offsets.push(size)
    size += (font.tables.get(tag)!.length + 3) & ~3
  }

  const out = new Uint8Array(size)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, font.version)
  dv.setUint16(4, n)
  dv.setUint16(6, searchRange)
  dv.setUint16(8, entrySelector)
  dv.setUint16(10, rangeShift)

  let headOffset = -1
  tags.forEach((tag, i) => {
    let data = font.tables.get(tag)!
    if (tag === 'head') {
      data = data.slice()
      new DataView(data.buffer).setUint32(8, 0) // checkSumAdjustment
      headOffset = offsets[i]
    }
    out.set(data, offsets[i])
    const rec = 12 + i * 16
    for (let c = 0; c < 4; c++) out[rec + c] = tag.charCodeAt(c)
    dv.setUint32(rec + 4, checksum(data))
    dv.setUint32(rec + 8, offsets[i])
    dv.setUint32(rec + 12, data.length)
  })

  if (headOffset >= 0) dv.setUint32(headOffset + 8, (0xb1b0afba - checksum(out)) >>> 0)
  return out.buffer
}

/** Replace (Uint8Array) or drop (null) tables in a font binary. */
export function spliceTables(buf: ArrayBuffer, replace: Record<string, Uint8Array | null | undefined>): ArrayBuffer {
  const font = readSfnt(buf)
  for (const [tag, data] of Object.entries(replace)) {
    if (data === undefined) continue
    if (data === null) font.tables.delete(tag)
    else font.tables.set(tag, data)
  }
  return writeSfnt(font)
}

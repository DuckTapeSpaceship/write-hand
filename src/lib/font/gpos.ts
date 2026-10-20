// GPOS 'kern': PairPos format 2 (class-based). Glyphs with identical kern rows
// share a first class and identical columns share a second class, which keeps
// the class matrix small. Subtables are split if a matrix would overflow
// 16-bit offsets.
import { classDef, coverage, layoutHeader, lookup, pack, Table } from './otl'

export function buildGpos(kerns: Map<number, Map<number, number>>): Uint8Array | null {
  const firsts = [...kerns.keys()].filter(g => kerns.get(g)!.size).sort((a, b) => a - b)
  if (!firsts.length) return null

  // Second classes: group glyphs by their column across all firsts.
  const seconds = new Set<number>()
  for (const row of kerns.values()) for (const g of row.keys()) seconds.add(g)
  const colKey = (g: number) => firsts.map(f => kerns.get(f)!.get(g) ?? 0).join(',')
  const class2 = new Map<number, number>()
  const colClasses = new Map<string, number>()
  for (const g of [...seconds].sort((a, b) => a - b)) {
    const key = colKey(g)
    if (!colClasses.has(key)) colClasses.set(key, colClasses.size + 1)
    class2.set(g, colClasses.get(key)!)
  }
  const class2Count = colClasses.size + 1
  const rep2 = new Map<number, number>() // class → a member glyph
  for (const [g, c] of class2) if (!rep2.has(c)) rep2.set(c, g)

  // First classes: group by row (in class2 space).
  const rowKey = (f: number) => {
    const row = kerns.get(f)!
    return Array.from({ length: class2Count }, (_, c) => (c ? row.get(rep2.get(c)!) ?? 0 : 0)).join(',')
  }
  const rowGroups = new Map<string, number[]>()
  for (const f of firsts) {
    const key = rowKey(f)
    const list = rowGroups.get(key) ?? []
    list.push(f)
    rowGroups.set(key, list)
  }
  const groups = [...rowGroups.entries()]

  // Each subtable: ≤ maxRows first classes so the value matrix stays < ~60 KB.
  const maxRows = Math.max(1, Math.floor(60000 / (class2Count * 2)) - 1)
  const subtables: Table[] = []
  const classDef2 = classDef(class2)
  for (let i = 0; i < groups.length; i += maxRows) {
    const chunk = groups.slice(i, i + maxRows)
    const class1 = new Map<number, number>()
    const glyphs: number[] = []
    chunk.forEach(([, members], ci) => members.forEach(g => (class1.set(g, ci + 1), glyphs.push(g))))
    const t = new Table('PairPos2')
      .u16(2)
      .off16(coverage(glyphs))
      .u16(0x0004) // valueFormat1: XAdvance
      .u16(0) // valueFormat2
      .off16(classDef(class1))
      .off16(classDef2)
      .u16(chunk.length + 1)
      .u16(class2Count)
    for (let c = 0; c < class2Count; c++) t.i16(0) // class 0 row
    for (const [key] of chunk) for (const v of key.split(',')) t.i16(Number(v))
    subtables.push(t)
  }

  return pack(layoutHeader([{ tag: 'kern', lookups: [0] }], [lookup(2, subtables)]))
}

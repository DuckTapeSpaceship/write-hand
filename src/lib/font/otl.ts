// Tiny serializer for OpenType layout tables. A table is a list of fields;
// Offset16 fields point at child tables, which are laid out depth-first after
// their parent so every offset is positive and relative to the parent's start.

export type Field =
  | { k: 'u16'; v: number }
  | { k: 'i16'; v: number }
  | { k: 'u32'; v: number }
  | { k: 'tag'; v: string }
  | { k: 'off16'; v: Table | null }

export class Table {
  readonly fields: Field[] = []
  constructor(readonly name = '') {}
  u16(v: number): this {
    this.fields.push({ k: 'u16', v })
    return this
  }
  i16(v: number): this {
    this.fields.push({ k: 'i16', v })
    return this
  }
  u32(v: number): this {
    this.fields.push({ k: 'u32', v })
    return this
  }
  tag(v: string): this {
    this.fields.push({ k: 'tag', v })
    return this
  }
  off16(v: Table | null): this {
    this.fields.push({ k: 'off16', v })
    return this
  }
  u16s(vs: number[]): this {
    for (const v of vs) this.u16(v)
    return this
  }
}

export function pack(root: Table): Uint8Array {
  const out: number[] = []
  const placed = new Map<Table, number>()

  const place = (t: Table): number => {
    const start = out.length
    placed.set(t, start)
    const patches: { pos: number; child: Table }[] = []
    for (const f of t.fields) {
      switch (f.k) {
        case 'u16':
          if (f.v < 0 || f.v > 0xffff || !Number.isInteger(f.v)) throw new RangeError(`${t.name}: u16 ${f.v}`)
          out.push(f.v >> 8, f.v & 0xff)
          break
        case 'i16': {
          const v = f.v & 0xffff
          out.push(v >> 8, v & 0xff)
          break
        }
        case 'u32':
          out.push((f.v >>> 24) & 0xff, (f.v >>> 16) & 0xff, (f.v >>> 8) & 0xff, f.v & 0xff)
          break
        case 'tag':
          if (f.v.length !== 4) throw new RangeError(`bad tag ${f.v}`)
          for (let i = 0; i < 4; i++) out.push(f.v.charCodeAt(i))
          break
        case 'off16':
          if (f.v) patches.push({ pos: out.length, child: f.v })
          out.push(0, 0)
          break
      }
    }
    for (const p of patches) {
      const prior = placed.get(p.child)
      const at = prior !== undefined && prior > start ? prior : place(p.child)
      const off = at - start
      if (off > 0xffff) throw new RangeError(`${t.name}: offset overflow (${off})`)
      out[p.pos] = off >> 8
      out[p.pos + 1] = off & 0xff
    }
    return start
  }

  place(root)
  return Uint8Array.from(out)
}

// --- Common structures ---

export function coverage(glyphs: number[]): Table {
  const g = [...new Set(glyphs)].sort((a, b) => a - b)
  const ranges: [number, number, number][] = []
  g.forEach((id, i) => {
    const r = ranges[ranges.length - 1]
    if (r && r[1] === id - 1) r[1] = id
    else ranges.push([id, id, i])
  })
  // Pick the smaller encoding: format 1 = 4 + 2n bytes, format 2 = 4 + 6r bytes.
  if (2 * g.length <= 6 * ranges.length) return new Table('Coverage1').u16(1).u16(g.length).u16s(g)
  const t = new Table('Coverage2').u16(2).u16(ranges.length)
  for (const [s, e, i] of ranges) t.u16(s).u16(e).u16(i)
  return t
}

export function classDef(classes: Map<number, number>): Table {
  const entries = [...classes.entries()].filter(([, c]) => c !== 0).sort((a, b) => a[0] - b[0])
  const ranges: [number, number, number][] = []
  for (const [g, c] of entries) {
    const r = ranges[ranges.length - 1]
    if (r && r[1] === g - 1 && r[2] === c) r[1] = g
    else ranges.push([g, g, c])
  }
  const t = new Table('ClassDef2').u16(2).u16(ranges.length)
  for (const [s, e, c] of ranges) t.u16(s).u16(e).u16(c)
  return t
}

export interface FeatureSpec {
  tag: string
  lookups: number[]
}

/** GSUB/GPOS header with DFLT + latn scripts that enable every feature. */
export function layoutHeader(features: FeatureSpec[], lookups: Table[]): Table {
  const feats = [...features].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  const featureIdx = feats.map((_, i) => i)

  const langSys = () => new Table('LangSys').u16(0).u16(0xffff).u16(featureIdx.length).u16s(featureIdx)
  const script = () => new Table('Script').off16(langSys()).u16(0)
  const scriptList = new Table('ScriptList').u16(2).tag('DFLT').off16(script()).tag('latn').off16(script())

  const featureList = new Table('FeatureList').u16(feats.length)
  for (const f of feats) featureList.tag(f.tag).off16(new Table('Feature').u16(0).u16(f.lookups.length).u16s(f.lookups))

  const lookupList = new Table('LookupList').u16(lookups.length)
  for (const l of lookups) lookupList.off16(l)

  return new Table('Header').u16(1).u16(0).off16(scriptList).off16(featureList).off16(lookupList)
}

export function lookup(type: number, subtables: Table[], flag = 0): Table {
  const t = new Table(`Lookup${type}`).u16(type).u16(flag).u16(subtables.length)
  for (const s of subtables) t.off16(s)
  return t
}

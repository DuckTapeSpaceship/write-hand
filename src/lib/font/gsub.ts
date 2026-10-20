// GSUB serializer: calt (cycling alternates), liga (drawn ligatures) and ss01
// (cycling off). Written by hand because opentype.js can't be relied on to
// write chaining contextual (type 6) lookups.
//
// Lookup order is application order:
//   0      liga            ligatures form first, so "ff" isn't split by calt
//   1      calt            chain context: X after X → X.alt1, after X.alt1 → X.alt2 …
//   2..k   single substs   X → X.altN, invoked only from calt's records
//   k+1    ss01            every X.altN → X, undoing calt when ss01 is on
import { coverage, layoutHeader, lookup, pack, Table, type FeatureSpec } from './otl'

export interface AlternateSet {
  /** Base glyph id followed by its alternates in cycle order. */
  base: number
  alts: number[]
}

export interface LigatureSpec {
  components: number[]
  glyph: number
}

export interface GsubSpec {
  numGlyphs: number
  alternates: AlternateSet[]
  ligatures: LigatureSpec[]
  /** How far back calt looks for the previous occurrence of the same letter. */
  lookback?: number
}

export function buildGsub(spec: GsubSpec): Uint8Array | null {
  const alternates = spec.alternates.filter(a => a.alts.length > 0)
  const lookback = spec.lookback ?? 3
  if (!alternates.length && !spec.ligatures.length) return null

  const lookups: Table[] = []
  const features: FeatureSpec[] = []

  if (spec.ligatures.length) {
    features.push({ tag: 'liga', lookups: [lookups.length] })
    lookups.push(lookup(4, [ligatureSubst(spec.ligatures)]))
  }

  if (alternates.length) {
    const maxAlts = Math.max(...alternates.map(a => a.alts.length))
    const caltIndex = lookups.length
    const toAltIndex = (n: number) => caltIndex + n // n = 1..maxAlts
    const ss01Index = caltIndex + maxAlts + 1

    // calt: one format-3 subtable per (distance, letter, variant); the first
    // subtable that matches wins, so nearer occurrences are tried first.
    const anyGlyph = coverage(range(1, spec.numGlyphs))
    const subtables: Table[] = []
    for (let d = 1; d <= lookback; d++) {
      for (const set of alternates) {
        const variants = [set.base, ...set.alts]
        variants.forEach((prev, k) => {
          const next = (k + 1) % variants.length
          const backtrack: Table[] = []
          for (let i = 0; i < d - 1; i++) backtrack.push(anyGlyph)
          backtrack.push(coverage([prev]))
          // next === 0 wraps to the base glyph: match (so farther rules don't
          // fire) but substitute nothing.
          const records = next === 0 ? [] : [[0, toAltIndex(next)]]
          subtables.push(chainContextFormat3(backtrack, [coverage([set.base])], [], records))
        })
      }
    }
    features.push({ tag: 'calt', lookups: [caltIndex] })
    lookups.push(lookup(6, subtables))

    for (let n = 1; n <= maxAlts; n++) {
      const pairs = alternates.filter(a => a.alts.length >= n).map(a => [a.base, a.alts[n - 1]] as [number, number])
      lookups.push(lookup(1, [singleSubst(pairs)]))
    }

    const revert: [number, number][] = []
    for (const a of alternates) for (const g of a.alts) revert.push([g, a.base])
    features.push({ tag: 'ss01', lookups: [ss01Index] })
    lookups.push(lookup(1, [singleSubst(revert)]))
  }

  return pack(layoutHeader(features, lookups))
}

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i < to; i++) out.push(i)
  return out
}

/** SingleSubst format 2. */
export function singleSubst(pairs: [number, number][]): Table {
  const sorted = [...pairs].sort((a, b) => a[0] - b[0])
  return new Table('SingleSubst2')
    .u16(2)
    .off16(coverage(sorted.map(p => p[0])))
    .u16(sorted.length)
    .u16s(sorted.map(p => p[1]))
}

/** LigatureSubst format 1. Longer ligatures are listed first within a set. */
export function ligatureSubst(ligs: LigatureSpec[]): Table {
  const byFirst = new Map<number, LigatureSpec[]>()
  for (const l of ligs) {
    const list = byFirst.get(l.components[0]) ?? []
    list.push(l)
    byFirst.set(l.components[0], list)
  }
  const firsts = [...byFirst.keys()].sort((a, b) => a - b)
  const t = new Table('LigatureSubst1').u16(1).off16(coverage(firsts)).u16(firsts.length)
  for (const f of firsts) {
    const set = byFirst.get(f)!.sort((a, b) => b.components.length - a.components.length)
    const ls = new Table('LigatureSet').u16(set.length)
    for (const l of set) {
      ls.off16(new Table('Ligature').u16(l.glyph).u16(l.components.length).u16s(l.components.slice(1)))
    }
    t.off16(ls)
  }
  return t
}

/** ChainContextSubst format 3. backtrack[0] is the glyph just before the input. */
export function chainContextFormat3(backtrack: Table[], input: Table[], lookahead: Table[], records: number[][]): Table {
  const t = new Table('ChainContext3').u16(3)
  t.u16(backtrack.length)
  for (const c of backtrack) t.off16(c)
  t.u16(input.length)
  for (const c of input) t.off16(c)
  t.u16(lookahead.length)
  for (const c of lookahead) t.off16(c)
  t.u16(records.length)
  for (const [seqIndex, lookupIndex] of records) t.u16(seqIndex).u16(lookupIndex)
  return t
}

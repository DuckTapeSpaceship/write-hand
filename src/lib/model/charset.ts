// Tiers of slots to draw. Slot ids: base characters are the character itself;
// later tiers add 'a.alt1', 'f_f' and 'mark.acute'.
import { MARKS } from '../font/compose'
import type { SlotKind } from './project'

export type TierId = 'required' | 'recommended' | 'alternates' | 'ligatures' | 'accents'

export interface SlotDef {
  id: string
  kind: SlotKind
  unicode?: number
  /** What the cell label shows. */
  label: string
  tier: TierId
  /** Small note next to the label, e.g. the mark's name. */
  hint?: string
}

export interface SlotGroup {
  label: string
  slots: SlotDef[]
}

export interface Tier {
  id: TierId
  label: string
  groups: SlotGroup[]
}

const base = (tier: TierId) => (ch: string): SlotDef => ({ id: ch, kind: 'base', unicode: ch.codePointAt(0), label: ch, tier })

const REQUIRED_PUNCT = ".,'?!"
// The rest of printable ASCII punctuation.
const RECOMMENDED_PUNCT = [...'!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'].filter(c => !REQUIRED_PUNCT.includes(c)).join('')

export const TIERS: Tier[] = [
  {
    id: 'required',
    label: 'Required',
    groups: [
      { label: 'Lowercase', slots: [...'abcdefghijklmnopqrstuvwxyz'].map(base('required')) },
      { label: 'Uppercase', slots: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(base('required')) },
      { label: 'Digits', slots: [...'0123456789'].map(base('required')) },
      { label: 'Punctuation', slots: [...REQUIRED_PUNCT].map(base('required')) },
    ],
  },
  {
    id: 'recommended',
    label: 'Recommended',
    groups: [{ label: 'Punctuation & symbols', slots: [...RECOMMENDED_PUNCT].map(base('recommended')) }],
  },
  {
    id: 'accents',
    label: 'Accents',
    groups: [
      {
        label: 'Marks · composed onto your letters (é, ñ, ü, ç …)',
        slots: MARKS.map(m => ({ id: `mark.${m.name}`, kind: 'mark' as const, unicode: m.unicode, label: m.label, hint: m.name, tier: 'accents' as const })),
      },
      { label: 'Letters & symbols', slots: [...'ßÆæØøŒœ¿¡«»€£'].map(base('accents')) },
    ],
  },
]

export const ALL_SLOTS: SlotDef[] = TIERS.flatMap(t => t.groups.flatMap(g => g.slots))
export const SLOT_BY_ID = new Map(ALL_SLOTS.map(s => [s.id, s]))
export const REQUIRED_IDS = TIERS[0].groups.flatMap(g => g.slots.map(s => s.id))

export function tierSlots(id: TierId): SlotDef[] {
  return TIERS.find(t => t.id === id)?.groups.flatMap(g => g.slots) ?? []
}

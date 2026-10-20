// OpenType features the preview can toggle: calt cycles alternates, liga
// forms ligatures, ss01 turns alternates off.
export type Features = { calt: boolean; liga: boolean; ss01: boolean }
export const FEATURE_TAGS = ['calt', 'liga', 'ss01'] as const

export function featureCss(f: Features): string {
  return FEATURE_TAGS.map(t => `"${t}" ${f[t] ? 1 : 0}`).join(', ')
}

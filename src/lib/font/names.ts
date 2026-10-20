// Glyph names: letters and digits by AGL-ish names, everything else uniXXXX.
// Alternates append .altN, ligatures join component names with '_'.
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

export function baseGlyphName(cp: number): string {
  const ch = String.fromCodePoint(cp)
  if (/^[A-Za-z]$/.test(ch)) return ch
  if (/^[0-9]$/.test(ch)) return DIGITS[cp - 48]
  if (cp === 32) return 'space'
  return 'uni' + cp.toString(16).toUpperCase().padStart(4, '0')
}

/** Slot id ('a', 'a.alt1', 'f_f', 'mark.acute') → glyph name. */
export function slotGlyphName(slotId: string): string {
  const alt = /^(.+)\.(alt\d+)$/u.exec(slotId)
  if (alt) return `${slotGlyphName(alt[1])}.${alt[2]}`
  if (slotId.startsWith('mark.')) return slotId
  if ([...slotId].length === 1) return baseGlyphName(slotId.codePointAt(0)!)
  if (slotId.includes('_')) return slotId.split('_').map(slotGlyphName).join('_')
  return slotId
}

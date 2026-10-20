// Sample sentences for the live preview, plus "auto": the sentence that best
// uses what has been drawn so far.

export const PRESETS: { label: string; text: string }[] = [
  { label: 'Pangram', text: 'The quick brown fox jumps over the lazy dog.' },
  { label: 'Alternates', text: 'hello lilly, look at all the little apples' },
  { label: 'Numbers', text: 'Call 0123-456 789 at 10:45, or pay $3.50 (20% off)!' },
]

export const AUTO_SENTENCES: string[] = [
  'Hello! This is my handwriting.',
  'The quick brown fox jumps over the lazy dog.',
  'Pack my box with five dozen liquor jugs.',
  'Sphinx of black quartz, judge my vow.',
  'hello lilly, look at all the little apples',
  'a cat ate a hat',
  'the cat sat on the mat',
  'hello there',
  'hi, hello!',
  'one, two, three',
  'I like to write.',
  'Is it real? It is!',
  'Dear Ada, see you soon.',
  'Thanks a lot!',
  'Write it down.',
  'notes and ideas',
  'tea at ten',
  'a little letter',
  'Good morning, sunshine!',
  'Meet me at noon.',
  'Have a nice day!',
  'Call me at 5.',
  'Room 101, floor 3.',
]

const letters = (s: string) => [...s].filter(c => c.trim())

/** Share of a sentence's non-space characters that have glyphs. */
export function coverage(text: string, has: (ch: string) => boolean): number {
  const chars = letters(text)
  if (!chars.length) return 0
  return chars.filter(has).length / chars.length
}

export function pickAuto(has: (ch: string) => boolean): string {
  let best = AUTO_SENTENCES[0]
  let bestScore = -1
  for (const s of AUTO_SENTENCES) {
    const distinct = new Set(letters(s).filter(has)).size
    // Coverage first, then variety of drawn letters shown.
    const score = coverage(s, has) * 1000 + distinct
    if (score > bestScore) {
      best = s
      bestScore = score
    }
  }
  return bestScore < 1 ? AUTO_SENTENCES[0] : best
}

export type Segment = { text: string; missing: false } | { text: string; missing: true }

/** Split into runs of available text and single missing characters. Present
 *  runs stay one text node so calt/liga can shape across them. */
export function segment(text: string, has: (ch: string) => boolean): Segment[] {
  const out: Segment[] = []
  for (const ch of text) {
    const ok = !ch.trim() || has(ch)
    const last = out[out.length - 1]
    if (ok && last && !last.missing) last.text += ch
    else out.push(ok ? { text: ch, missing: false } : { text: ch, missing: true })
  }
  return out
}

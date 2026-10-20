import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as hb from 'harfbuzzjs'
import type { SlotInput } from '../src/lib/font/assemble'

export function loadStrokeFixture(name: string): SlotInput[] {
  const path = fileURLToPath(new URL(`./fixtures/strokes/${name}.json`, import.meta.url))
  const json = JSON.parse(readFileSync(path, 'utf8'))
  return Object.entries(json.slots as Record<string, { strokes: SlotInput['strokes'] }>).map(([id, s]) => ({ id, strokes: s.strokes }))
}

function run(font: ArrayBuffer, text: string, features: string) {
  const blob = new hb.Blob(font)
  const face = new hb.Face(blob)
  const hbFont = new hb.Font(face)
  const buffer = new hb.Buffer()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  const feats = features ? features.split(',').map(f => hb.Feature.fromString(f.trim())!).filter(Boolean) : undefined
  hb.shape(hbFont, buffer, feats)
  return { hbFont, buffer }
}

/** Shape text with HarfBuzz; returns glyph names. */
export function shape(font: ArrayBuffer, text: string, features = ''): string[] {
  const { hbFont, buffer } = run(font, text, features)
  return buffer.getGlyphInfos().map(g => hbFont.glyphName(g.codepoint))
}

/** Shape text with HarfBuzz; returns glyph positions. */
export function shapePositions(font: ArrayBuffer, text: string, features = '') {
  return run(font, text, features).buffer.getGlyphPositions()
}

/// <reference lib="webworker" />
// Font builds run here so drawing never stalls. One cache per worker, keyed by
// slot id + rev + pen + engine, so only changed glyphs are re-outlined.
import { ENGINES } from '../engines'
import type { Contour } from '../engines/types'
import { assembleFont, outlineSlot } from '../font/assemble'
import type { BuildRequest, BuildResponse } from './protocol'

const cache = new Map<string, Contour[]>()

self.onmessage = (e: MessageEvent<BuildRequest>) => {
  const req = e.data
  const t0 = performance.now()
  try {
    const input = { family: req.family, metrics: req.metrics, pen: req.pen, engine: ENGINES[req.engine], slots: req.slots, cache }
    if (req.fresh || cache.size > 4000) cache.clear()
    const drawn = req.slots.filter(s => s.strokes.length)
    const font = drawn.length ? assembleFont(input) : null
    const outlines: Record<string, Contour[]> = {}
    for (const id of req.outlinesFor ?? []) {
      const slot = req.slots.find(s => s.id === id)
      if (slot?.strokes.length) outlines[id] = outlineSlot(input, slot).contours
    }
    const res: BuildResponse = {
      id: req.id,
      ok: true,
      buffer: font?.buffer ?? null,
      glyphIds: font ? Object.fromEntries(font.glyphIds) : {},
      stats: font?.stats ?? [],
      outlineMs: font?.outlineMs ?? 0,
      totalMs: performance.now() - t0,
      glyphCount: font?.glyphCount ?? 0,
      outlines,
    }
    ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(res, res.buffer ? [res.buffer] : [])
  } catch (err) {
    const res: BuildResponse = { id: req.id, ok: false, error: err instanceof Error ? `${err.message}\n${err.stack}` : String(err) }
    self.postMessage(res)
  }
}

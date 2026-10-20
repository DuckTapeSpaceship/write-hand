import type { Contour, EngineId } from '../engines/types'
import type { GlyphStat, SlotInput } from '../font/assemble'
import type { Metrics } from '../model/metrics'
import type { Pen } from '../model/project'

export interface BuildRequest {
  id: number
  family: string
  metrics: Metrics
  pen: Pen
  engine: EngineId
  slots: SlotInput[]
  /** Slot ids whose raw (unspaced) outlines should be returned, e.g. for the lab. */
  outlinesFor?: string[]
  /** Drop the outline cache first (for honest timings). */
  fresh?: boolean
}

export type BuildResponse =
  | {
      id: number
      ok: true
      buffer: ArrayBuffer | null
      glyphIds: Record<string, number>
      stats: GlyphStat[]
      outlineMs: number
      totalMs: number
      glyphCount: number
      outlines: Record<string, Contour[]>
    }
  | { id: number; ok: false; error: string }

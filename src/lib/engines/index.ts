// Gate 1 picked engine B (vector). Engines A (fontify's raster trace) and A'
// live in git history at the v2 P0 commit.
import type { EngineId, OutlineEngine } from './types'
import { engineB } from './vector'

export const ENGINES: Record<EngineId, OutlineEngine> = { B: engineB }
export const ENGINE_IDS: EngineId[] = ['B']
export const DEFAULT_ENGINE = engineB
export type { Contour, EngineId, OutlineEngine, PathCmd } from './types'

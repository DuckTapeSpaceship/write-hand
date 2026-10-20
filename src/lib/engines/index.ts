import { engineA, engineA2 } from './trace'
import type { EngineId, OutlineEngine } from './types'
import { engineB } from './vector'

export const ENGINES: Record<EngineId, OutlineEngine> = { A: engineA, A2: engineA2, B: engineB }
export const ENGINE_IDS: EngineId[] = ['A', 'A2', 'B']
export type { Contour, EngineId, OutlineEngine, PathCmd } from './types'

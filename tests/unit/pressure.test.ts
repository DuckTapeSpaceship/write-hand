import { describe, expect, it } from 'vitest'
import { applySyntheticPressure, hasRealPressure, strokeInput, SYNTHETIC_CURVES, syntheticPressure } from '../../src/lib/engines/pressure'
import type { Stroke } from '../../src/lib/model/project'

const line: Stroke = { pts: Array.from({ length: 20 }, (_, i) => [i * 10, 0, 0.5, i * 8]).flat(), pointer: 'mouse' }

describe('synthetic pressure', () => {
  it('stays in range and is deterministic', () => {
    for (const c of SYNTHETIC_CURVES) {
      for (let u = 0; u <= 1; u += 0.05) {
        const p = syntheticPressure(c, u)
        expect(p).toBeGreaterThanOrEqual(0.15)
        expect(p).toBeLessThanOrEqual(0.95)
        expect(syntheticPressure(c, u)).toBe(p)
      }
    }
  })

  it('taper starts and ends thin, peaks in the middle', () => {
    expect(syntheticPressure('taper', 0)).toBeCloseTo(0.15)
    expect(syntheticPressure('taper', 1)).toBeCloseTo(0.15)
    expect(syntheticPressure('taper', 0.5)).toBeCloseTo(0.95)
  })

  it('bakes the curve into a pen stroke that reads as real pressure', () => {
    const s = applySyntheticPressure(line, 'ramp')
    expect(s.pointer).toBe('pen')
    expect(s.pts[2]).toBeCloseTo(0.15)
    expect(s.pts[s.pts.length - 2]).toBeCloseTo(0.95)
    expect(hasRealPressure(s)).toBe(true)
    expect(hasRealPressure(line)).toBe(false)
    expect(strokeInput(s, 'auto').simulate).toBe(false)
    expect(strokeInput(line, 'auto').simulate).toBe(true)
    expect(strokeInput(line, 'none').simulate).toBe(false)
  })
})

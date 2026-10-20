import { describe, expect, it } from 'vitest'
import { fitClosedPolygon } from '../../src/lib/geom/fit'
import { unionPolygons } from '../../src/lib/geom/union'
import { fixWinding, signedArea } from '../../src/lib/geom/winding'
import { contourBounds } from '../../src/lib/font/spacing'
import type { Contour } from '../../src/lib/engines/types'

const circle = (cx: number, cy: number, r: number, n = 120) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)])

describe('Schneider fit', () => {
  it('fits a circle with a few cubics within tolerance', () => {
    const c = fitClosedPolygon(circle(0, 0, 200), { tolerance: 1, cornerAngle: 55 })
    expect(c.length).toBeLessThan(10)
    const b = contourBounds([c])!
    expect(b.xMax).toBeCloseTo(200, 0)
    expect(b.yMin).toBeCloseTo(-200, 0)
  })

  it('keeps square corners sharp', () => {
    const sq: number[][] = []
    for (let i = 0; i < 10; i++) sq.push([i * 10, 0])
    for (let i = 0; i < 10; i++) sq.push([100, i * 10])
    for (let i = 0; i < 10; i++) sq.push([100 - i * 10, 100])
    for (let i = 0; i < 10; i++) sq.push([0, 100 - i * 10])
    const c = fitClosedPolygon(sq)
    expect(c.filter(cmd => cmd.type === 'L').length).toBe(4)
    const pts = c.map(cmd => [Math.round(cmd.x), Math.round(cmd.y)].join(','))
    for (const corner of ['0,0', '100,0', '100,100', '0,100']) expect(pts).toContain(corner)
  })
})

describe('union + winding', () => {
  it('unions overlapping shapes with outers counter-clockwise', () => {
    const a = circle(0, 0, 100)
    const b = circle(120, 0, 100).reverse() // opposite input winding still unions under nonzero
    const out = unionPolygons([a, b])
    expect(out.length).toBe(1)
  })

  it('orients a ring as outer CCW + hole CW', () => {
    const toC = (p: number[][]): Contour => p.map(([x, y], i) => ({ type: i ? 'L' : 'M', x, y }) as const)
    const outer = toC(circle(0, 0, 200).reverse())
    const hole = toC(circle(0, 0, 100))
    const [o, h] = fixWinding([outer, hole])
    expect(signedArea(o)).toBeGreaterThan(0)
    expect(signedArea(h)).toBeLessThan(0)
  })
})

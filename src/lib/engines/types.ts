import type { CellBox } from '../model/metrics'
import type { Pen, Stroke } from '../model/project'

// Same command shapes as opentype.js Path commands; a contour starts with M and
// is implicitly closed.
export type PathCmd =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }

export type Contour = PathCmd[]

export type EngineId = 'A' | 'A2' | 'B'

export interface OutlineEngine {
  id: EngineId
  label: string
  /** Strokes in font units → closed contours in font units with correct winding
   *  (outer counter-clockwise, holes clockwise, y up). */
  outline(strokes: Stroke[], pen: Pen, cell: CellBox): Contour[]
}

export function contourStats(contours: Contour[]): { contours: number; nodes: number; points: number } {
  let nodes = 0
  let points = 0
  for (const c of contours) {
    for (const cmd of c) {
      nodes++
      points += cmd.type === 'C' ? 3 : cmd.type === 'Q' ? 2 : 1
    }
  }
  return { contours: contours.length, nodes, points }
}

export function contoursToSvgPath(contours: Contour[], f = (n: number) => +n.toFixed(1)): string {
  let d = ''
  for (const c of contours) {
    for (const cmd of c) {
      switch (cmd.type) {
        case 'M': d += `M${f(cmd.x)} ${f(cmd.y)}`; break
        case 'L': d += `L${f(cmd.x)} ${f(cmd.y)}`; break
        case 'Q': d += `Q${f(cmd.x1)} ${f(cmd.y1)} ${f(cmd.x)} ${f(cmd.y)}`; break
        case 'C': d += `C${f(cmd.x1)} ${f(cmd.y1)} ${f(cmd.x2)} ${f(cmd.y2)} ${f(cmd.x)} ${f(cmd.y)}`; break
      }
    }
    if (c.length) d += 'Z'
  }
  return d
}

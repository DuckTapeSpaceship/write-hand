// Cubic Bézier fitting of closed polygons: Philip J. Schneider, "An Algorithm
// for Automatically Fitting Digitized Curves", Graphics Gems (1990). Closed
// outlines are first split at sharp corners (where stroke unions meet) so each
// run is fitted smoothly and corners stay crisp.
import type { Contour } from '../engines/types'

type V = [number, number]

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]]
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1]
const len = (a: V) => Math.hypot(a[0], a[1])
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1])
function norm(a: V): V {
  const l = len(a)
  return l ? [a[0] / l, a[1] / l] : [0, 0]
}

type Bez = [V, V, V, V]

export interface FitOptions {
  /** Max deviation in font units. */
  tolerance: number
  /** Turn angle (degrees) above which a vertex is kept as a corner. */
  cornerAngle: number
}

export const DEFAULT_FIT: FitOptions = { tolerance: 2.5, cornerAngle: 55 }

export function fitClosedPolygon(poly: number[][], opts: FitOptions = DEFAULT_FIT): Contour {
  const pts = dedupe(poly as V[])
  if (pts.length < 3) return []
  if (pts.length < 4) return linesContour(pts)

  const corners = findCorners(pts, opts.cornerAngle)
  const err = opts.tolerance * opts.tolerance
  const beziers: Bez[] = []

  if (!corners.length) {
    // Smooth loop: start anywhere, keep G1 continuity across the seam.
    const run = [...pts, pts[0]]
    const t = norm(sub(pts[1], pts[pts.length - 1]))
    fitCubic(run, 0, run.length - 1, t, mul(t, -1), err, beziers)
  } else {
    const n = pts.length
    for (let k = 0; k < corners.length; k++) {
      const a = corners[k]
      const b = k + 1 < corners.length ? corners[k + 1] : corners[0] + n
      const run: V[] = []
      for (let i = a; i <= b; i++) run.push(pts[i % n])
      if (run.length === 2) {
        beziers.push(lineBez(run[0], run[1]))
        continue
      }
      const t1 = endTangent(run, false)
      const t2 = endTangent(run, true)
      fitCubic(run, 0, run.length - 1, t1, t2, err, beziers)
    }
  }

  const c: Contour = [{ type: 'M', x: beziers[0][0][0], y: beziers[0][0][1] }]
  for (const b of beziers) {
    if (isLine(b)) c.push({ type: 'L', x: b[3][0], y: b[3][1] })
    else c.push({ type: 'C', x1: b[1][0], y1: b[1][1], x2: b[2][0], y2: b[2][1], x: b[3][0], y: b[3][1] })
  }
  return c
}

function linesContour(pts: V[]): Contour {
  const c: Contour = [{ type: 'M', x: pts[0][0], y: pts[0][1] }]
  for (let i = 1; i < pts.length; i++) c.push({ type: 'L', x: pts[i][0], y: pts[i][1] })
  return c
}

function dedupe(poly: V[]): V[] {
  const out: V[] = []
  for (const p of poly) {
    if (!out.length || dist(out[out.length - 1], p) > 0.5) out.push([p[0], p[1]])
  }
  while (out.length > 1 && dist(out[0], out[out.length - 1]) <= 0.5) out.pop()
  return out
}

/** Vertices whose turn angle (measured over a small arc window) exceeds the
 *  threshold, with non-maximum suppression along runs of candidates. */
function findCorners(pts: V[], angleDeg: number): number[] {
  const n = pts.length
  const window = 6
  const turn = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const back = walk(pts, i, -1, window)
    const fwd = walk(pts, i, 1, window)
    const a = norm(sub(pts[i], back))
    const b = norm(sub(fwd, pts[i]))
    turn[i] = Math.acos(Math.max(-1, Math.min(1, dot(a, b))))
  }
  const th = (angleDeg * Math.PI) / 180
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (turn[i] < th) continue
    const prev = turn[(i - 1 + n) % n]
    const next = turn[(i + 1) % n]
    if (turn[i] >= prev && turn[i] > next) out.push(i)
  }
  return out
}

function walk(pts: V[], i: number, dir: 1 | -1, minDist: number): V {
  const n = pts.length
  let j = i
  for (let steps = 0; steps < 4; steps++) {
    j = (j + dir + n) % n
    if (dist(pts[j], pts[i]) >= minDist) break
  }
  return pts[j]
}

function endTangent(run: V[], atEnd: boolean): V {
  // Average over a few points so a noisy first segment doesn't skew the curve.
  const m = Math.min(3, run.length - 1)
  if (!atEnd) return norm(sub(run[m], run[0]))
  return norm(sub(run[run.length - 1 - m], run[run.length - 1]))
}

function lineBez(a: V, b: V): Bez {
  return [a, add(a, mul(sub(b, a), 1 / 3)), add(a, mul(sub(b, a), 2 / 3)), b]
}

function isLine(b: Bez): boolean {
  // Control points on the chord at 1/3 and 2/3 → emit a straight segment.
  const l1 = add(b[0], mul(sub(b[3], b[0]), 1 / 3))
  const l2 = add(b[0], mul(sub(b[3], b[0]), 2 / 3))
  return dist(l1, b[1]) < 1e-6 && dist(l2, b[2]) < 1e-6
}

// --- Schneider ---

function fitCubic(d: V[], first: number, last: number, tHat1: V, tHat2: V, error: number, out: Bez[]): void {
  const nPts = last - first + 1
  if (nPts === 2) {
    const dd = dist(d[last], d[first]) / 3
    out.push([d[first], add(d[first], mul(tHat1, dd)), add(d[last], mul(tHat2, dd)), d[last]])
    return
  }

  let u = chordLengthParameterize(d, first, last)
  let bez = generateBezier(d, first, last, u, tHat1, tHat2)
  let [maxError, split] = computeMaxError(d, first, last, bez, u)
  if (maxError < error) {
    out.push(bez)
    return
  }

  if (maxError < error * 4) {
    for (let i = 0; i < 20; i++) {
      const uPrime = reparameterize(d, first, last, u, bez)
      bez = generateBezier(d, first, last, uPrime, tHat1, tHat2)
      ;[maxError, split] = computeMaxError(d, first, last, bez, uPrime)
      if (maxError < error) {
        out.push(bez)
        return
      }
      u = uPrime
    }
  }

  const tHatCenter = norm(sub(d[split - 1], d[split + 1]))
  fitCubic(d, first, split, tHat1, tHatCenter, error, out)
  fitCubic(d, split, last, mul(tHatCenter, -1), tHat2, error, out)
}

function generateBezier(d: V[], first: number, last: number, u: number[], tHat1: V, tHat2: V): Bez {
  const nPts = last - first + 1
  const C = [
    [0, 0],
    [0, 0],
  ]
  const X = [0, 0]
  for (let i = 0; i < nPts; i++) {
    const t = u[i]
    const mt = 1 - t
    const b0 = mt * mt * mt
    const b1 = 3 * t * mt * mt
    const b2 = 3 * t * t * mt
    const b3 = t * t * t
    const A1 = mul(tHat1, b1)
    const A2 = mul(tHat2, b2)
    C[0][0] += dot(A1, A1)
    C[0][1] += dot(A1, A2)
    C[1][1] += dot(A2, A2)
    const tmp = sub(d[first + i], add(mul(d[first], b0 + b1), mul(d[last], b2 + b3)))
    X[0] += dot(A1, tmp)
    X[1] += dot(A2, tmp)
  }
  C[1][0] = C[0][1]

  const detC0C1 = C[0][0] * C[1][1] - C[1][0] * C[0][1]
  const detC0X = C[0][0] * X[1] - C[1][0] * X[0]
  const detXC1 = X[0] * C[1][1] - X[1] * C[0][1]
  let alphaL = detC0C1 === 0 ? 0 : detXC1 / detC0C1
  let alphaR = detC0C1 === 0 ? 0 : detC0X / detC0C1

  const segLength = dist(d[last], d[first])
  const epsilon = 1e-6 * segLength
  if (alphaL < epsilon || alphaR < epsilon || alphaL > segLength * 2 || alphaR > segLength * 2) {
    // Wu/Barsky heuristic fallback.
    alphaL = alphaR = segLength / 3
  }
  return [d[first], add(d[first], mul(tHat1, alphaL)), add(d[last], mul(tHat2, alphaR)), d[last]]
}

function chordLengthParameterize(d: V[], first: number, last: number): number[] {
  const u = [0]
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + dist(d[i], d[i - 1]))
  const total = u[u.length - 1] || 1
  return u.map(x => x / total)
}

function bezierAt(b: V[], t: number): V {
  const deg = b.length - 1
  const tmp = b.map(p => [p[0], p[1]] as V)
  for (let i = 1; i <= deg; i++) {
    for (let j = 0; j <= deg - i; j++) {
      tmp[j] = [(1 - t) * tmp[j][0] + t * tmp[j + 1][0], (1 - t) * tmp[j][1] + t * tmp[j + 1][1]]
    }
  }
  return tmp[0]
}

function computeMaxError(d: V[], first: number, last: number, bez: Bez, u: number[]): [number, number] {
  let maxDist = 0
  let split = Math.floor((last - first + 1) / 2) + first
  for (let i = first + 1; i < last; i++) {
    const p = bezierAt(bez, u[i - first])
    const v = sub(p, d[i])
    const dd = dot(v, v)
    if (dd >= maxDist) {
      maxDist = dd
      split = i
    }
  }
  if (split <= first) split = first + 1
  if (split >= last) split = last - 1
  return [maxDist, split]
}

function reparameterize(d: V[], first: number, last: number, u: number[], bez: Bez): number[] {
  const out: number[] = []
  for (let i = first; i <= last; i++) out.push(newtonRaphson(bez, d[i], u[i - first]))
  return out
}

function newtonRaphson(Q: Bez, P: V, u: number): number {
  const Q_u = bezierAt(Q, u)
  const Q1: V[] = [mul(sub(Q[1], Q[0]), 3), mul(sub(Q[2], Q[1]), 3), mul(sub(Q[3], Q[2]), 3)]
  const Q2: V[] = [mul(sub(Q1[1], Q1[0]), 2), mul(sub(Q1[2], Q1[1]), 2)]
  const Q1_u = bezierAt(Q1, u)
  const Q2_u = bezierAt(Q2, u)
  const numerator = (Q_u[0] - P[0]) * Q1_u[0] + (Q_u[1] - P[1]) * Q1_u[1]
  const denominator = Q1_u[0] * Q1_u[0] + Q1_u[1] * Q1_u[1] + (Q_u[0] - P[0]) * Q2_u[0] + (Q_u[1] - P[1]) * Q2_u[1]
  if (denominator === 0) return u
  const next = u - numerator / denominator
  return Math.min(1, Math.max(0, next))
}

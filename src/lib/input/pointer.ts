// Pointer capture for drawing surfaces. Ported in part from fontify's
// DrawCell.tsx (MIT, github.com/alexkroeker177/fontify): pointer capture and
// the minimum-distance point filter. Added: coalesced events (full pen rate),
// pressure, timestamps and the pointer kind.
import type { PointerKind, Stroke } from '../model/project'

/** Minimum spacing between recorded points, in font units. fontify used 1.2
 *  of its 160-unit cell ≈ 7.5 units; slightly denser here for pressure. */
export const MIN_POINT_DIST = 6

export function pointerKind(e: PointerEvent): PointerKind {
  return e.pointerType === 'pen' ? 'pen' : e.pointerType === 'touch' ? 'touch' : 'mouse'
}

export function coalesced(e: PointerEvent): PointerEvent[] {
  if (typeof e.getCoalescedEvents === 'function') {
    const list = e.getCoalescedEvents()
    if (list.length) return list
  }
  return [e]
}

export type ToFont = (clientX: number, clientY: number) => [number, number]

export class StrokeBuilder {
  readonly pts: number[] = []
  private t0: number
  constructor(
    readonly pointer: PointerKind,
    private toFont: ToFont,
    startTime: number,
  ) {
    this.t0 = startTime
  }

  /** Adds the event's coalesced samples; returns true if any point was kept. */
  add(e: PointerEvent, force = false): boolean {
    let added = false
    for (const ev of coalesced(e)) {
      const [x, y] = this.toFont(ev.clientX, ev.clientY)
      const n = this.pts.length
      if (!force && n && Math.hypot(x - this.pts[n - 4], y - this.pts[n - 3]) < MIN_POINT_DIST) continue
      const p = ev.pressure || (this.pointer === 'mouse' ? 0.5 : 0)
      this.pts.push(round1(x), round1(y), Math.round(p * 1000) / 1000, Math.round(ev.timeStamp - this.t0))
      added = true
    }
    return added
  }

  get length(): number {
    return this.pts.length / 4
  }

  finish(): Stroke {
    return { pts: this.pts.slice(), pointer: this.pointer }
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

// Long-press vs tap: hold LONG_PRESS_MS with less than LONG_PRESS_SLOP px of
// movement and no lift → long press (opens the cell menu, discards the dot).
// A normal tap is far shorter, so the dots on i, j, '.' and '!' still draw.
export const LONG_PRESS_MS = 550
export const LONG_PRESS_SLOP = 6

export type PressKind = 'tap' | 'long' | 'drag'

export function classifyPress(heldMs: number, maxMovePx: number, lifted: boolean): PressKind {
  if (maxMovePx >= LONG_PRESS_SLOP) return 'drag'
  if (heldMs >= LONG_PRESS_MS && !lifted) return 'long'
  return lifted ? 'tap' : 'drag'
}

/** Timer-driven tracker: fire() runs once the press qualifies as long. */
export class LongPressTracker {
  private timer: ReturnType<typeof setTimeout> | null = null
  private x0 = 0
  private y0 = 0
  private t0 = 0
  maxMove = 0
  fired = false

  constructor(
    private fire: () => void,
    private ms = LONG_PRESS_MS,
  ) {}

  start(x: number, y: number, now = performance.now()): void {
    this.cancel()
    this.x0 = x
    this.y0 = y
    this.t0 = now
    this.maxMove = 0
    this.fired = false
    this.timer = setTimeout(() => {
      this.timer = null
      if (classifyPress(this.ms, this.maxMove, false) === 'long') {
        this.fired = true
        this.fire()
      }
    }, this.ms)
  }

  move(x: number, y: number): void {
    this.maxMove = Math.max(this.maxMove, Math.hypot(x - this.x0, y - this.y0))
    if (this.maxMove >= LONG_PRESS_SLOP) this.cancel()
  }

  /** Pen/finger lifted: returns how the press classifies. */
  end(now = performance.now()): PressKind {
    this.cancel()
    return this.fired ? 'long' : classifyPress(now - this.t0, this.maxMove, true)
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}

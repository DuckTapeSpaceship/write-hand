// Input rule: which pointer draws in the grid, and what a finger does.
//  - mouse / trackpad: draws directly in grid cells
//  - pen: draws in grid cells; once one is seen, fingers scroll and tap to
//    open the write view (palm rejection) unless finger drawing is turned on
//  - finger only, phone: tap opens the write view, swipes scroll
//  - finger only, tablet: draws in grid cells (setting can switch to write view)

export type TouchPolicy = 'draw' | 'tap'
export type FingerPref = 'auto' | 'draw' | 'view'

const PEN_KEY = 'wh-pen-seen'
const FINGER_KEY = 'wh-finger'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, v: string): void {
  try {
    localStorage.setItem(key, v)
  } catch {
    // per-device convenience only
  }
}

export function touchPolicyFor(opts: { penSeen: boolean; phone: boolean; finger: FingerPref }): TouchPolicy {
  if (opts.finger === 'draw') return 'draw'
  if (opts.finger === 'view') return 'tap'
  if (opts.penSeen) return 'tap'
  return opts.phone ? 'tap' : 'draw'
}

class InputMode {
  penSeen = $state(read(PEN_KEY) === '1')
  finger = $state<FingerPref>((read(FINGER_KEY) as FingerPref) || 'auto')
  phone = $state(false)

  constructor() {
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(max-width: 599px)')
      this.phone = mq.matches
      mq.addEventListener('change', e => (this.phone = e.matches))
    }
  }

  get touch(): TouchPolicy {
    return touchPolicyFor({ penSeen: this.penSeen, phone: this.phone, finger: this.finger })
  }

  markPen(): void {
    if (this.penSeen) return
    this.penSeen = true
    write(PEN_KEY, '1')
  }

  setFinger(f: FingerPref): void {
    this.finger = f
    write(FINGER_KEY, f)
  }
}

export const inputMode = new InputMode()

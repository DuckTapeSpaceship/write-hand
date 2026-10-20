// Browser storage can be wiped (Safari evicts tabs after 7 days unvisited,
// "clear site data" removes everything), so nudge toward a project export
// every 40 strokes since the last one.
import { project } from '../store/project.svelte'

const KEY = 'wh-backup'
const EVERY = 40

function read(): { exported: number; snooze: number } {
  try {
    return { exported: 0, snooze: 0, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { exported: 0, snooze: 0 }
  }
}

class Backup {
  private state = $state(read())

  get total(): number {
    let n = 0
    for (const s of Object.values(project.slots)) n += s.strokes.length
    return n
  }

  get due(): boolean {
    const t = this.total
    return t >= EVERY && t - this.state.exported >= EVERY && t >= this.state.snooze
  }

  markExported(): void {
    this.save({ exported: this.total, snooze: 0 })
  }

  snooze(): void {
    this.save({ ...this.state, snooze: this.total + EVERY })
  }

  private save(s: { exported: number; snooze: number }) {
    this.state = s
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // per-device convenience only
    }
  }
}

export const backup = new Backup()

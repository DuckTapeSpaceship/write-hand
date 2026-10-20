// Build-worker client: debounced, latest-wins. A request superseded before the
// worker answers resolves to null, so stale fonts are never applied.
import type { BuildRequest, BuildResponse } from './protocol'

export type BuildResult = Extract<BuildResponse, { ok: true }>

export class BuildClient {
  private worker: Worker
  private seq = 0
  private pending = new Map<number, (r: BuildResponse) => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private latest = 0
  private queued: ((r: null) => void) | null = null

  constructor(private debounceMs = 350) {
    this.worker = new Worker(new URL('./build.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<BuildResponse>) => {
      const done = this.pending.get(e.data.id)
      this.pending.delete(e.data.id)
      done?.(e.data)
    }
  }

  /** Debounced build; resolves null when superseded by a newer call. */
  request(req: Omit<BuildRequest, 'id'>, immediate = false): Promise<BuildResult | null> {
    const id = ++this.seq
    this.latest = id
    if (this.timer) clearTimeout(this.timer)
    this.queued?.(null) // the debounced call this one replaces never runs
    return new Promise((resolve, reject) => {
      this.queued = resolve
      const send = () => {
        this.queued = null
        if (id !== this.latest) return resolve(null)
        this.pending.set(id, res => {
          if (id !== this.latest) return resolve(null)
          if (res.ok) resolve(res)
          else reject(new Error(res.error))
        })
        this.worker.postMessage({ ...req, id } satisfies BuildRequest)
      }
      if (immediate) send()
      else this.timer = setTimeout(send, this.debounceMs)
    })
  }

  terminate(): void {
    this.worker.terminate()
  }
}

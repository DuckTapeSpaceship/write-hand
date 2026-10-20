// The preview loop (fontify's mechanism, moved off the main thread): on any
// stroke or pen change, debounce, build the full OTF in the worker, then swap
// it into document.fonts as 'WH Preview'.
import { project } from '../store/project.svelte'
import { BuildClient } from '../worker/client'
import { FaceSwapper } from './fontface'

export const PREVIEW_FAMILY = 'WH Preview'

class LivePreview {
  /** Bumps each time a new face is live (use with {#key}). */
  gen = $state(0)
  ready = $state(false)
  building = $state(false)
  error = $state<string | null>(null)
  lastMs = $state(0)
  private client: BuildClient | null = null
  private face = new FaceSwapper(PREVIEW_FAMILY)

  private request(family: string, immediate: boolean) {
    this.client ??= new BuildClient(350)
    return this.client.request(
      {
        family,
        metrics: project.metrics,
        pen: project.pen,
        engine: 'B',
        slots: Object.values(project.slots).map(s => ({ id: s.id, strokes: s.strokes, rev: s.rev })),
      },
      immediate,
    )
  }

  start(): () => void {
    return $effect.root(() => {
      $effect(() => {
        void [project.slots, project.pen, project.metrics]
        this.building = true
        this.request(PREVIEW_FAMILY, false)
          .then(async res => {
            if (!res) return
            this.lastMs = res.totalMs
            this.error = null
            if (await this.face.swap(res.buffer)) {
              this.ready = !!res.buffer
              this.gen++
            }
            this.building = false
          })
          .catch(err => {
            this.building = false
            this.error = err instanceof Error ? err.message : String(err)
          })
      })
      return () => {
        this.client?.terminate()
        this.client = null
        this.face.clear()
      }
    })
  }

  /** A font named after the project, for download. Uses a separate worker so
   *  it never supersedes (or is superseded by) a preview build. */
  async buildFont(): Promise<ArrayBuffer> {
    const client = new BuildClient(0)
    try {
      const res = await client.request(
        {
          family: project.name,
          metrics: project.metrics,
          pen: project.pen,
          engine: 'B',
          slots: Object.values(project.slots).map(s => ({ id: s.id, strokes: s.strokes, rev: s.rev })),
        },
        true,
      )
      if (!res?.buffer) throw new Error('Nothing drawn yet')
      return res.buffer
    } finally {
      client.terminate()
    }
  }
}

export const live = new LivePreview()

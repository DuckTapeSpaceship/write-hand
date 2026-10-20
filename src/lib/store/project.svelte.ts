// The one project the app edits. Slots are replaced immutably ($state.raw) so
// stroke arrays stay plain data: cheap to diff by identity, to clone into the
// build worker, and to save to IndexedDB.
import type { Metrics } from '../model/metrics'
import type { Pen, Project, Slot, Stroke } from '../model/project'
import { composable } from '../font/compose'
import { SLOT_BY_ID } from '../model/charset'
import { idbGet, idbSet } from './idb'
import { migrate, newProject } from './migrate'
import { requestPersistence } from './persist'

const KEY = 'project'
// IndexedDB writes started during unload may never land, so the latest state
// is also written synchronously to localStorage on pagehide and reconciled by
// timestamp on the next load.
const PENDING = 'wh-pending-project'

type Saved = Project & { savedAt?: number }

function readPending(): Saved | null {
  try {
    const raw = localStorage.getItem(PENDING)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

class ProjectStore {
  name = $state('')
  metrics = $state.raw<Metrics>(newProject().metrics)
  pen = $state.raw<Pen>(newProject().pen)
  slots = $state.raw<Record<string, Slot>>({})
  sample = $state('')
  loaded = $state(false)
  saveError = $state<string | null>(null)

  constructor() {
    this.apply(newProject())
  }

  apply(p: Project): void {
    this.name = p.name
    this.metrics = p.metrics
    this.pen = p.pen
    this.slots = p.slots
    this.sample = p.sample
  }

  snapshot(): Project {
    return { schema: 2, name: this.name, metrics: this.metrics, pen: this.pen, slots: this.slots, sample: this.sample }
  }

  has(id: string): boolean {
    return (this.slots[id]?.strokes.length ?? 0) > 0
  }

  strokes(id: string): Stroke[] {
    return this.slots[id]?.strokes ?? []
  }

  setStrokes(id: string, strokes: Stroke[]): void {
    const prev = this.slots[id]
    const def = SLOT_BY_ID.get(id)
    const next = { ...this.slots }
    if (strokes.length) {
      next[id] = { id, kind: prev?.kind ?? def?.kind ?? 'base', unicode: prev?.unicode ?? def?.unicode, strokes, rev: (prev?.rev ?? 0) + 1 }
    } else {
      delete next[id]
    }
    this.slots = next
  }

  addStroke(id: string, s: Stroke): void {
    this.setStrokes(id, [...this.strokes(id), s])
    void requestPersistence()
  }

  /** Removes the last stroke; returns false when there was nothing to undo. */
  undoStroke(id: string): boolean {
    const st = this.strokes(id)
    if (!st.length) return false
    this.setStrokes(id, st.slice(0, -1))
    return true
  }

  /** Clears a slot and returns its strokes so the caller can offer Undo. */
  clear(id: string): Stroke[] {
    const st = this.strokes(id)
    if (st.length) this.setStrokes(id, [])
    return st
  }

  async load(): Promise<void> {
    let stored: Saved | undefined
    try {
      stored = await idbGet<Saved>(KEY)
    } catch (err) {
      console.warn('Could not read IndexedDB', err)
    }
    const pending = readPending()
    const pick = pending && (!stored || (pending.savedAt ?? 0) > (stored.savedAt ?? 0)) ? pending : stored
    try {
      if (pick) this.apply(migrate(pick))
    } catch (err) {
      console.warn('Could not load the saved project', err)
    }
    this.loaded = true
    if (pick === pending && pending) void this.save()
  }

  async save(): Promise<void> {
    try {
      await idbSet(KEY, { ...this.snapshot(), savedAt: Date.now() } satisfies Saved)
      this.saveError = null
      try {
        localStorage.removeItem(PENDING)
      } catch {
        // nothing to clean up
      }
    } catch (err) {
      this.saveError = err instanceof Error ? err.message : String(err)
    }
  }

  /** Synchronous last-chance copy for unload. Large projects may not fit. */
  savePending(): void {
    try {
      localStorage.setItem(PENDING, JSON.stringify({ ...this.snapshot(), savedAt: Date.now() }))
    } catch {
      // over quota: IndexedDB still has everything up to the last debounce
    }
  }

  /** Debounced autosave; call once from a component. */
  autosave(delay = 400): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null
    return $effect.root(() => {
      $effect(() => {
        void [this.name, this.metrics, this.pen, this.slots, this.sample]
        if (!this.loaded) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          void this.save()
        }, delay)
      })
      const flush = () => {
        if (!timer) return
        clearTimeout(timer)
        timer = null
        this.savePending()
        void this.save()
      }
      addEventListener('pagehide', flush)
      return () => removeEventListener('pagehide', flush)
    })
  }
}

export const project = new ProjectStore()

/** A character renders in the preview if drawn directly or composable. */
export function hasGlyph(ch: string): boolean {
  return project.has(ch) || composable(ch, id => project.has(id))
}

import { SLOT_BY_ID } from '../model/charset'
import { project } from '../store/project.svelte'
import { toasts } from './toast.svelte'

/** Clear a cell, with a 5 s Undo toast since a stray tap could wipe a glyph. */
export function clearWithUndo(id: string): void {
  const prev = project.clear(id)
  if (!prev.length) return
  const label = SLOT_BY_ID.get(id)?.label ?? id
  toasts.show(`Cleared “${label}”`, {
    label: 'Undo',
    run: () => {
      if (!project.has(id)) project.setStrokes(id, prev)
    },
  })
}

export function cellDomId(id: string): string {
  return 'cell-' + [...id].map(c => c.codePointAt(0)!.toString(16)).join('-')
}

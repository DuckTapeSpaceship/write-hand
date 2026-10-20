// A finger on a grid cell draws, so the page scrolls with two fingers. The
// browser won't pan a gesture that started on a `touch-action: none` canvas,
// so touches are tracked window-wide (the second finger may land on a gap or
// a neighbouring cell) and the page is scrolled by hand. Surfaces drop their
// in-progress stroke when the second finger lands.
const fingers = new Map<number, number>() // pointerId → last clientY
const listeners = new Set<() => void>()
let armed = false
let panning = false

function down(e: PointerEvent) {
  if (e.pointerType !== 'touch') return
  fingers.set(e.pointerId, e.clientY)
  if (armed && fingers.size >= 2 && !panning) {
    panning = true
    for (const fn of listeners) fn()
  }
}

function move(e: PointerEvent) {
  const y = fingers.get(e.pointerId)
  if (y === undefined) return
  fingers.set(e.pointerId, e.clientY)
  if (panning) scrollBy(0, (y - e.clientY) / fingers.size)
}

function up(e: PointerEvent) {
  if (!fingers.delete(e.pointerId) || fingers.size) return
  armed = false
  panning = false
}

let installed = false

/** Subscribe a drawing surface; `cancel` runs when a two-finger scroll starts. */
export function onTwoFingerScroll(cancel: () => void): () => void {
  if (!installed) {
    installed = true
    addEventListener('pointerdown', down, true)
    addEventListener('pointermove', move, true)
    addEventListener('pointerup', up, true)
    addEventListener('pointercancel', up, true)
  }
  listeners.add(cancel)
  return () => listeners.delete(cancel)
}

/** Called by a surface when a finger starts drawing on it. */
export function armTwoFingerScroll(): void {
  armed = true
}

export function twoFingerScrolling(): boolean {
  return panning
}

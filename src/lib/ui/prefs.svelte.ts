// Per-device view preferences (not part of the project).
export type CellSize = 's' | 'm' | 'l'
const KEY = 'wh-cell-size'

function read(): CellSize {
  try {
    const v = localStorage.getItem(KEY)
    return v === 's' || v === 'l' ? v : 'm'
  } catch {
    return 'm'
  }
}

class Prefs {
  cellSize = $state<CellSize>(read())

  setCellSize(v: CellSize): void {
    this.cellSize = v
    document.documentElement.dataset.cells = v
    try {
      localStorage.setItem(KEY, v)
    } catch {
      // per-device convenience only
    }
  }

  apply(): void {
    document.documentElement.dataset.cells = this.cellSize
  }
}

export const prefs = new Prefs()

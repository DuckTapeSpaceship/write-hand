// Per-device view preferences (not part of the project).
export type CellSize = 's' | 'm' | 'l'
export type Theme = 'light' | 'dark'
const KEY = 'wh-cell-size'
const THEME_KEY = 'wh-theme' // also read before first paint by public/theme.js
const THEME_COLOR: Record<Theme, string> = { light: '#c0caf5', dark: '#1e1f29' }

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

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
  theme = $state<Theme>(readTheme())

  setCellSize(v: CellSize): void {
    this.cellSize = v
    document.documentElement.dataset.cells = v
    try {
      localStorage.setItem(KEY, v)
    } catch {
      // per-device convenience only
    }
  }

  setTheme(t: Theme): void {
    this.theme = t
    this.applyTheme()
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      // per-device convenience only
    }
  }

  private applyTheme(): void {
    if (this.theme === 'dark') document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[this.theme])
  }

  apply(): void {
    document.documentElement.dataset.cells = this.cellSize
    this.applyTheme()
  }
}

export const prefs = new Prefs()

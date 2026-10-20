// Per-device view preferences (not part of the project).
export type CellSize = 's' | 'm' | 'l'
export type Theme = 'light' | 'dark' | 'auto'
const KEY = 'wh-cell-size'
const THEME_KEY = 'wh-theme' // also read before first paint by public/theme.js
const THEME_COLOR: Record<'light' | 'dark', string> = { light: '#c0caf5', dark: '#1e1f29' }

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'dark' || t === 'auto' ? t : 'light'
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

  /** Light → dark → auto (follow the system). */
  cycleTheme(): void {
    this.setTheme(this.theme === 'light' ? 'dark' : this.theme === 'dark' ? 'auto' : 'light')
  }

  private applyTheme(): void {
    if (this.theme === 'light') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = this.theme
    const dark = this.theme === 'dark' || (this.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[dark ? 'dark' : 'light'])
  }

  apply(): () => void {
    document.documentElement.dataset.cells = this.cellSize
    this.applyTheme()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => this.applyTheme()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }
}

export const prefs = new Prefs()

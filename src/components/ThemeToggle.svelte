<script lang="ts">
  type Theme = 'auto' | 'dark' | 'light'
  const KEY = 'wh-theme'
  const read = (): Theme => {
    try {
      return (localStorage.getItem(KEY) as Theme) || 'auto'
    } catch {
      return 'auto'
    }
  }
  let theme = $state<Theme>(read())

  $effect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // per-device convenience only
    }
  })

  const next: Record<Theme, Theme> = { auto: 'dark', dark: 'light', light: 'auto' }
  const icon: Record<Theme, string> = { auto: '◐', dark: '☾', light: '☀' }
</script>

<button class="btn" onclick={() => (theme = next[theme])} title="Theme: {theme}" aria-label="Theme: {theme}. Switch theme">
  <span aria-hidden="true">{icon[theme]}</span>
</button>

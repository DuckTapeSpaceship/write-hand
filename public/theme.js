// Applies the saved theme before first paint (kept out of index.html so the
// Content-Security-Policy can forbid inline scripts).
try {
  var t = localStorage.getItem('wh-theme')
  if (t === 'dark' || t === 'auto') {
    document.documentElement.dataset.theme = t
    if (t === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches)
      document.querySelector('meta[name="theme-color"]').content = '#1e1f29'
  }
} catch (e) {}

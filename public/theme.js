// Applies the saved theme before first paint (kept out of index.html so the
// Content-Security-Policy can forbid inline scripts).
try {
  var t = localStorage.getItem('wh-theme')
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
} catch (e) {}

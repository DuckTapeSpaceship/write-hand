<script lang="ts">
  // Fonts out (OTF for installing, WOFF2 for the web), project files in and
  // out, and how to install the font on each OS.
  import { toWoff2 } from '../lib/font/woff2'
  import { REQUIRED_IDS } from '../lib/model/charset'
  import { live } from '../lib/preview/live.svelte'
  import { downloadBlob, parseProjectFile, projectFileText, slugify } from '../lib/store/file'
  import { project } from '../lib/store/project.svelte'
  import { backup } from '../lib/ui/backup.svelte'
  import { install } from '../lib/ui/pwa.svelte'
  import { toasts } from '../lib/ui/toast.svelte'

  let { onclose }: { onclose: () => void } = $props()

  let dialog: HTMLDialogElement
  let busy = $state<'otf' | 'woff2' | null>(null)
  let os = $state(guessOs())
  const requiredLeft = $derived(REQUIRED_IDS.filter(id => !project.has(id)).length)
  const slug = $derived(slugify(project.name))

  $effect(() => {
    dialog.showModal()
    return () => dialog.close()
  })

  function guessOs(): string {
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
    if (/Android/.test(ua)) return 'android'
    if (/Mac/.test(ua)) return 'mac'
    if (/Win/.test(ua)) return 'windows'
    return 'linux'
  }

  async function font(kind: 'otf' | 'woff2') {
    busy = kind
    try {
      const otf = await live.buildFont()
      if (kind === 'otf') downloadBlob(`${slug}.otf`, otf, 'font/otf')
      else downloadBlob(`${slug}.woff2`, await toWoff2(otf), 'font/woff2')
    } catch (err) {
      toasts.show(`Export failed: ${err instanceof Error ? err.message : err}`)
    } finally {
      busy = null
    }
  }

  function exportProject() {
    downloadBlob(`${slug}.writehand.json`, projectFileText(project.snapshot(), __APP_VERSION__), 'application/json')
    backup.markExported()
  }

  async function importProject(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const p = parseProjectFile(await file.text())
      const n = Object.keys(p.slots).length
      if (Object.keys(project.slots).length && !confirm(`Replace your current drawing with “${p.name}” (${n} characters)?`)) return
      project.apply(p)
      await project.save()
      toasts.show(`Imported “${p.name}” · ${n} characters`)
      onclose()
    } catch (err) {
      toasts.show(`Import failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  const OS = [
    ['windows', 'Windows'],
    ['mac', 'macOS'],
    ['linux', 'Linux'],
    ['ios', 'iPhone / iPad'],
    ['android', 'Android'],
  ] as const
</script>

<dialog
  bind:this={dialog}
  class="export"
  aria-labelledby="export-title"
  oncancel={e => {
    e.preventDefault()
    onclose()
  }}
>
  <header>
    <h2 id="export-title">Export</h2>
    <button class="btn" onclick={onclose} aria-label="Close export">×</button>
  </header>

  <section>
    <h3>Your font</h3>
    <label class="name">
      Font name
      <input bind:value={project.name} maxlength="64" />
    </label>
    {#if requiredLeft}
      <p class="warn"><span class="pill">{requiredLeft} required left</span> Draw every Required character to download.</p>
    {/if}
    <div class="row">
      <button class="btn primary" data-testid="download" disabled={requiredLeft > 0 || !!busy} onclick={() => font('otf')}>
        {busy === 'otf' ? 'Building…' : 'Download .otf'}
      </button>
      <button class="btn" data-testid="download-woff2" disabled={requiredLeft > 0 || !!busy} onclick={() => font('woff2')}>
        {busy === 'woff2' ? 'Compressing…' : '.woff2 for websites'}
      </button>
    </div>
    <p class="note">OTF installs on your computer. WOFF2 is smaller, for use on a website with <code>@font-face</code>.</p>
  </section>

  <section>
    <h3>Install the font</h3>
    <div class="tabs" role="tablist" aria-label="Operating system">
      {#each OS as [id, label]}
        <button role="tab" aria-selected={os === id} class:on={os === id} onclick={() => (os = id)}>{label}</button>
      {/each}
    </div>
    <div class="steps" role="tabpanel">
      {#if os === 'windows'}
        <ol>
          <li>Open your Downloads folder and right-click <code>{slug}.otf</code>.</li>
          <li>Choose <b>Install</b> (or <b>Install for all users</b>).</li>
          <li>Restart apps that were open. The font is listed as “{project.name}”.</li>
        </ol>
      {:else if os === 'mac'}
        <ol>
          <li>Double-click <code>{slug}.otf</code> in Downloads. Font Book opens.</li>
          <li>Click <b>Install</b>.</li>
          <li>Choose “{project.name}” in the font menu of Pages, Keynote, Word and so on.</li>
        </ol>
      {:else if os === 'linux'}
        <ol>
          <li>Copy it into your fonts folder: <code>mkdir -p ~/.local/share/fonts && cp ~/Downloads/{slug}.otf ~/.local/share/fonts/</code></li>
          <li>Refresh the cache: <code>fc-cache -f</code></li>
        </ol>
      {:else if os === 'ios'}
        <ol>
          <li>iPadOS and iOS can't install a font file on their own: they need a font-installer app from the App Store, which installs it as a configuration profile.</li>
          <li>Open <code>{slug}.otf</code> from Files in that app and follow its steps (Settings → General → VPN &amp; Device Management to finish).</li>
          <li>Apps that import fonts directly (for example Procreate) can open the file themselves.</li>
        </ol>
      {:else}
        <ol>
          <li>Most Android phones only install system fonts with root or a vendor font manager, so a downloaded OTF usually can't become the system font.</li>
          <li>Many apps (note-taking, drawing, design) let you import a font file directly. Use <code>{slug}.otf</code> there.</li>
        </ol>
      {/if}
    </div>
  </section>

  <section>
    <h3>Back up your drawing</h3>
    <p class="note">
      Your strokes live only in this browser. Clearing site data, or (in Safari tabs) not visiting for a week, can erase them. A project file
      keeps everything and can be opened here on any device.
    </p>
    <div class="row">
      <button class="btn" data-testid="export-project" onclick={exportProject}>Save project file</button>
      <label class="btn">
        Open project file…
        <input type="file" accept=".json,application/json" data-testid="import-project" onchange={importProject} hidden />
      </label>
    </div>
  </section>

  {#if install.deferred || install.iosHint}
    <section>
      <h3>Install Write-Hand</h3>
      {#if install.deferred}
        <button class="btn" onclick={() => install.prompt()}>Install app</button>
      {:else}
        <p class="note">In Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. The Home Screen app keeps your drawing safe from Safari's 7-day cleanup.</p>
      {/if}
    </section>
  {/if}
</dialog>

<style>
  .export {
    width: min(640px, 100vw - 24px);
    max-height: min(92dvh, 900px);
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overscroll-behavior: contain;
  }
  .export::backdrop {
    background: color-mix(in srgb, var(--bg) 70%, transparent);
    backdrop-filter: blur(2px);
  }
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg);
    border-bottom: var(--border);
  }
  h2 {
    margin: 0;
    font-size: 1.3rem;
  }
  section {
    padding: 14px 16px;
    border-bottom: var(--border-w) dashed var(--comment);
    display: grid;
    gap: 10px;
  }
  section:last-child {
    border-bottom: 0;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .name {
    display: grid;
    gap: 4px;
    font-size: 0.85rem;
  }
  .note,
  .warn {
    margin: 0;
    font-size: 0.85rem;
  }
  .pill {
    background: var(--orange);
    color: var(--on-accent);
    border-radius: var(--radius);
    padding: 1px 8px;
    font-weight: 600;
    margin-right: 6px;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    border: var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .tabs button {
    flex: 1 1 auto;
    min-height: 36px;
    padding: 4px 10px;
    background: var(--bg);
    border: 0;
    border-right: var(--border);
    cursor: pointer;
  }
  .tabs button:last-child {
    border-right: 0;
  }
  .tabs button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  ol {
    margin: 0;
    padding-left: 1.3em;
    display: grid;
    gap: 6px;
    font-size: 0.9rem;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    word-break: break-all;
  }
  @media (max-width: 599px) {
    .export {
      width: 100vw;
      max-width: 100vw;
      max-height: 100dvh;
      height: 100dvh;
      margin: 0;
      border: 0;
      border-radius: 0;
    }
  }
</style>

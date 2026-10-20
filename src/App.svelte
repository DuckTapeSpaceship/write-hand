<script lang="ts">
  import { tick } from 'svelte'
  import CellMenu from './components/CellMenu.svelte'
  import GlyphGrid from './components/GlyphGrid.svelte'
  import Preview from './components/Preview.svelte'
  import ThemeToggle from './components/ThemeToggle.svelte'
  import TierChips from './components/TierChips.svelte'
  import Toasts from './components/Toasts.svelte'
  import WriteView from './components/WriteView.svelte'
  import { inputMode, type FingerPref } from './lib/input/mode.svelte'
  import { REQUIRED_IDS, SLOT_BY_ID, TIERS, tierSlots, type TierId } from './lib/model/charset'
  import { live } from './lib/preview/live.svelte'
  import { pickAuto } from './lib/preview/sentences'
  import { downloadBlob, slugify } from './lib/store/file'
  import { project } from './lib/store/project.svelte'
  import { cellDomId, clearWithUndo } from './lib/ui/actions'
  import { toasts } from './lib/ui/toast.svelte'

  const version = __APP_VERSION__
  const AUTO_KEY = 'wh-sample-auto'

  let activeTier = $state<TierId>('required')
  let menu = $state<{ id: string; x: number; y: number } | null>(null)
  let writing = $state<string | null>(null)
  let features = $state({ calt: true, liga: true, ss01: false })
  let auto = $state(readAuto())
  let text = $state(project.sample)
  let exporting = $state(false)

  const has = (ch: string) => project.has(ch)
  const requiredDone = $derived(REQUIRED_IDS.filter(id => project.has(id)).length)
  const requiredLeft = $derived(REQUIRED_IDS.length - requiredDone)
  const tier = $derived(TIERS.find(t => t.id === activeTier)!)
  const order = $derived(tierSlots(activeTier).map(s => s.id))
  const featureCss = $derived(`"calt" ${features.calt ? 1 : 0}, "liga" ${features.liga ? 1 : 0}, "ss01" ${features.ss01 ? 1 : 0}`)

  function readAuto(): boolean {
    try {
      return localStorage.getItem(AUTO_KEY) !== '0'
    } catch {
      return true
    }
  }

  $effect(() => {
    try {
      localStorage.setItem(AUTO_KEY, auto ? '1' : '0')
    } catch {
      // per-device convenience only
    }
  })

  // Auto mode follows what has been drawn; a custom sentence is saved with the project.
  $effect(() => {
    void project.slots
    if (auto) text = pickAuto(has)
  })
  $effect(() => {
    if (!auto) project.sample = text
  })

  $effect(() => live.start())
  $effect(() => project.autosave())

  function openMenu(id: string, at: { x: number; y: number }) {
    menu = { id, x: at.x, y: at.y }
  }

  function openWrite(id: string) {
    const def = SLOT_BY_ID.get(id)
    if (def && def.tier !== activeTier) activeTier = def.tier
    writing = id
  }

  async function jumpTo(ch: string) {
    const def = SLOT_BY_ID.get(ch)
    if (!def) return
    if (inputMode.phone && inputMode.touch === 'tap') return openWrite(ch)
    activeTier = def.tier
    await tick()
    const el = document.getElementById(cellDomId(ch))
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }

  async function exportOtf() {
    exporting = true
    try {
      const buf = await live.buildFont()
      downloadBlob(`${slugify(project.name)}.otf`, buf, 'font/otf')
    } catch (err) {
      toasts.show(`Export failed: ${err instanceof Error ? err.message : err}`)
    } finally {
      exporting = false
    }
  }
</script>

<header class="top">
  <div class="row brand-row">
    <div class="brand">
      <img src="/duct.png" alt="" width="28" height="28" />
      <span>Write-Hand</span>
    </div>
    <input class="name" bind:value={project.name} aria-label="Font name" placeholder="Your font name" maxlength="64" />
    <div class="progress" title="{requiredDone} of {REQUIRED_IDS.length} required characters drawn">
      <div class="bar" role="progressbar" aria-label="Required characters" aria-valuemin="0" aria-valuemax={REQUIRED_IDS.length} aria-valuenow={requiredDone}>
        <div class="fill" style:width="{(requiredDone / REQUIRED_IDS.length) * 100}%"></div>
      </div>
      <span class="count">{requiredDone}/{REQUIRED_IDS.length}</span>
    </div>
    <button class="btn primary" onclick={exportOtf} disabled={requiredLeft > 0 || exporting} data-testid="download">
      {exporting ? 'Building…' : 'Download .otf'}
    </button>
    <ThemeToggle />
  </div>
  {#if requiredLeft > 0}
    <p class="left"><span class="pill">{requiredLeft} required left</span> before you can download</p>
  {/if}
  <Preview bind:text bind:auto bind:features {has} compact={inputMode.phone} onmissing={jumpTo} />
  <TierChips bind:active={activeTier} />
</header>

<main class="content">
  <GlyphGrid {tier} onmenu={openMenu} onopen={openWrite} />
</main>

<footer class="foot">
  <label class="setting">
    Finger
    <select value={inputMode.finger} onchange={e => inputMode.setFinger(e.currentTarget.value as FingerPref)}>
      <option value="auto">Auto ({inputMode.penSeen ? 'pen seen: tap to open' : inputMode.phone ? 'tap to open' : 'draw in grid'})</option>
      <option value="draw">Draw in grid</option>
      <option value="view">Open write view</option>
    </select>
  </label>
  <p>
    Everything stays in your browser. Built on ideas and code from
    <a href="https://github.com/alexkroeker177/fontify" target="_blank" rel="noreferrer">fontify</a> (MIT).
    <span class="ver">{version}</span>
  </p>
</footer>

{#if menu}
  {@const m = menu}
  <CellMenu
    x={m.x}
    y={m.y}
    label={SLOT_BY_ID.get(m.id)?.label ?? m.id}
    canUndo={project.has(m.id)}
    canClear={project.has(m.id)}
    onundo={() => project.undoStroke(m.id)}
    onclear={() => clearWithUndo(m.id)}
    onopen={() => openWrite(m.id)}
    onclose={() => (menu = null)}
  />
{/if}

{#if writing}
  <WriteView bind:id={writing} {order} {text} {featureCss} onclose={() => (writing = null)} />
{/if}

<Toasts />

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--bg);
    border-bottom: var(--border);
    padding: max(10px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 6px max(16px, env(safe-area-inset-left));
    display: grid;
    gap: 6px;
  }
  .top > :global(*) {
    width: 100%;
    max-width: 1280px;
    margin-inline: auto;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 1.1rem;
  }
  .brand img {
    border-radius: var(--radius);
  }
  .name {
    flex: 1 1 160px;
    min-width: 0;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bar {
    width: 120px;
    height: 14px;
    border: var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 200ms ease-out;
  }
  .count {
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }
  .left {
    margin-block: 0;
    font-size: 0.85rem;
  }
  .pill {
    background: var(--orange);
    color: var(--on-accent);
    border-radius: var(--radius);
    padding: 1px 8px;
    font-weight: 600;
  }
  .content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 4px max(16px, env(safe-area-inset-right)) 40px max(16px, env(safe-area-inset-left));
  }
  .foot {
    max-width: 1280px;
    margin: 0 auto;
    padding: 20px 16px max(40px, env(safe-area-inset-bottom));
    border-top: var(--border-w) dashed var(--comment);
    font-size: 0.85rem;
    display: grid;
    gap: 8px;
  }
  .foot a {
    color: inherit;
  }
  .ver {
    font-family: var(--font-mono);
    opacity: 0.6;
    margin-left: 6px;
  }
  .setting {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  :global(:root) {
    --cell-min: 160px;
  }
  @media (max-width: 599px) {
    :global(:root) {
      --cell-min: 140px;
    }
    .brand span {
      display: none;
    }
    .bar {
      width: 70px;
    }
  }
  @media (min-width: 600px) and (max-width: 1100px) {
    :global(:root) {
      --cell-min: 170px;
    }
  }
</style>

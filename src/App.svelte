<script lang="ts">
  import { tick } from 'svelte'
  import CellMenu from './components/CellMenu.svelte'
  import ExportDialog from './components/ExportDialog.svelte'
  import Landing from './components/Landing.svelte'
  import Onboarding from './components/Onboarding.svelte'
  import SettingsMenu from './components/SettingsMenu.svelte'
  import TestStrip from './components/TestStrip.svelte'
  import GlyphGrid from './components/GlyphGrid.svelte'
  import Preview from './components/Preview.svelte'
  import ThemeToggle from './components/ThemeToggle.svelte'
  import TierChips from './components/TierChips.svelte'
  import Toasts from './components/Toasts.svelte'
  import WriteView from './components/WriteView.svelte'
  import { DECOMPOSE, markSlotId } from './lib/font/compose'
  import { inputMode } from './lib/input/mode.svelte'
  import { REQUIRED_IDS, SLOT_BY_ID, TIERS, tierSlots, type TierId } from './lib/model/charset'
  import { live } from './lib/preview/live.svelte'
  import { pickAuto } from './lib/preview/sentences'
  import { hasGlyph, project } from './lib/store/project.svelte'
  import { cellDomId, clearWithUndo } from './lib/ui/actions'
  import { backup } from './lib/ui/backup.svelte'
  import { prefs } from './lib/ui/prefs.svelte'
  import { startPwa } from './lib/ui/pwa.svelte'

  const version = __APP_VERSION__
  const AUTO_KEY = 'wh-sample-auto'

  let activeTier = $state<TierId>('required')
  let menu = $state<{ id: string; x: number; y: number } | null>(null)
  let writing = $state<string | null>(null)
  let features = $state({ calt: true, liga: true, ss01: false })
  let auto = $state(readAuto())
  let text = $state(project.sample)
  let exportOpen = $state(false)
  let expanded = $state(false) // phone: preview panel open
  let onboarding = $state(!onboarded() && !Object.keys(project.slots).length)

  const has = hasGlyph
  const empty = $derived(!Object.keys(project.slots).length)
  const phone = $derived(inputMode.phone)
  const requiredDone = $derived(REQUIRED_IDS.filter(id => project.has(id)).length)
  const requiredLeft = $derived(REQUIRED_IDS.length - requiredDone)
  const tier = $derived(TIERS.find(t => t.id === activeTier)!)
  const order = $derived(tierSlots(activeTier).map(s => s.id))
  const featureCss = $derived(`"calt" ${features.calt ? 1 : 0}, "liga" ${features.liga ? 1 : 0}, "ss01" ${features.ss01 ? 1 : 0}`)

  function onboarded(): boolean {
    try {
      return localStorage.getItem('wh-onboarded') === '1'
    } catch {
      return true
    }
  }

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
  $effect(() => prefs.apply())
  $effect(() => startPwa())

  // Phone: the expanded preview folds away once you scroll on.
  $effect(() => {
    if (!phone || !expanded) return
    const y0 = scrollY
    const onScroll = () => {
      // Don't fold while typing in the sentence or the name.
      if (document.activeElement?.matches('.top input, .top select')) return
      if (Math.abs(scrollY - y0) > 60) expanded = false
    }
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  })

  function openMenu(id: string, at: { x: number; y: number }) {
    menu = { id, x: at.x, y: at.y }
  }

  function openWrite(id: string) {
    const def = SLOT_BY_ID.get(id)
    if (def && def.tier !== activeTier) activeTier = def.tier
    writing = id
  }

  /** The slot to draw for a missing character (accents: the missing part). */
  function slotFor(ch: string): string | null {
    if (SLOT_BY_ID.has(ch)) return ch
    const d = DECOMPOSE[ch]
    if (!d) return null
    return project.has(d[0]) ? markSlotId(d[1]) : d[0]
  }

  async function jumpTo(missing: string) {
    const ch = slotFor(missing)
    const def = ch ? SLOT_BY_ID.get(ch) : undefined
    if (!ch || !def) return
    expanded = false
    if (inputMode.phone && inputMode.touch === 'tap') return openWrite(ch)
    activeTier = def.tier
    await tick()
    const el = document.getElementById(cellDomId(ch))
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }

  async function start() {
    activeTier = 'required'
    if (inputMode.phone && inputMode.touch === 'tap') return openWrite('a')
    await tick()
    const el = document.getElementById(cellDomId('a'))
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }
</script>

<a class="skip" href="#characters">Skip to the characters</a>
<header class="top" class:phone>
  <div class="row brand-row">
    <h1 class="brand">
      <img src="/icons/icon-192.png" alt="" width="30" height="30" />
      <span>Write-Hand</span>
    </h1>
    {#if !phone}
      <input class="name" bind:value={project.name} aria-label="Font name" placeholder="Your font name" maxlength="64" />
    {/if}
    <div class="progress" title="{requiredDone} of {REQUIRED_IDS.length} required characters drawn">
      <div class="bar" role="progressbar" aria-label="Required characters" aria-valuemin="0" aria-valuemax={REQUIRED_IDS.length} aria-valuenow={requiredDone}>
        <div class="fill" style:width="{(requiredDone / REQUIRED_IDS.length) * 100}%"></div>
      </div>
      <span class="count">{requiredDone}/{REQUIRED_IDS.length}</span>
    </div>
    <button class="btn" class:primary={!requiredLeft} onclick={() => (exportOpen = true)} data-testid="export">Export</button>
    <SettingsMenu />
    <button class="btn" onclick={() => (onboarding = true)} aria-label="How it works" title="How it works">?</button>
    <ThemeToggle />
  </div>
  {#if !phone && requiredLeft > 0}
    <p class="left"><span class="pill">{requiredLeft} required left</span> before you can download a font</p>
  {/if}
  {#if phone && expanded}
    <input class="name" bind:value={project.name} aria-label="Font name" placeholder="Your font name" maxlength="64" />
  {/if}
  <Preview bind:text bind:auto bind:features bind:expanded {has} compact={phone} onmissing={jumpTo} />
  <TierChips bind:active={activeTier} />
</header>

<main class="content" id="characters" tabindex="-1">
  {#if empty}
    <Landing onstart={start} />
  {/if}
  {#if backup.due}
    <div class="backup panel" role="status">
      <span>Your drawing lives only in this browser. Save a backup file?</span>
      <button class="btn primary" onclick={() => (exportOpen = true)}>Back up…</button>
      <button class="btn" onclick={() => backup.snooze()}>Later</button>
    </div>
  {/if}
  <TestStrip {features} />
  <GlyphGrid {tier} onmenu={openMenu} onopen={openWrite} />
</main>

<footer class="foot">
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
    onclose={() => {
      menu = null
      document.getElementById(cellDomId(m.id))?.focus({ preventScroll: true })
    }}
  />
{/if}

{#if exportOpen}
  <ExportDialog onclose={() => (exportOpen = false)} />
{/if}

{#if onboarding}
  <Onboarding onclose={() => (onboarding = false)} />
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
  .skip {
    position: absolute;
    left: 8px;
    top: -100px;
    z-index: 100;
    padding: 8px 12px;
    background: var(--accent);
    color: var(--on-accent);
    border: var(--border);
    border-radius: var(--radius);
  }
  .skip:focus {
    top: 8px;
  }
  .content:focus {
    outline: none;
  }
  .backup {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin: 16px 0 4px;
    padding: 10px 14px;
    background: var(--bg);
  }
  .backup span {
    flex: 1 1 240px;
  }
  .brand {
    margin: 0;
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
    margin-left: 6px;
  }
  .phone .brand span {
    display: none;
  }
  @media (max-width: 599px) {
    .brand span {
      display: none;
    }
    .bar {
      width: 70px;
    }
  }
  .phone.top {
    gap: 4px;
    padding-top: max(8px, env(safe-area-inset-top));
  }
  .phone .progress {
    flex: 1;
  }
  .phone .bar {
    flex: 1;
  }
</style>

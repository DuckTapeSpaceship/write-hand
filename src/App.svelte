<script lang="ts">
  import { tick } from 'svelte'
  import { fly } from 'svelte/transition'
  import CellMenu from './components/CellMenu.svelte'
  import ExportDialog from './components/ExportDialog.svelte'
  import Onboarding from './components/Onboarding.svelte'
  import SettingsMenu from './components/SettingsMenu.svelte'
  import TestStrip from './components/TestStrip.svelte'
  import GlyphGrid from './components/GlyphGrid.svelte'
  import PreviewLine from './components/PreviewLine.svelte'
  import TierChips from './components/TierChips.svelte'
  import Toasts from './components/Toasts.svelte'
  import WriteView from './components/WriteView.svelte'
  import { DECOMPOSE, markSlotId } from './lib/font/compose'
  import { REQUIRED_IDS, SLOT_BY_ID, TIERS, tierSlots, type TierId } from './lib/model/charset'
  import { featureCss, type Features } from './lib/preview/features'
  import { live } from './lib/preview/live.svelte'
  import { pickAuto } from './lib/preview/sentences'
  import { hasGlyph, project } from './lib/store/project.svelte'
  import { cellDomId, clearWithUndo } from './lib/ui/actions'
  import { backup } from './lib/ui/backup.svelte'
  import { prefs } from './lib/ui/prefs.svelte'
  import { startPwa } from './lib/ui/pwa.svelte'

  const AUTO_KEY = 'wh-sample-auto'

  let activeTier = $state<TierId>('required')
  let menu = $state<{ id: string; x: number; y: number } | null>(null)
  let writing = $state<string | null>(null)
  let features = $state<Features>({ calt: true, liga: true, ss01: false })
  let auto = $state(readAuto())
  let text = $state(project.sample)
  let exportOpen = $state(false)
  let collapsed = $state(false) // the sentence box has scrolled under the header
  let headerRow: HTMLDivElement
  let strip: HTMLDivElement
  let onboarding = $state(!onboarded() && !Object.keys(project.slots).length)

  const has = hasGlyph
  const requiredLeft = $derived(REQUIRED_IDS.filter(id => !project.has(id)).length)
  const tier = $derived(TIERS.find(t => t.id === activeTier)!)
  const order = $derived(tierSlots(activeTier).map(s => s.id))

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

  // The sentence box collapses into a line under the header once it has
  // scrolled away. The line overlays the page, so showing it never moves
  // the box (which would flip it straight back).
  $effect(() => {
    const check = () => (collapsed = strip.getBoundingClientRect().bottom < headerRow.getBoundingClientRect().bottom + 8)
    check()
    addEventListener('scroll', check, { passive: true })
    addEventListener('resize', check)
    return () => {
      removeEventListener('scroll', check)
      removeEventListener('resize', check)
    }
  })

  function openSentence() {
    scrollTo({ top: 0, behavior: 'smooth' })
  }

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
    activeTier = def.tier
    await tick()
    const el = document.getElementById(cellDomId(ch))
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }
</script>

<a class="skip" href="#characters">Skip to the characters</a>
<header class="top">
  <div class="row" bind:this={headerRow}>
    <h1 class="brand"><img src="/icons/icon-192.png" alt="Write-Hand" width="26" height="26" /></h1>
    <TierChips bind:active={activeTier} />
    <button class="btn" class:primary={!requiredLeft} onclick={() => (exportOpen = true)} data-testid="export">Export</button>
    <SettingsMenu onhelp={() => (onboarding = true)} />
  </div>
  {#if collapsed}
    <div class="line" transition:fly={{ y: -10, duration: 140 }}>
      <PreviewLine line {text} {has} {features} onmissing={jumpTo} onopen={openSentence} />
    </div>
  {/if}
</header>

<main class="content" id="characters" tabindex="-1">
  {#if backup.due}
    <div class="backup panel" role="status">
      <span>Only saved in this browser.</span>
      <button class="btn primary" onclick={() => (exportOpen = true)}>Back up</button>
      <button class="btn" onclick={() => backup.snooze()}>Later</button>
    </div>
  {/if}
  <div bind:this={strip}>
    <TestStrip bind:text bind:auto bind:features {has} onmissing={jumpTo} />
  </div>
  <GlyphGrid {tier} onmenu={openMenu} onopen={openWrite} />
</main>

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
  <WriteView bind:id={writing} {order} {text} featureCss={featureCss(features)} onclose={() => (writing = null)} />
{/if}

<Toasts />

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--bg);
    border-bottom: var(--border);
    padding: max(6px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 4px max(16px, env(safe-area-inset-left));
  }
  .top > :global(*) {
    width: 100%;
    min-width: 0;
    max-width: 1280px;
    margin-inline: auto;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .row > :global(.chips) {
    flex: 1;
    min-width: 0;
  }
  .line {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: var(--border-w);
    padding: 2px max(16px, env(safe-area-inset-right)) 4px max(16px, env(safe-area-inset-left));
    background: var(--bg);
    border-bottom: var(--border);
    max-width: none;
  }
  .line > :global(*) {
    max-width: 1280px;
    margin-inline: auto;
  }
  .row :global(.btn) {
    min-height: 32px;
    padding-block: 0.2em;
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
    flex: 1 1 160px;
  }
  .brand {
    margin: 0;
    display: flex;
  }
  .brand img {
    border-radius: var(--radius);
  }
  .content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 4px max(16px, env(safe-area-inset-right)) max(40px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  }
  @media (max-width: 599px) {
    .brand {
      display: none;
    }
  }
</style>

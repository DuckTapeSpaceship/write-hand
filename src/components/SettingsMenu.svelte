<script lang="ts">
  import { inputMode, type FingerPref } from '../lib/input/mode.svelte'
  import { PEN_PRESETS, type PenStyle } from '../lib/model/project'
  import { project } from '../lib/store/project.svelte'
  import { prefs, type CellSize } from '../lib/ui/prefs.svelte'

  let open = $state(false)
  let root: HTMLDivElement

  const styles = Object.keys(PEN_PRESETS) as PenStyle[]
  const preset = $derived(PEN_PRESETS[project.pen.style])
  const weight = $derived(Math.round((project.pen.size / preset.size) * 100))

  function setStyle(style: PenStyle) {
    const ratio = project.pen.size / PEN_PRESETS[project.pen.style].size
    const p = PEN_PRESETS[style]
    project.pen = { ...p, size: Math.round(p.size * ratio), pressure: project.pen.pressure }
  }

  function setWeight(pct: number) {
    project.pen = { ...project.pen, size: Math.round((preset.size * pct) / 100) }
  }

  $effect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.contains(e.target as Node)) open = false
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (open = false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  })
</script>

<div class="settings" bind:this={root}>
  <button class="btn" aria-expanded={open} aria-haspopup="dialog" aria-label="Pen and layout settings" title="Pen & layout" onclick={() => (open = !open)}>
    <span aria-hidden="true">⚙</span>
  </button>
  {#if open}
    <div class="panel pop" role="dialog" aria-label="Pen and layout">
      <fieldset>
        <legend>Pen</legend>
        <div class="seg" role="radiogroup" aria-label="Pen style">
          {#each styles as s}
            <button role="radio" aria-checked={project.pen.style === s} class:on={project.pen.style === s} onclick={() => setStyle(s)}>{s}</button>
          {/each}
        </div>
        <label class="row">
          Weight
          <input type="range" min="60" max="160" step="5" value={weight} oninput={e => setWeight(+e.currentTarget.value)} />
          <span class="num">{weight}%</span>
        </label>
        <p class="note">Changes every glyph: strokes are kept, outlines are rebuilt.</p>
      </fieldset>
      <fieldset>
        <legend>Cell size</legend>
        <div class="seg" role="radiogroup" aria-label="Cell size">
          {#each [['s', 'S'], ['m', 'M'], ['l', 'L']] as [v, label]}
            <button role="radio" aria-checked={prefs.cellSize === v} class:on={prefs.cellSize === v} onclick={() => prefs.setCellSize(v as CellSize)}>{label}</button>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Finger</legend>
        <select value={inputMode.finger} onchange={e => inputMode.setFinger(e.currentTarget.value as FingerPref)} aria-label="Finger behaviour">
          <option value="auto">Auto ({inputMode.penSeen ? 'pen seen: tap to open' : inputMode.phone ? 'tap to open' : 'draw in grid'})</option>
          <option value="draw">Draw in grid</option>
          <option value="view">Open write view</option>
        </select>
      </fieldset>
    </div>
  {/if}
</div>

<style>
  .settings {
    position: relative;
  }
  .pop {
    position: absolute;
    right: 0;
    top: calc(100% + 10px);
    z-index: 30;
    width: min(320px, calc(100vw - 32px));
    padding: 12px;
    display: grid;
    gap: 10px;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  legend {
    font-weight: 600;
    padding: 0;
    margin-bottom: 4px;
  }
  .seg {
    display: flex;
    border: var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .seg button {
    flex: 1;
    min-height: 36px;
    background: var(--bg);
    border: 0;
    border-right: var(--border);
    cursor: pointer;
    text-transform: capitalize;
  }
  .seg button:last-child {
    border-right: 0;
  }
  .seg button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .row input {
    flex: 1;
  }
  .num {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    width: 3.5em;
    text-align: right;
  }
  .note {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.75;
  }
</style>

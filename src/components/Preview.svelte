<script lang="ts">
  // fontify's sticky sentence, extended: presets, auto mode, missing-glyph
  // highlighting (tap to jump to the cell) and OpenType feature toggles.
  import { SLOT_BY_ID } from '../lib/model/charset'
  import { live, PREVIEW_FAMILY } from '../lib/preview/live.svelte'
  import { PRESETS, segment } from '../lib/preview/sentences'

  let {
    text = $bindable(),
    auto = $bindable(),
    has,
    features = $bindable(),
    compact = false,
    onmissing,
  }: {
    text: string
    auto: boolean
    has: (ch: string) => boolean
    features: { calt: boolean; liga: boolean; ss01: boolean }
    compact?: boolean
    onmissing: (ch: string) => void
  } = $props()

  const segments = $derived(segment(text, has))
  const missingCount = $derived(segments.filter(s => s.missing).length)
  const featureCss = $derived(`"calt" ${features.calt ? 1 : 0}, "liga" ${features.liga ? 1 : 0}, "ss01" ${features.ss01 ? 1 : 0}`)

  let choice = $derived(auto ? 'auto' : (PRESETS.find(p => p.text === text)?.label ?? 'custom'))

  function pick(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value
    if (v === 'auto') auto = true
    else if (v !== 'custom') {
      auto = false
      text = PRESETS.find(p => p.label === v)!.text
    }
  }
</script>

<div class="preview" class:compact>
  <div class="controls">
    <input
      class="sentence"
      value={text}
      oninput={e => {
        auto = false
        text = e.currentTarget.value
      }}
      aria-label="Preview sentence"
      maxlength="200"
    />
    <select value={choice} onchange={pick} aria-label="Sentence preset">
      <option value="auto">Auto</option>
      {#each PRESETS as p}<option value={p.label}>{p.label}</option>{/each}
      <option value="custom" disabled>Custom</option>
    </select>
    <div class="feats" role="group" aria-label="OpenType features">
      {#each ['calt', 'liga', 'ss01'] as const as f}
        <label title={f === 'calt' ? 'Cycle alternates' : f === 'liga' ? 'Ligatures' : 'Stylistic set 1: alternates off'}>
          <input type="checkbox" bind:checked={features[f]} />
          {f}
        </label>
      {/each}
    </div>
  </div>

  {#key live.gen}
    <p
      class="render"
      data-testid="preview"
      style:font-family={live.ready ? `'${PREVIEW_FAMILY}', var(--font-ui)` : 'var(--font-ui)'}
      style:font-feature-settings={featureCss}
      aria-live="polite"
    >
      {#each segments as seg, i (i)}
        {#if seg.missing}
          {@const known = SLOT_BY_ID.has(seg.text)}
          <button
            class="missing"
            disabled={!known}
            title={known ? `Draw “${seg.text}”` : 'Not in the character set yet'}
            onclick={() => onmissing(seg.text)}>{seg.text}</button
          >
        {:else}{seg.text}{/if}
      {/each}
    </p>
  {/key}
  <p class="status">
    {#if missingCount}<span><mark>{missingCount}</mark> to draw · tap one to jump there</span>{:else if live.ready}<span>All drawn ✓</span>{/if}
    {#if live.error}<span class="err">Build error: {live.error}</span>{/if}
  </p>
</div>

<style>
  .preview {
    display: grid;
    gap: 6px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .sentence {
    flex: 1 1 220px;
    min-width: 0;
  }
  .feats {
    display: flex;
    gap: 10px;
    font-size: 0.85rem;
  }
  .feats label {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-family: var(--font-mono);
  }
  .render {
    margin: 0;
    font-size: clamp(28px, 5vw, 48px);
    line-height: 1.3;
    overflow-wrap: anywhere;
    max-height: 2.7em;
    overflow-y: auto;
  }
  .compact .render {
    font-size: 26px;
    max-height: 1.35em;
  }
  .missing {
    font: inherit;
    font-family: var(--font-ui);
    color: inherit;
    opacity: 0.85;
    background: color-mix(in srgb, var(--accent) 70%, transparent);
    color: var(--on-accent);
    border: 0;
    border-radius: 3px;
    padding: 0 0.04em;
    margin: 0;
    line-height: inherit;
    cursor: pointer;
  }
  .missing:disabled {
    background: transparent;
    color: inherit;
    opacity: 0.45;
    cursor: default;
  }
  .status {
    margin: 0;
    font-size: 0.8rem;
    display: flex;
    gap: 12px;
    min-height: 1.2em;
  }
  mark {
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 3px;
    padding: 0 4px;
  }
  .err {
    background: var(--red);
    color: var(--on-accent);
    padding: 0 6px;
    border-radius: var(--radius);
  }
</style>

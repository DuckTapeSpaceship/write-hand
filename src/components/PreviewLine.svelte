<script lang="ts">
  // The sentence set in the live preview font. Missing letters are highlighted
  // buttons that jump to their cell. `line` is the collapsed header view (one
  // line, tap to go back to the sentence box); otherwise it wraps.
  import { DECOMPOSE } from '../lib/font/compose'
  import { SLOT_BY_ID } from '../lib/model/charset'
  import { featureCss, type Features } from '../lib/preview/features'
  import { live, PREVIEW_FAMILY } from '../lib/preview/live.svelte'
  import { segment } from '../lib/preview/sentences'

  let {
    text,
    has,
    features,
    line = false,
    onmissing,
    onopen,
  }: {
    text: string
    has: (ch: string) => boolean
    features: Features
    line?: boolean
    onmissing: (ch: string) => void
    onopen?: () => void
  } = $props()

  const segments = $derived(segment(text, has))
</script>

{#key live.gen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <p
    class="render"
    class:line
    onclick={e => {
      if (!(e.target as HTMLElement).closest('button')) onopen?.()
    }}
    title={line ? 'Edit' : undefined}
    data-testid={line ? 'preview-line' : 'preview'}
    style:font-family={live.ready ? `'${PREVIEW_FAMILY}', var(--font-ui)` : 'var(--font-ui)'}
    style:font-feature-settings={featureCss(features)}
  >
    {#each segments as seg, i (i)}
      {#if seg.missing}
        {@const known = SLOT_BY_ID.has(seg.text) || seg.text in DECOMPOSE}
        <button class="missing" disabled={!known} title={known ? `Draw “${seg.text}”` : 'Not supported'} onclick={() => onmissing(seg.text)}
          >{seg.text}</button
        >
      {:else}{seg.text}{/if}
    {/each}
  </p>
{/key}

<style>
  .render {
    margin: 0;
    font-size: 40px;
    line-height: 1.3;
    overflow-wrap: break-word;
  }
  .line {
    font-size: 28px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }
  @media (max-width: 599px) {
    .render {
      font-size: 32px;
    }
    .line {
      font-size: 24px;
    }
  }
  .missing {
    font: inherit;
    font-family: var(--font-ui);
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
</style>

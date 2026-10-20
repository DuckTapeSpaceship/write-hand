<script lang="ts">
  // Large writing canvas: full screen on phones, a modal on larger screens.
  // Prev/next walk the current tier; a one-line live preview stays on top.
  // (P2 adds ghost neighbours and the x-height drag.)
  import { SLOT_BY_ID } from '../lib/model/charset'
  import { inputMode } from '../lib/input/mode.svelte'
  import { live, PREVIEW_FAMILY } from '../lib/preview/live.svelte'
  import { segment } from '../lib/preview/sentences'
  import { project } from '../lib/store/project.svelte'
  import { clearWithUndo } from '../lib/ui/actions'
  import DrawSurface from './DrawSurface.svelte'

  let {
    id = $bindable(),
    order,
    text,
    featureCss,
    onclose,
  }: {
    id: string
    order: string[]
    text: string
    featureCss: string
    onclose: () => void
  } = $props()

  let dialog: HTMLDialogElement
  const idx = $derived(order.indexOf(id))
  const def = $derived(SLOT_BY_ID.get(id))
  const strokes = $derived(project.strokes(id))
  const has = (ch: string) => project.has(ch)
  const segments = $derived(segment(text, has))

  $effect(() => {
    dialog.showModal()
    return () => dialog.close()
  })

  function go(delta: number) {
    if (idx < 0) return
    const next = order[(idx + delta + order.length) % order.length]
    if (next) id = next
  }

  function key(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      project.undoStroke(id)
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="write"
  aria-label="Write {def?.label ?? id}"
  onkeydown={key}
  oncancel={e => {
    e.preventDefault()
    onclose()
  }}
>
  <header class="bar">
    <button class="btn nav" onclick={() => go(-1)} aria-label="Previous character">←</button>
    <div class="who">
      <span class="char">{def?.label ?? id}</span>
      <span class="pos">{idx + 1} / {order.length}</span>
    </div>
    <button class="btn nav" onclick={() => go(1)} aria-label="Next character">→</button>
    <button class="btn primary done" onclick={onclose}>Done</button>
  </header>

  {#key live.gen}
    <p class="strip" style:font-family={live.ready ? `'${PREVIEW_FAMILY}', var(--font-ui)` : 'var(--font-ui)'} style:font-feature-settings={featureCss}>
      {#each segments as seg, i (i)}{#if seg.missing}<span class="missing">{seg.text}</span>{:else}{seg.text}{/if}{/each}
    </p>
  {/key}

  <div class="canvas">
    {#key id}
      <DrawSurface
        {strokes}
        pen={project.pen}
        metrics={project.metrics}
        touch="draw"
        label="Draw {def?.label ?? id}"
        onstroke={s => project.addStroke(id, s)}
        onpen={() => inputMode.markPen()}
      />
    {/key}
  </div>

  <footer class="bar">
    <button class="btn" onclick={() => project.undoStroke(id)} disabled={!strokes.length}>Undo stroke</button>
    <button class="btn danger" onclick={() => clearWithUndo(id)} disabled={!strokes.length}>Clear</button>
  </footer>
</dialog>

<style>
  .write {
    padding: 14px;
    max-width: min(96vw, 760px);
    width: max-content;
    max-height: 100dvh;
    background: var(--bg);
    color: var(--fg);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overscroll-behavior: contain;
  }
  .write::backdrop {
    background: color-mix(in srgb, var(--bg) 70%, transparent);
    backdrop-filter: blur(2px);
  }
  .bar {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  footer.bar {
    justify-content: center;
    margin-top: 12px;
  }
  .who {
    flex: 1;
    display: flex;
    gap: 10px;
    align-items: baseline;
    justify-content: center;
  }
  .char {
    font-size: 1.6rem;
    font-weight: 600;
  }
  .pos {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    opacity: 0.7;
  }
  .nav {
    min-width: 48px;
    font-size: 1.2rem;
  }
  .strip {
    margin: 10px 0;
    font-size: 30px;
    line-height: 1.3;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .missing {
    font-family: var(--font-ui);
    background: color-mix(in srgb, var(--accent) 70%, transparent);
    color: var(--on-accent);
    border-radius: 3px;
  }
  .canvas {
    width: min(92vw, 70vh, 640px);
    margin: 0 auto;
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  @media (max-width: 599px) {
    .write {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      margin: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom))
        max(10px, env(safe-area-inset-left));
    }
    .canvas {
      width: min(92vw, 70vh);
    }
  }
</style>

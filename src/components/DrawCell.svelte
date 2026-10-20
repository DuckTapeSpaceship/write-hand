<script lang="ts">
  // One box per slot, drawn in directly (fontify's model). Visible × to clear,
  // right-click / long-press / label strip open the cell menu, Ctrl/⌘+Z undoes
  // the last stroke and Delete clears when the cell has focus.
  import { inputMode } from '../lib/input/mode.svelte'
  import type { SlotDef } from '../lib/model/charset'
  import { project } from '../lib/store/project.svelte'
  import { cellDomId, clearWithUndo } from '../lib/ui/actions'
  import DrawSurface from './DrawSurface.svelte'

  let {
    def,
    onmenu,
    onopen,
  }: {
    def: SlotDef
    onmenu: (id: string, at: { x: number; y: number }) => void
    onopen: (id: string) => void
  } = $props()

  const strokes = $derived(project.strokes(def.id))
  const filled = $derived(strokes.length > 0)

  function key(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      project.undoStroke(def.id)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      clearWithUndo(def.id)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onopen(def.id)
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      onmenu(def.id, { x: r.left + 12, y: r.top + 32 })
    }
  }

  function labelPress(e: PointerEvent) {
    // Primary press only: a right-click arrives as contextmenu, and opening on
    // its pointerdown would let that contextmenu land on (and close) the menu.
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    onmenu(def.id, { x: e.clientX, y: e.clientY })
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="cell"
  class:filled
  id={cellDomId(def.id)}
  data-slot={def.id}
  tabindex="0"
  role="group"
  aria-label="Character {def.label}{filled ? ', drawn' : ', empty'}"
  onkeydown={key}
  oncontextmenu={e => {
    e.preventDefault()
    onmenu(def.id, { x: e.clientX, y: e.clientY })
  }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="head" onpointerdown={labelPress}>
    <span class="char">{def.label}{#if def.hint}<small>{def.hint}</small>{/if}</span>
    {#if filled}
      <button class="clear" title="Clear “{def.label}”" aria-label="Clear {def.label}" onclick={() => clearWithUndo(def.id)}>×</button>
    {/if}
  </div>
  <DrawSurface
    {strokes}
    pen={project.pen}
    metrics={project.metrics}
    touch={inputMode.touch}
    label="Draw {def.label}"
    onstroke={s => project.addStroke(def.id, s)}
    onlongpress={at => onmenu(def.id, at)}
    ontap={() => onopen(def.id)}
    onpen={() => inputMode.markPen()}
  />
</div>

<style>
  .cell {
    position: relative;
    background: var(--bg);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
    scroll-margin: 140px 0 24px;
  }
  .cell.filled {
    box-shadow: var(--shadow-accent);
  }
  .cell:focus-visible {
    outline: 3px solid var(--fg);
    outline-offset: 2px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 34px;
    padding: 0 4px 0 10px;
    border-bottom: var(--border-w) dashed var(--comment);
    cursor: context-menu;
    touch-action: manipulation;
  }
  .char {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .char small {
    font-weight: 400;
    font-size: 0.75rem;
    opacity: 0.7;
    margin-left: 8px;
  }
  .clear {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 1.2rem;
    line-height: 1;
    background: var(--bg);
    border: var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .clear:hover {
    background: var(--red);
    color: var(--on-accent);
  }
  @media (pointer: coarse) {
    .head {
      height: 40px;
    }
    .clear {
      width: 34px;
      height: 34px;
    }
  }
</style>

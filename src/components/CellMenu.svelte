<script lang="ts">
  import { tick } from 'svelte'

  let {
    x,
    y,
    label,
    canUndo,
    canClear,
    onundo,
    onclear,
    onopen,
    onclose,
  }: {
    x: number
    y: number
    label: string
    canUndo: boolean
    canClear: boolean
    onundo: () => void
    onclear: () => void
    onopen: () => void
    onclose: () => void
  } = $props()

  let menu: HTMLDivElement
  let pos = $state<{ left: number; top: number } | null>(null)

  $effect(() => {
    void tick().then(() => {
      const r = menu.getBoundingClientRect()
      pos = {
        left: Math.max(8, Math.min(x, innerWidth - r.width - 8)),
        top: Math.max(8, Math.min(y, innerHeight - r.height - 8)),
      }
      menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    })
  })

  function act(fn: () => void) {
    fn()
    onclose()
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onclose()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const items = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const i = items.indexOf(document.activeElement as HTMLButtonElement)
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="scrim" onpointerdown={onclose} oncontextmenu={e => (e.preventDefault(), onclose())}></div>
<div
  bind:this={menu}
  class="menu panel"
  role="menu"
  tabindex="-1"
  aria-label="Cell {label}"
  style:left="{pos?.left ?? x}px"
  style:top="{pos?.top ?? y}px"
  style:visibility={pos ? 'visible' : 'hidden'}
  onkeydown={key}
>
  <div class="title">“{label}”</div>
  <button role="menuitem" onclick={() => act(onundo)} disabled={!canUndo}>Undo</button>
  <button role="menuitem" class="danger" onclick={() => act(onclear)} disabled={!canClear}>Clear</button>
  <button role="menuitem" onclick={() => act(onopen)}>Enlarge</button>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
  }
  .menu {
    position: fixed;
    z-index: 41;
    display: grid;
    min-width: 200px;
    padding: 6px;
    gap: 2px;
  }
  .title {
    font-size: 0.8rem;
    opacity: 0.7;
    padding: 2px 8px 4px;
  }
  button {
    text-align: left;
    background: none;
    border: 0;
    border-radius: var(--radius);
    padding: 10px 10px;
    min-height: 40px;
    cursor: pointer;
  }
  button:hover:not(:disabled),
  button:focus-visible {
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: none;
    outline: none;
  }
  button.danger:hover:not(:disabled),
  button.danger:focus-visible {
    background: var(--red);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>

<script lang="ts">
  import { TIERS, type TierId } from '../lib/model/charset'
  import { project } from '../lib/store/project.svelte'

  let { active = $bindable() }: { active: TierId } = $props()

  const counts = $derived(
    Object.fromEntries(
      TIERS.map(t => {
        const ids = t.groups.flatMap(g => g.slots.map(s => s.id))
        return [t.id, { done: ids.filter(id => project.has(id)).length, total: ids.length }]
      }),
    ),
  )
</script>

<div class="chips" role="tablist" aria-label="Character tiers">
  {#each TIERS as t (t.id)}
    {@const c = counts[t.id]}
    <button
      class="chip"
      class:active={active === t.id}
      class:complete={c.done === c.total}
      role="tab"
      aria-selected={active === t.id}
      onclick={() => (active = t.id)}
    >
      {t.label}
      <span class="count">{c.done}/{c.total}</span>
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 2px 4px 4px 2px;
    scrollbar-width: none;
  }
  .chip {
    flex: none;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-height: 32px;
    padding: 2px 10px;
    background: var(--bg);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: 2px 2px 0 0 var(--fg);
    cursor: pointer;
    transition:
      transform 60ms ease-out,
      box-shadow 60ms ease-out;
  }
  .chip:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 0 var(--fg);
  }
  .chip:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
  .chip.active {
    background: var(--accent);
    color: var(--on-accent);
  }
  .count {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 0 5px;
    border-radius: var(--radius);
    border: var(--border-w) solid currentColor;
  }
  .chip.complete .count {
    background: var(--green);
    color: var(--on-accent);
    border-color: var(--on-accent);
  }
</style>

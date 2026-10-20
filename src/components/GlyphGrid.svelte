<script lang="ts">
  import type { Tier } from '../lib/model/charset'
  import DrawCell from './DrawCell.svelte'

  let {
    tier,
    onmenu,
    onopen,
  }: {
    tier: Tier
    onmenu: (id: string, at: { x: number; y: number }) => void
    onopen: (id: string) => void
  } = $props()
</script>

<section class="tier" aria-label={tier.label}>
  {#each tier.groups as group (group.label)}
    <h2>{group.label}</h2>
    <div class="grid">
      {#each group.slots as def (def.id)}
        <DrawCell {def} {onmenu} {onopen} />
      {/each}
    </div>
  {/each}
</section>

<style>
  .tier {
    container-type: inline-size;
  }
  h2 {
    margin: 22px 0 10px;
    font-size: 1rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--cell-min), 1fr));
    gap: 16px;
  }
</style>

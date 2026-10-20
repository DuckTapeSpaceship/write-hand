<script lang="ts">
  import { toasts } from '../lib/ui/toast.svelte'
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts.items as t (t.id)}
    <div class="toast panel">
      <span>{t.message}</span>
      {#if t.action}
        <button
          class="btn primary"
          onclick={() => {
            t.action!.run()
            toasts.dismiss(t.id)
          }}>{t.action.label}</button
        >
      {/if}
      <button class="x" aria-label="Dismiss" onclick={() => toasts.dismiss(t.id)}>×</button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    bottom: max(16px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 50;
    display: grid;
    gap: 8px;
    width: max-content;
    max-width: calc(100vw - 32px);
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 8px 8px 14px;
  }
  .x {
    background: none;
    border: 0;
    font-size: 1.3rem;
    cursor: pointer;
    padding: 0 6px;
  }
</style>

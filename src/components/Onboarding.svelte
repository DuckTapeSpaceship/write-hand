<script lang="ts">
  import { inputMode } from '../lib/input/mode.svelte'

  let { onclose }: { onclose: () => void } = $props()
  let dialog: HTMLDialogElement
  let step = $state(0)

  $effect(() => {
    dialog.showModal()
    return () => dialog.close()
  })

  const steps = $derived([
    {
      title: 'Draw each character in its box',
      body: inputMode.phone
        ? 'Tap a box to open a big canvas, write the letter, then use → to move on. Swipe the grid to scroll.'
        : 'Write straight into each box with a mouse, pen or finger. Keep letters sitting on the solid baseline; the dashed lines are the x-height and capital height.',
    },
    {
      title: 'Watch your sentence change',
      body: 'The sentence at the top is set in your font as you draw. Highlighted letters are still missing: tap one to jump to it.',
    },
    {
      title: 'Fix, then download',
      body: 'Right-click or long-press a box to undo a stroke or clear it. Once the Required tier is done, Export gives you an .otf. Your drawing stays in this browser; Export can also save a backup file.',
    },
  ])

  function done() {
    try {
      localStorage.setItem('wh-onboarded', '1')
    } catch {
      // per-device convenience only
    }
    onclose()
  }
</script>

<dialog
  bind:this={dialog}
  class="onboard"
  aria-labelledby="onboard-title"
  oncancel={e => {
    e.preventDefault()
    done()
  }}
>
  <p class="count">{step + 1} / {steps.length}</p>
  <h2 id="onboard-title">{steps[step].title}</h2>
  <p>{steps[step].body}</p>
  <div class="row">
    <button class="btn" onclick={done}>Skip</button>
    {#if step < steps.length - 1}
      <button class="btn primary" onclick={() => step++}>Next</button>
    {:else}
      <button class="btn primary" onclick={done}>Start drawing</button>
    {/if}
  </div>
</dialog>

<style>
  .onboard {
    width: min(460px, 100vw - 32px);
    padding: 20px;
    background: var(--bg);
    color: var(--fg);
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .onboard::backdrop {
    background: color-mix(in srgb, var(--bg) 70%, transparent);
  }
  .count {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    opacity: 0.7;
  }
  h2 {
    margin: 6px 0 10px;
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
  }
</style>

<script lang="ts">
  // HarfBuzz-shaped test text from the live preview font, drawn from the
  // shaper's own glyph outlines and positions. Highlights show where calt
  // picked an alternate (cyan) and where a ligature formed (pink). harfbuzzjs
  // (~430 KB wasm) loads only when this panel opens.
  import { live } from '../lib/preview/live.svelte'

  let { features }: { features: { calt: boolean; liga: boolean; ss01: boolean } } = $props()

  type HB = typeof import('harfbuzzjs')
  type Shaped = { name: string; path: string; x: number; adv: number; kind: 'alt' | 'liga' | 'missing' | 'plain' }

  let open = $state(false)
  let hb = $state.raw<HB | null>(null)
  let loadError = $state<string | null>(null)
  let text = $state('hello lilly, the office tattoo needs a little effort')

  $effect(() => {
    if (!open || hb) return
    import('harfbuzzjs')
      .then(m => (hb = m))
      .catch(err => (loadError = String(err)))
  })

  const font = $derived.by(() => {
    if (!hb || !live.buffer) return null
    const face = new hb.Face(new hb.Blob(live.buffer))
    return { face, font: new hb.Font(face), upem: face.upem }
  })

  const shaped = $derived.by((): { glyphs: Shaped[]; width: number } | null => {
    if (!hb || !font) return null
    const buffer = new hb.Buffer()
    buffer.addText(text)
    buffer.guessSegmentProperties()
    const feats = (['calt', 'liga', 'ss01'] as const).map(f => hb!.Feature.fromString(`${features[f] ? '+' : '-'}${f}`)!)
    hb.shape(font.font, buffer, feats)
    const infos = buffer.getGlyphInfos()
    const pos = buffer.getGlyphPositions()
    let x = 0
    const glyphs = infos.map((g, i) => {
      const name = font.font.glyphName(g.codepoint)
      const kind: Shaped['kind'] = g.codepoint === 0 ? 'missing' : /\.alt\d+$/.test(name) ? 'alt' : /^[^.]+_[^.]+$/.test(name) && !name.startsWith('uni') ? 'liga' : 'plain'
      const out = { name, path: font.font.glyphToPath(g.codepoint), x: x + pos[i].xOffset, adv: pos[i].xAdvance, kind }
      x += pos[i].xAdvance
      return out
    })
    return { glyphs, width: x }
  })

  const counts = $derived({
    alt: shaped?.glyphs.filter(g => g.kind === 'alt').length ?? 0,
    liga: shaped?.glyphs.filter(g => g.kind === 'liga').length ?? 0,
  })
</script>

<section class="strip panel" class:open>
  <button class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
    <span>Test strip</span>
    <small>HarfBuzz shaping · alternates <i class="key alt"></i> ligatures <i class="key liga"></i></small>
    <span aria-hidden="true">{open ? '▴' : '▾'}</span>
  </button>
  {#if open}
    <div class="body">
      <input bind:value={text} aria-label="Test strip text" maxlength="300" />
      {#if loadError}
        <p class="note">Could not load HarfBuzz: {loadError}</p>
      {:else if !hb}
        <p class="note">Loading HarfBuzz…</p>
      {:else if !shaped}
        <p class="note">Draw a few letters first.</p>
      {:else}
        {@const upem = font!.upem}
        <div class="scroll">
          <svg
            data-testid="test-strip"
            height="96"
            width={(shaped.width / upem) * 72 + 16}
            viewBox="-8 {-upem * 0.85} {shaped.width + 16} {upem * 1.15}"
            role="img"
            aria-label="Shaped test text"
          >
            {#each shaped.glyphs as g}
              {#if g.kind !== 'plain'}
                <rect class={g.kind} x={g.x} y={-upem * 0.8} width={g.adv} height={upem * 1.05} rx="12" data-glyph={g.name} />
              {/if}
              <path d={g.path} transform="translate({g.x} 0) scale(1 -1)" />
            {/each}
          </svg>
        </div>
        <p class="note" data-testid="test-strip-summary">
          {counts.alt} alternate{counts.alt === 1 ? '' : 's'} · {counts.liga} ligature{counts.liga === 1 ? '' : 's'} ·
          <span class="names">{shaped.glyphs.map(g => g.name).join(' ')}</span>
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .strip {
    margin: 16px 0 4px;
    padding: 0;
    overflow: hidden;
  }
  .toggle {
    display: flex;
    gap: 12px;
    align-items: center;
    width: 100%;
    padding: 10px 14px;
    background: none;
    border: 0;
    text-align: left;
    cursor: pointer;
    font-weight: 600;
  }
  .toggle small {
    flex: 1;
    font-weight: 400;
    opacity: 0.75;
  }
  .key {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: var(--border-w) solid var(--fg);
    border-radius: 3px;
    vertical-align: -1px;
  }
  .key.alt,
  rect.alt {
    background: var(--cyan);
    fill: var(--cyan);
  }
  .key.liga,
  rect.liga {
    background: var(--pink);
    fill: var(--pink);
  }
  rect.missing {
    fill: var(--accent);
  }
  .body {
    border-top: var(--border);
    padding: 12px 14px;
    display: grid;
    gap: 10px;
  }
  .scroll {
    overflow-x: auto;
  }
  svg path {
    fill: var(--fg);
  }
  rect + path {
    fill: var(--on-accent);
  }
  .note {
    margin: 0;
    font-size: 0.85rem;
  }
  .names {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    opacity: 0.75;
    word-break: break-word;
  }
</style>

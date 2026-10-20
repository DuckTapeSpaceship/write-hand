<script lang="ts">
  // HarfBuzz-shaped test text from the live preview font, drawn from the
  // shaper's own glyph outlines and positions. Highlights show where calt
  // picked an alternate (cyan) and where a ligature formed (pink). Letters not
  // drawn yet are set in the system font rather than as .notdef boxes.
  import { live } from '../lib/preview/live.svelte'

  let { features }: { features: { calt: boolean; liga: boolean; ss01: boolean } } = $props()

  type HB = typeof import('harfbuzzjs')
  type Shaped = { name: string; path: string; ch: string; x: number; adv: number; kind: 'alt' | 'liga' | 'missing' | 'plain' }

  let hb = $state.raw<HB | null>(null)
  let loadError = $state<string | null>(null)
  let text = $state('hello lilly, the office tattoo needs a little effort')

  $effect(() => {
    if (hb) return
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
      const ch = String.fromCodePoint(text.codePointAt(g.cluster) ?? 32)
      const out = { name, path: font.font.glyphToPath(g.codepoint), ch, x: x + pos[i].xOffset, adv: pos[i].xAdvance, kind }
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

<section class="strip panel">
  <input bind:value={text} aria-label="Test strip text" maxlength="300" />
  {#if loadError}
    <p class="note">Could not load HarfBuzz: {loadError}</p>
  {:else if !hb}
    <p class="note">Loading…</p>
  {:else if !shaped}
    <p class="note">Draw a letter to see it here.</p>
  {:else}
    {@const upem = font!.upem}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable region must be keyboard-reachable) -->
    <div class="scroll" tabindex="0" role="region" aria-label="Test strip">
      <svg
        data-testid="test-strip"
        height="96"
        width={(shaped.width / upem) * 72 + 16}
        viewBox="-8 {-upem * 0.85} {shaped.width + 16} {upem * 1.15}"
        role="img"
        aria-label="Shaped test text"
      >
        {#each shaped.glyphs as g}
          {#if g.kind === 'missing'}
            <text x={g.x + g.adv / 2} y="0" font-size={upem * 0.6} text-anchor="middle">{g.ch}</text>
          {:else}
            {#if g.kind !== 'plain'}
              <rect class={g.kind} x={g.x} y={-upem * 0.8} width={g.adv} height={upem * 1.05} rx="12" data-glyph={g.name} />
            {/if}
            <path d={g.path} transform="translate({g.x} 0) scale(1 -1)" />
          {/if}
        {/each}
      </svg>
    </div>
    <p class="note" data-testid="test-strip-summary" data-glyphs={shaped.glyphs.map(g => g.name).join(' ')}>
      <i class="key alt"></i>
      {counts.alt} alternate{counts.alt === 1 ? '' : 's'} · <i class="key liga"></i>
      {counts.liga} ligature{counts.liga === 1 ? '' : 's'}
    </p>
  {/if}
</section>

<style>
  .strip {
    margin: 16px 0 4px;
    padding: 12px 14px;
    display: grid;
    gap: 10px;
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
  svg text {
    fill: var(--fg);
    opacity: 0.45;
    font-family: system-ui, sans-serif;
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
</style>

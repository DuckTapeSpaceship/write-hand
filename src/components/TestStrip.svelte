<script lang="ts">
  // The sentence box: the one sentence the app previews (the header shows the
  // same text, collapsed to a line, once this box scrolls away). Shaped by
  // HarfBuzz from the live preview font and drawn from the shaper's own glyph
  // outlines and positions. Highlights show where calt picked an alternate
  // (cyan) and where a ligature formed (pink). Letters not drawn yet are set
  // in the system font and jump to their cell when tapped.
  import { DECOMPOSE } from '../lib/font/compose'
  import { SLOT_BY_ID } from '../lib/model/charset'
  import { FEATURE_TAGS, type Features } from '../lib/preview/features'
  import { live } from '../lib/preview/live.svelte'
  import { PRESETS } from '../lib/preview/sentences'
  import PreviewLine from './PreviewLine.svelte'

  let {
    text = $bindable(),
    auto = $bindable(),
    features = $bindable(),
    has,
    onmissing,
  }: {
    text: string
    auto: boolean
    features: Features
    has: (ch: string) => boolean
    onmissing: (ch: string) => void
  } = $props()

  type HB = typeof import('harfbuzzjs')
  type Shaped = { name: string; path: string; ch: string; x: number; adv: number; kind: 'alt' | 'liga' | 'missing' | 'plain' }

  let hb = $state.raw<HB | null>(null)
  let loadError = $state<string | null>(null)

  const choice = $derived(auto ? 'auto' : (PRESETS.find(p => p.text === text)?.label ?? 'custom'))

  function pick(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value
    if (v === 'auto') auto = true
    else if (v !== 'custom') {
      auto = false
      text = PRESETS.find(p => p.label === v)!.text
    }
  }

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
    if (!hb || !font || !text.trim()) return null
    const buffer = new hb.Buffer()
    buffer.addText(text)
    buffer.guessSegmentProperties()
    const feats = FEATURE_TAGS.map(f => hb!.Feature.fromString(`${features[f] ? '+' : '-'}${f}`)!)
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

  const known = (ch: string) => SLOT_BY_ID.has(ch) || ch in DECOMPOSE
</script>

<section class="strip panel" data-testid="strip">
  <div class="controls">
    <input
      class="sentence"
      value={text}
      oninput={e => {
        auto = false
        text = e.currentTarget.value
      }}
      aria-label="Sentence"
      maxlength="200"
    />
    <select value={choice} onchange={pick} aria-label="Sentence preset">
      <option value="auto">Auto</option>
      {#each PRESETS as p}<option value={p.label}>{p.label}</option>{/each}
      <option value="custom" disabled>Custom</option>
    </select>
  </div>

  {#if shaped}
    {@const upem = font!.upem}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable region must be keyboard-reachable) -->
    <div class="scroll" tabindex="0" role="region" aria-label="Shaped sentence">
      <svg
        data-testid="test-strip"
        height="96"
        width={(shaped.width / upem) * 72 + 16}
        viewBox="-8 {-upem * 0.85} {shaped.width + 16} {upem * 1.15}"
        role="group"
        aria-label={text}
      >
        {#each shaped.glyphs as g}
          {#if g.kind === 'missing'}
            {#if known(g.ch)}
              <g
                class="missing"
                role="button"
                tabindex="0"
                aria-label="Draw {g.ch}"
                onclick={() => onmissing(g.ch)}
                onkeydown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onmissing(g.ch))}
              >
                <title>Draw “{g.ch}”</title>
                <rect x={g.x} y={-upem * 0.8} width={g.adv} height={upem * 1.05} rx="12" />
                <text x={g.x + g.adv / 2} y="0" font-size={upem * 0.6} text-anchor="middle">{g.ch}</text>
              </g>
            {:else}
              <text class="unknown" x={g.x + g.adv / 2} y="0" font-size={upem * 0.6} text-anchor="middle">{g.ch}</text>
            {/if}
          {:else}
            {#if g.kind !== 'plain'}
              <rect class={g.kind} x={g.x} y={-upem * 0.8} width={g.adv} height={upem * 1.05} rx="12" data-glyph={g.name} />
            {/if}
            <path d={g.path} transform="translate({g.x} 0) scale(1 -1)" />
          {/if}
        {/each}
      </svg>
    </div>
  {:else}
    <PreviewLine {text} {has} {features} {onmissing} />
  {/if}

  <div class="foot">
    <p class="note" data-testid="test-strip-summary" data-glyphs={shaped?.glyphs.map(g => g.name).join(' ') ?? ''}>
      <i class="key alt"></i>
      {counts.alt} alternate{counts.alt === 1 ? '' : 's'} · <i class="key liga"></i>
      {counts.liga} ligature{counts.liga === 1 ? '' : 's'}
    </p>
    <div class="feats" role="group" aria-label="OpenType features">
      {#each FEATURE_TAGS as f}
        <label title={f === 'calt' ? 'Cycle alternates' : f === 'liga' ? 'Ligatures' : 'Alternates off'}>
          <input type="checkbox" bind:checked={features[f]} />
          {f}
        </label>
      {/each}
    </div>
  </div>
  {#if loadError}
    <p class="note err">Could not load HarfBuzz: {loadError}</p>
  {/if}
  {#if live.error}
    <p class="note err">Build error: {live.error}</p>
  {/if}
</section>

<style>
  .strip {
    margin: 16px 0 4px;
    padding: 12px 14px;
    display: grid;
    gap: 10px;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
  .sentence {
    flex: 1;
    min-width: 0;
  }
  .scroll {
    overflow-x: auto;
  }
  .scroll:focus-visible {
    outline-offset: -3px;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 6px 16px;
  }
  .feats {
    display: flex;
    gap: 12px;
    font-size: 0.85rem;
  }
  .feats label {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-family: var(--font-mono);
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
  svg path {
    fill: var(--fg);
  }
  rect + path {
    fill: var(--on-accent);
  }
  svg text {
    font-family: var(--font-ui);
  }
  .missing {
    cursor: pointer;
  }
  .missing rect {
    fill: color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .missing text {
    fill: var(--on-accent);
  }
  .missing:focus-visible {
    outline: none;
  }
  .missing:focus-visible rect {
    stroke: var(--fg);
    stroke-width: 16;
  }
  .unknown {
    fill: var(--fg);
    opacity: 0.45;
  }
  .note {
    margin: 0;
    font-size: 0.85rem;
  }
  .err {
    background: var(--red);
    color: var(--on-accent);
    padding: 0 6px;
    border-radius: var(--radius);
  }
</style>

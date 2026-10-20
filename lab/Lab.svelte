<script lang="ts">
  import { onDestroy } from 'svelte'
  import sample from '../tests/fixtures/strokes/sample.json'
  import { ENGINES, ENGINE_IDS, type EngineId } from '../src/lib/engines'
  import { contourStats } from '../src/lib/engines/types'
  import { applySyntheticPressure, SYNTHETIC_CURVES, type SyntheticCurve } from '../src/lib/engines/pressure'
  import { DEFAULT_METRICS } from '../src/lib/model/metrics'
  import { PEN_PRESETS, type Pen, type PenStyle, type PressureMode, type Stroke } from '../src/lib/model/project'
  import { FaceSwapper } from '../src/lib/preview/fontface'
  import { BuildClient, type BuildResult } from '../src/lib/worker/client'
  import GlyphView from './GlyphView.svelte'
  import Recorder from './Recorder.svelte'

  type LabSlot = { strokes: Stroke[]; rev: number }
  type StrokeFile = { format: 'write-hand-strokes'; version: 1; slots: Record<string, { strokes: Stroke[] }> }

  const STORE = 'write-hand-lab-v1'
  const SIZES = [16, 48, 200]

  function fromFile(f: StrokeFile): Record<string, LabSlot> {
    const out: Record<string, LabSlot> = {}
    for (const [id, s] of Object.entries(f.slots)) out[id] = { strokes: s.strokes, rev: 1 }
    return out
  }

  function load(): { slots: Record<string, LabSlot>; selected: string; pen: Pen; text: string } {
    try {
      const raw = localStorage.getItem(STORE)
      if (raw) return JSON.parse(raw)
    } catch {
      // fall through to the sample set
    }
    return { slots: fromFile(sample as StrokeFile), selected: 'l', pen: { ...PEN_PRESETS.fineliner }, text: 'hello lilly · off to a dandy tea' }
  }

  const initial = load()
  let slots = $state<Record<string, LabSlot>>(initial.slots)
  let selected = $state(initial.selected)
  let pen = $state<Pen>(initial.pen)
  let text = $state(initial.text)
  let feats = $state({ calt: true, liga: true, ss01: false })
  let curve = $state<SyntheticCurve>('taper')
  let showNodes = $state(true)
  let showPoints = $state(false)
  let newSlot = $state('')
  let live = $state({ pointer: '-', pressure: 0 })
  let theme = $state<'dark' | 'light' | 'auto'>('auto')

  const clients = Object.fromEntries(ENGINE_IDS.map(id => [id, new BuildClient(200)])) as Record<EngineId, BuildClient>
  const faces = Object.fromEntries(ENGINE_IDS.map(id => [id, new FaceSwapper(`WH Lab ${id}`)])) as Record<EngineId, FaceSwapper>
  let results = $state<Partial<Record<EngineId, BuildResult>>>({})
  let busy = $state<Partial<Record<EngineId, boolean>>>({})
  let errors = $state<Partial<Record<EngineId, string>>>({})
  let faceGen = $state<Partial<Record<EngineId, number>>>({})
  // Last measured (uncached) outline time per engine+slot.
  let timing = $state<Record<string, number>>({})
  let fresh = false

  const ids = $derived(Object.keys(slots).sort((a, b) => a.localeCompare(b)))
  const current = $derived(slots[selected]?.strokes ?? [])
  const featureCss = $derived(`"calt" ${feats.calt ? 1 : 0}, "liga" ${feats.liga ? 1 : 0}, "ss01" ${feats.ss01 ? 1 : 0}`)

  function rebuild() {
    const snapshot = $state.snapshot(slots)
    const req = {
      family: 'Lab',
      metrics: DEFAULT_METRICS,
      pen: $state.snapshot(pen),
      slots: Object.entries(snapshot).map(([id, s]) => ({ id, strokes: s.strokes, rev: s.rev })),
      outlinesFor: [selected],
      fresh,
    }
    fresh = false
    for (const id of ENGINE_IDS) {
      busy[id] = true
      clients[id]
        .request({ ...req, engine: id })
        .then(async res => {
          if (!res) return
          busy[id] = false
          errors[id] = ''
          results[id] = res
          for (const st of res.stats) if (!st.cached) timing[`${id}:${st.id}`] = st.ms
          if (await faces[id].swap(res.buffer)) faceGen[id] = (faceGen[id] ?? 0) + 1
        })
        .catch(err => {
          busy[id] = false
          errors[id] = String(err.message ?? err)
        })
    }
  }

  $effect(() => {
    void [slots, pen.size, pen.thinning, pen.smoothing, pen.streamline, pen.taper, pen.pressure, selected]
    rebuild()
  })

  $effect(() => {
    const data = JSON.stringify({ slots, selected, pen, text })
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORE, data)
      } catch {
        // storage full: the lab keeps working without persistence
      }
    }, 400)
    return () => clearTimeout(t)
  })

  $effect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  })

  onDestroy(() => {
    for (const id of ENGINE_IDS) {
      clients[id].terminate()
      faces[id].clear()
    }
  })

  function setStrokes(id: string, strokes: Stroke[]) {
    const prev = slots[id]
    slots[id] = { strokes, rev: (prev?.rev ?? 0) + 1 }
  }

  function addStroke(s: Stroke) {
    setStrokes(selected, [...current, s])
  }

  function undo() {
    if (current.length) setStrokes(selected, current.slice(0, -1))
  }

  function clearSlot() {
    setStrokes(selected, [])
  }

  function bake(all: boolean) {
    for (const id of all ? ids : [selected]) {
      setStrokes(id, slots[id].strokes.map(s => applySyntheticPressure(s, curve)))
    }
  }

  function strip() {
    setStrokes(
      selected,
      current.map(s => ({ pointer: 'mouse', pts: s.pts.map((v, i) => (i % 4 === 2 ? 0.5 : v)) })),
    )
  }

  function addSlot() {
    const id = newSlot.trim()
    if (!id) return
    if (!slots[id]) slots[id] = { strokes: [], rev: 0 }
    selected = id
    newSlot = ''
  }

  function removeSlot() {
    if (!confirm(`Delete slot "${selected}"?`)) return
    delete slots[selected]
    selected = ids.find(i => i !== selected) ?? 'a'
  }

  function loadSample() {
    if (!confirm('Replace all lab slots with the sample set?')) return
    slots = fromFile(sample as StrokeFile)
    selected = 'l'
  }

  function save() {
    const file: StrokeFile = { format: 'write-hand-strokes', version: 1, slots: {} }
    for (const id of ids) file.slots[id] = { strokes: $state.snapshot(slots[id].strokes) }
    const blob = new Blob([JSON.stringify(file, null, 0) + '\n'], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `write-hand-strokes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function open(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    try {
      const json = JSON.parse(await f.text()) as StrokeFile
      if (json.format !== 'write-hand-strokes' || typeof json.slots !== 'object') throw new Error('not a write-hand strokes file')
      slots = fromFile(json)
      selected = ids[0] ?? 'a'
    } catch (err) {
      alert(`Could not load: ${err instanceof Error ? err.message : err}`)
    }
  }

  function preset(style: PenStyle) {
    pen = { ...PEN_PRESETS[style], pressure: pen.pressure }
  }

  function measure() {
    fresh = true
    rebuild()
  }

  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault()
      undo()
    }
  }

  const fmt = (ms: number | undefined) => (ms === undefined ? '–' : ms < 10 ? ms.toFixed(1) : Math.round(ms).toString())
  const kb = (n: number | undefined) => (n ? (n / 1024).toFixed(1) + ' KB' : '–')
</script>

<svelte:window onkeydown={onKey} />

<main class="lab">
  <header class="top">
    <h1>Engine lab <small>P0 · Gate 1</small></h1>
    <p class="hint">
      Draw or load strokes, then compare engines <b>A</b> (fontify trace, as-is), <b>A′</b> (trace + pressure) and
      <b>B</b> (vector). Dev-only page: not part of the build.
    </p>
    <div class="row">
      <button class="btn" onclick={() => (theme = theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}>
        Theme: {theme}
      </button>
    </div>
  </header>

  <section class="panel rec">
    <h2>Recorder</h2>
    <div class="chips" role="listbox" aria-label="slots">
      {#each ids as id (id)}
        <button
          class="chip"
          class:active={id === selected}
          class:empty={!slots[id].strokes.length}
          role="option"
          aria-selected={id === selected}
          onclick={() => (selected = id)}>{id}</button
        >
      {/each}
      <form
        class="add"
        onsubmit={e => {
          e.preventDefault()
          addSlot()
        }}
      >
        <input bind:value={newSlot} placeholder="new slot (a, a.alt1, f_f)" size="16" aria-label="new slot id" />
        <button class="btn" type="submit">Add</button>
      </form>
    </div>

    <Recorder strokes={current} {pen} {showPoints} onadd={addStroke} onsample={s => (live = s)} />

    <div class="row small">
      <span>slot <b>{selected}</b> · {current.length} strokes · {current.reduce((n, s) => n + s.pts.length / 4, 0)} pts</span>
      <span>pointer <b>{live.pointer}</b> · pressure <b>{live.pressure.toFixed(2)}</b></span>
    </div>
    <div class="row">
      <button class="btn" onclick={undo} disabled={!current.length}>Undo stroke</button>
      <button class="btn danger" onclick={clearSlot} disabled={!current.length}>Clear slot</button>
      <button class="btn" onclick={removeSlot}>Delete slot</button>
      <label class="check"><input type="checkbox" bind:checked={showPoints} /> points</label>
    </div>

    <h3>Synthetic pressure</h3>
    <div class="row">
      <select bind:value={curve} aria-label="synthetic curve">
        {#each SYNTHETIC_CURVES as c}<option value={c}>{c}</option>{/each}
      </select>
      <button class="btn" onclick={() => bake(false)} disabled={!current.length}>Bake into slot</button>
      <button class="btn" onclick={() => bake(true)}>Bake into all</button>
      <button class="btn" onclick={strip} disabled={!current.length}>Strip pressure</button>
    </div>

    <h3>Pen (A′ and B)</h3>
    <div class="row">
      {#each Object.keys(PEN_PRESETS) as style}
        <button class="btn" class:primary={pen.style === style} onclick={() => preset(style as PenStyle)}>{style}</button>
      {/each}
    </div>
    <div class="sliders">
      <label>size <input type="range" min="20" max="160" bind:value={pen.size} /> <span>{pen.size}</span></label>
      <label>thinning <input type="range" min="-0.5" max="0.95" step="0.05" bind:value={pen.thinning} /> <span>{pen.thinning}</span></label>
      <label>smoothing <input type="range" min="0" max="1" step="0.05" bind:value={pen.smoothing} /> <span>{pen.smoothing}</span></label>
      <label>streamline <input type="range" min="0" max="0.95" step="0.05" bind:value={pen.streamline} /> <span>{pen.streamline}</span></label>
      <label>taper <input type="range" min="0" max="1" step="0.05" bind:value={pen.taper} /> <span>{pen.taper}</span></label>
      <label
        >pressure
        <select bind:value={pen.pressure as PressureMode}>
          <option value="auto">auto (real if pen, else simulated)</option>
          <option value="real">real</option>
          <option value="simulated">simulated</option>
          <option value="none">none (uniform)</option>
        </select>
      </label>
    </div>

    <h3>Strokes file</h3>
    <div class="row">
      <button class="btn" onclick={save}>Save JSON</button>
      <label class="btn">Load JSON <input type="file" accept="application/json,.json" onchange={open} hidden /></label>
      <button class="btn" onclick={loadSample}>Load sample set</button>
    </div>
  </section>

  <section class="panel cmp">
    <div class="row spread">
      <h2>Compare · slot “{selected}”</h2>
      <div class="row">
        <label class="check"><input type="checkbox" bind:checked={showNodes} /> nodes</label>
        <button class="btn" onclick={measure}>Re-time (no cache)</button>
      </div>
    </div>

    {#each ENGINE_IDS as id (id)}
      {@const r = results[id]}
      {@const contours = r?.outlines[selected] ?? []}
      {@const st = contourStats(contours)}
      <article class="engine" data-engine={id}>
        <header class="row spread">
          <h3>{ENGINES[id].label} {#if busy[id]}<span class="busy">building…</span>{/if}</h3>
          <dl class="stats">
            <div><dt>glyph</dt><dd>{fmt(timing[`${id}:${selected}`])} ms</dd></div>
            <div><dt>font</dt><dd>{fmt(r?.totalMs)} ms</dd></div>
            <div><dt>nodes</dt><dd>{st.nodes}</dd></div>
            <div><dt>points</dt><dd>{st.points}</dd></div>
            <div><dt>contours</dt><dd>{st.contours}</dd></div>
            <div><dt>OTF</dt><dd>{kb(r?.buffer?.byteLength)}</dd></div>
          </dl>
        </header>
        {#if errors[id]}<pre class="err">{errors[id]}</pre>{/if}
        <div class="glyphs">
          {#each SIZES as px}
            <figure>
              <GlyphView {contours} {px} />
              <figcaption>{px}px</figcaption>
            </figure>
          {/each}
          {#if showNodes}
            <figure>
              <GlyphView {contours} px={300} nodes guides />
              <figcaption>outline + nodes</figcaption>
            </figure>
          {/if}
        </div>
        {#key faceGen[id]}
          <div class="texts" style:font-family="'WH Lab {id}', serif" style:font-feature-settings={featureCss}>
            {#each SIZES as px}
              <p style:font-size="{px}px">{text}</p>
            {/each}
          </div>
        {/key}
      </article>
    {/each}

    <div class="row sample">
      <input bind:value={text} aria-label="sample text" />
      {#each ['calt', 'liga', 'ss01'] as const as f}
        <label class="check"><input type="checkbox" bind:checked={feats[f]} /> {f}</label>
      {/each}
    </div>
    <p class="hint">
      Text uses each engine's real OTF via FontFace (with GSUB). Undrawn characters fall back to serif. “hello lilly”
      exercises <code>calt</code> cycling to <code>l.alt1</code>; “off” uses the <code>f_f</code> ligature.
    </p>
  </section>
</main>

<style>
  .lab {
    max-width: 1500px;
    margin: 0 auto;
    padding: 16px;
    display: grid;
    grid-template-columns: minmax(300px, 480px) 1fr;
    gap: 20px;
    align-items: start;
  }
  .top {
    grid-column: 1 / -1;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 1.6rem;
  }
  h1 small {
    font-weight: 400;
    font-size: 0.9rem;
    opacity: 0.7;
  }
  h2 {
    margin: 0 0 10px;
    font-size: 1.15rem;
  }
  h3 {
    margin: 14px 0 6px;
    font-size: 0.95rem;
  }
  .panel {
    padding: 14px;
    min-width: 0;
  }
  .rec {
    position: sticky;
    top: 12px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }
  .spread {
    justify-content: space-between;
  }
  .small {
    font-size: 0.85rem;
    justify-content: space-between;
  }
  .hint {
    font-size: 0.85rem;
    opacity: 0.8;
    margin: 4px 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .chip {
    min-width: 34px;
    padding: 2px 8px;
    background: var(--bg);
    color: var(--fg);
    border: var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-family: var(--font-mono);
  }
  .chip.empty {
    border-style: dashed;
    opacity: 0.7;
  }
  .chip.active {
    background: var(--accent);
    color: var(--on-accent);
  }
  .add {
    display: flex;
    gap: 6px;
  }
  .check {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 0.9rem;
  }
  .sliders {
    display: grid;
    gap: 4px;
    font-size: 0.85rem;
  }
  .sliders label {
    display: grid;
    grid-template-columns: 80px 1fr 40px;
    align-items: center;
    gap: 6px;
  }
  .sliders select {
    grid-column: 2 / 4;
  }
  .engine {
    border-top: var(--border);
    padding: 10px 0 14px;
  }
  .engine h3 {
    margin: 0;
  }
  .busy {
    font-size: 0.75rem;
    background: var(--orange);
    color: var(--on-accent);
    padding: 1px 6px;
    border-radius: var(--radius);
  }
  .stats {
    display: flex;
    gap: 14px;
    margin: 0;
    font-size: 0.8rem;
  }
  .stats dt {
    opacity: 0.7;
  }
  .stats dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
  }
  .glyphs {
    display: flex;
    gap: 18px;
    align-items: flex-end;
    flex-wrap: wrap;
    margin: 8px 0;
  }
  figure {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 4px;
  }
  figcaption {
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .texts {
    overflow-x: auto;
    border: var(--border);
    border-radius: var(--radius);
    padding: 4px 10px;
  }
  .texts p {
    margin: 0;
    line-height: 1.25;
    white-space: nowrap;
  }
  .sample input:not([type='checkbox']) {
    flex: 1;
    min-width: 200px;
  }
  .err {
    background: var(--red);
    color: var(--on-accent);
    padding: 8px;
    white-space: pre-wrap;
    font-size: 0.75rem;
  }
  @media (max-width: 900px) {
    .lab {
      grid-template-columns: 1fr;
    }
    .rec {
      position: static;
    }
  }
</style>

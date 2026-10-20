<script lang="ts">
  import type { Contour } from '../src/lib/engines/types'
  import { contoursToSvgPath } from '../src/lib/engines/types'
  import { cellBox, DEFAULT_METRICS, type Metrics } from '../src/lib/model/metrics'

  let {
    contours,
    px,
    metrics = DEFAULT_METRICS,
    nodes = false,
    guides = false,
  }: { contours: Contour[]; px: number; metrics?: Metrics; nodes?: boolean; guides?: boolean } = $props()

  const cell = $derived(cellBox(metrics))
  const d = $derived(contoursToSvgPath(contours))
  const unit = $derived(cell.width / px) // font units per css px

  const handles = $derived.by(() => {
    if (!nodes) return { on: [] as number[][], off: [] as number[][], lines: [] as number[][] }
    const on: number[][] = []
    const off: number[][] = []
    const lines: number[][] = []
    for (const c of contours) {
      let px0 = 0, py0 = 0
      for (const cmd of c) {
        if (cmd.type === 'C') {
          off.push([cmd.x1, cmd.y1], [cmd.x2, cmd.y2])
          lines.push([px0, py0, cmd.x1, cmd.y1], [cmd.x, cmd.y, cmd.x2, cmd.y2])
        } else if (cmd.type === 'Q') {
          off.push([cmd.x1, cmd.y1])
          lines.push([px0, py0, cmd.x1, cmd.y1], [cmd.x, cmd.y, cmd.x1, cmd.y1])
        }
        on.push([cmd.x, cmd.y])
        px0 = cmd.x
        py0 = cmd.y
      }
    }
    return { on, off, lines }
  })
</script>

<svg
  class="glyph"
  width={px}
  height={px}
  viewBox="{cell.left} {-cell.top} {cell.width} {cell.top - cell.bottom}"
  role="img"
  aria-label="glyph outline"
>
  <g transform="scale(1,-1)">
    {#if guides}
      {#each [metrics.xHeight, metrics.capHeight] as y}
        <line x1={cell.left} x2={cell.left + cell.width} y1={y} y2={y} class="guide" stroke-width={unit} stroke-dasharray="{4 * unit} {4 * unit}" />
      {/each}
      <line x1={cell.left} x2={cell.left + cell.width} y1="0" y2="0" class="base" stroke-width={unit} />
    {/if}
    <path {d} class:outline={nodes} fill-rule="nonzero" stroke-width={unit} />
    {#if nodes}
      {#each handles.lines as [x1, y1, x2, y2]}
        <line {x1} {y1} {x2} {y2} class="handle" stroke-width={unit} />
      {/each}
      {#each handles.off as [x, y]}
        <rect x={x - 2 * unit} y={y - 2 * unit} width={4 * unit} height={4 * unit} class="off" />
      {/each}
      {#each handles.on as [x, y]}
        <circle cx={x} cy={y} r={2.6 * unit} class="on" />
      {/each}
    {/if}
  </g>
</svg>

<style>
  .glyph {
    display: block;
    flex: none;
  }
  path {
    fill: var(--fg);
  }
  path.outline {
    fill: color-mix(in srgb, var(--fg) 18%, transparent);
    stroke: var(--fg);
  }
  .guide {
    stroke: var(--comment);
  }
  .base {
    stroke: var(--comment);
  }
  .handle {
    stroke: var(--cyan);
  }
  .off {
    fill: var(--cyan);
  }
  .on {
    fill: var(--accent);
    stroke: var(--bg);
  }
</style>

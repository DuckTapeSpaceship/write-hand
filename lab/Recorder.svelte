<script lang="ts">
  import { freehandPolygon } from '../src/lib/engines/freehand'
  import { StrokeBuilder, pointerKind } from '../src/lib/input/pointer'
  import { cellBox, DEFAULT_METRICS, type Metrics } from '../src/lib/model/metrics'
  import type { Pen, Stroke } from '../src/lib/model/project'

  let {
    strokes,
    pen,
    metrics = DEFAULT_METRICS,
    showPoints = false,
    onadd,
    onsample,
  }: {
    strokes: Stroke[]
    pen: Pen
    metrics?: Metrics
    showPoints?: boolean
    onadd: (s: Stroke) => void
    onsample?: (info: { pointer: string; pressure: number }) => void
  } = $props()

  let canvas: HTMLCanvasElement
  let builder: StrokeBuilder | null = null
  let cssSize = $state(480)
  const cell = $derived(cellBox(metrics))

  function toFont(cx: number, cy: number): [number, number] {
    const r = canvas.getBoundingClientRect()
    return [cell.left + ((cx - r.left) / r.width) * cell.width, cell.top - ((cy - r.top) / r.height) * (cell.top - cell.bottom)]
  }

  function color(name: string): string {
    return getComputedStyle(canvas).getPropertyValue(name).trim() || '#888'
  }

  function redraw() {
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(cssSize * dpr)
    if (canvas.width !== w) {
      canvas.width = w
      canvas.height = w
    }
    const ctx = canvas.getContext('2d')!
    const k = w / cell.width
    ctx.setTransform(k, 0, 0, -k, -cell.left * k, cell.top * k) // font units, y up
    ctx.clearRect(cell.left, cell.bottom, cell.width, cell.top - cell.bottom)

    const line = (y: number, dashed: boolean) => {
      ctx.beginPath()
      ctx.setLineDash(dashed ? [8 / k, 8 / k] : [])
      ctx.moveTo(cell.left, y)
      ctx.lineTo(cell.left + cell.width, y)
      ctx.stroke()
    }
    ctx.lineWidth = 1.5 / k
    ctx.strokeStyle = color('--comment')
    line(metrics.capHeight, true)
    line(metrics.xHeight, true)
    line(0, false)
    ctx.setLineDash([])

    ctx.fillStyle = color('--fg')
    const all = builder ? [...strokes, builder.finish()] : strokes
    for (const s of all) {
      const poly = freehandPolygon(s, pen)
      if (poly.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(poly[0][0], poly[0][1])
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1])
      ctx.closePath()
      ctx.fill()
    }
    if (showPoints) {
      ctx.fillStyle = color('--accent')
      for (const s of all) {
        for (let i = 0; i < s.pts.length; i += 4) {
          const r = (1.5 + s.pts[i + 2] * 3) / k
          ctx.beginPath()
          ctx.arc(s.pts[i], s.pts[i + 1], r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  $effect(() => {
    // Track everything the drawing depends on.
    void [strokes, pen.size, pen.thinning, pen.smoothing, pen.streamline, pen.taper, pen.pressure, showPoints, cssSize]
    redraw()
  })

  $effect(() => {
    const ro = new ResizeObserver(([entry]) => {
      cssSize = Math.max(200, Math.round(entry.contentRect.width))
    })
    ro.observe(canvas)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const theme = new MutationObserver(redraw)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    mq.addEventListener('change', redraw)
    return () => {
      ro.disconnect()
      theme.disconnect()
      mq.removeEventListener('change', redraw)
    }
  })

  function down(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic events (tests) have no active pointer to capture.
    }
    builder = new StrokeBuilder(pointerKind(e), toFont, e.timeStamp)
    builder.add(e, true)
    onsample?.({ pointer: e.pointerType, pressure: e.pressure })
    redraw()
  }

  function move(e: PointerEvent) {
    if (!builder) return
    if (builder.add(e)) redraw()
    onsample?.({ pointer: e.pointerType, pressure: e.pressure })
  }

  function up() {
    if (!builder) return
    const s = builder.finish()
    builder = null
    onadd(s)
  }
</script>

<canvas
  bind:this={canvas}
  class="recorder"
  data-testid="recorder"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  oncontextmenu={e => e.preventDefault()}
></canvas>

<style>
  .recorder {
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    border: var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    background: var(--bg);
    cursor: crosshair;
  }
</style>

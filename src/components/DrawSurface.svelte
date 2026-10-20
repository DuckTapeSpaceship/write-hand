<script lang="ts">
  // A square drawing canvas in font units. Shared by grid cells and the write
  // view. Pointer handling follows the input rule (lib/input/mode): mouse and
  // pen draw; a finger draws or taps depending on `touch`. A long press (550 ms,
  // < 6 px) discards the in-progress dot and opens the menu instead. In the
  // grid, a second finger turns the gesture into a page scroll.
  import { freehandPolygon } from '../lib/engines/freehand'
  import { LongPressTracker } from '../lib/input/longpress'
  import type { TouchPolicy } from '../lib/input/mode.svelte'
  import { pointerKind, StrokeBuilder } from '../lib/input/pointer'
  import { armTwoFingerScroll, onTwoFingerScroll, twoFingerScrolling } from '../lib/input/twofinger'
  import { cellBox, type Metrics } from '../lib/model/metrics'
  import type { Pen, Stroke } from '../lib/model/project'

  let {
    strokes,
    pen,
    metrics,
    touch = 'draw',
    label = 'drawing area',
    ghosts = [],
    twoFingerScroll = false,
    onstroke,
    onlongpress,
    ontap,
    onpen,
  }: {
    strokes: Stroke[]
    pen: Pen
    metrics: Metrics
    touch?: TouchPolicy
    label?: string
    /** Neighbouring glyphs drawn faintly at the edges, for consistent size and baseline. */
    ghosts?: { strokes: Stroke[]; side: 'left' | 'right' }[]
    twoFingerScroll?: boolean
    onstroke: (s: Stroke) => void
    onlongpress?: (at: { x: number; y: number }) => void
    ontap?: () => void
    onpen?: () => void
  } = $props()

  let canvas: HTMLCanvasElement
  let cssSize = $state(0)
  let builder: StrokeBuilder | null = null
  let tapping = false
  let penHover = $state(false)
  const cell = $derived(cellBox(metrics))
  const press = new LongPressTracker(() => {
    builder = null
    tapping = false
    redraw()
    onlongpress?.(lastPos)
  })
  let lastPos = { x: 0, y: 0 }

  const touchAction = $derived(touch === 'draw' || penHover ? 'none' : 'pan-y')

  function toFont(cx: number, cy: number): [number, number] {
    const r = canvas.getBoundingClientRect()
    return [cell.left + ((cx - r.left) / r.width) * cell.width, cell.top - ((cy - r.top) / r.height) * (cell.top - cell.bottom)]
  }

  function cssVar(name: string): string {
    return getComputedStyle(canvas).getPropertyValue(name).trim() || '#888'
  }

  function redraw() {
    if (!canvas || !cssSize) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(cssSize * dpr)
    if (canvas.width !== w) {
      canvas.width = w
      canvas.height = w
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, w)
    const k = w / cell.width

    ctx.setTransform(k, 0, 0, -k, -cell.left * k, cell.top * k) // font units, y up
    for (const g of ghosts) drawGhost(ctx, g.strokes, g.side)
    const line = (y: number, dashed: boolean) => {
      ctx.beginPath()
      ctx.setLineDash(dashed ? [6 / k, 6 / k] : [])
      ctx.moveTo(cell.left, y)
      ctx.lineTo(cell.left + cell.width, y)
      ctx.stroke()
    }
    ctx.lineWidth = 1 / k
    ctx.strokeStyle = cssVar('--comment')
    line(metrics.capHeight, true)
    line(metrics.xHeight, true)
    ctx.lineWidth = 1.5 / k
    line(0, false)
    ctx.setLineDash([])

    ctx.fillStyle = cssVar('--fg')
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
  }

  $effect(() => {
    void [strokes, pen, metrics, cssSize, ghosts]
    redraw()
  })

  /** A neighbour, shifted so its ink just peeks in from the cell edge. */
  function drawGhost(ctx: CanvasRenderingContext2D, ghost: Stroke[], side: 'left' | 'right') {
    let minX = Infinity, maxX = -Infinity
    for (const s of ghost) for (let i = 0; i < s.pts.length; i += 4) {
      minX = Math.min(minX, s.pts[i])
      maxX = Math.max(maxX, s.pts[i])
    }
    if (!Number.isFinite(minX)) return
    const r = pen.size / 2
    const dx = side === 'left' ? cell.left + cell.width * 0.16 - (maxX + r) : cell.left + cell.width * 0.84 - (minX - r)
    ctx.save()
    ctx.translate(dx, 0)
    ctx.globalAlpha = 0.22
    ctx.fillStyle = cssVar('--fg')
    for (const s of ghost) {
      const poly = freehandPolygon(s, pen)
      if (poly.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(poly[0][0], poly[0][1])
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1])
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  $effect(() => {
    const ro = new ResizeObserver(([e]) => (cssSize = e.contentRect.width))
    ro.observe(canvas)
    const theme = new MutationObserver(redraw)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', redraw)
    // iOS: a stylus touch must not scroll the page even where fingers may.
    const blockStylus = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if ((t as Touch & { touchType?: string }).touchType === 'stylus') {
          e.preventDefault()
          return
        }
      }
    }
    canvas.addEventListener('touchstart', blockStylus, { passive: false })
    const unpan = twoFingerScroll ? onTwoFingerScroll(cancel) : null
    return () => {
      unpan?.()
      ro.disconnect()
      theme.disconnect()
      mq.removeEventListener('change', redraw)
      canvas.removeEventListener('touchstart', blockStylus)
    }
  })

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const kind = pointerKind(e)
    if (kind === 'pen') onpen?.()
    lastPos = { x: e.clientX, y: e.clientY }
    press.start(e.clientX, e.clientY, e.timeStamp)

    if (kind === 'touch' && touch === 'tap') {
      // Let the browser scroll; a short, still press is a tap.
      tapping = true
      return
    }
    if (kind === 'touch' && twoFingerScroll) {
      if (twoFingerScrolling()) return press.cancel()
      armTwoFingerScroll()
    }
    e.preventDefault()
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic events (tests) have no active pointer to capture.
    }
    builder = new StrokeBuilder(kind, toFont, e.timeStamp)
    builder.add(e, true)
    redraw()
  }

  function move(e: PointerEvent) {
    if (!builder && !tapping) return
    lastPos = { x: e.clientX, y: e.clientY }
    press.move(e.clientX, e.clientY)
    if (builder?.add(e)) redraw()
  }

  function up(e: PointerEvent) {
    const kind = press.end(e.timeStamp)
    if (tapping) {
      tapping = false
      if (kind === 'tap') ontap?.()
      return
    }
    if (!builder) return
    const s = builder.finish()
    builder = null
    if (kind !== 'long') onstroke(s)
  }

  function cancel() {
    press.cancel()
    tapping = false
    if (builder) {
      builder = null
      redraw()
    }
  }

  function enter(e: PointerEvent) {
    if (e.pointerType === 'pen') penHover = true
  }
  function leave(e: PointerEvent) {
    if (e.pointerType === 'pen') penHover = false
  }
</script>

<canvas
  bind:this={canvas}
  class="surface"
  style:touch-action={touchAction}
  aria-label={label}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={cancel}
  onpointerenter={enter}
  onpointerleave={leave}
></canvas>

<style>
  .surface {
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    overscroll-behavior: none;
    cursor: crosshair;
  }
</style>

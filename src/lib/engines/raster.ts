// Canvas source for the raster engines (A, A′). OffscreenCanvas in workers and
// modern browsers, a DOM canvas as fallback, and an injectable factory so Node
// tests can supply @napi-rs/canvas.

export interface RasterCanvas {
  width: number
  height: number
  getContext(type: '2d', opts?: { willReadFrequently?: boolean }): unknown
}

type Factory = (w: number, h: number) => RasterCanvas

let factory: Factory | null = null

export function setCanvasFactory(f: Factory | null): void {
  factory = f
}

export function createRasterCanvas(w: number, h: number): RasterCanvas {
  if (factory) return factory(w, h)
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h) as unknown as RasterCanvas
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c as unknown as RasterCanvas
  }
  throw new Error('No canvas available for the raster engines')
}

/** The subset of CanvasRenderingContext2D the engines use (napi-rs compatible). */
export interface Ctx2D {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  lineCap: string
  lineJoin: string
  fillRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  stroke(): void
  fill(rule?: 'nonzero' | 'evenodd'): void
  getImageData(x: number, y: number, w: number, h: number): { width: number; height: number; data: Uint8ClampedArray }
}

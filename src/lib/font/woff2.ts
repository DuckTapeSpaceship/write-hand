// WOFF2 for the web: Google's woff2 compiled to wasm (woff2-encoder, ~1 MB),
// loaded only when someone asks for it, in a worker of its own (see
// woff2.worker.ts for why).
export function toWoff2(otf: ArrayBuffer, timeoutMs = 30_000): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/woff2.worker.ts', import.meta.url), { type: 'module' })
    const done = (fn: () => void) => {
      clearTimeout(timer)
      worker.terminate()
      fn()
    }
    const timer = setTimeout(() => done(() => reject(new Error('WOFF2 compression timed out'))), timeoutMs)
    worker.onmessage = (e: MessageEvent<{ ok: true; data: ArrayBuffer } | { ok: false; error: string }>) =>
      done(() => (e.data.ok ? resolve(new Uint8Array(e.data.data)) : reject(new Error(e.data.error))))
    worker.onerror = e => done(() => reject(new Error(e.message || 'WOFF2 worker failed')))
    const copy = otf.slice(0)
    worker.postMessage(copy, [copy])
  })
}

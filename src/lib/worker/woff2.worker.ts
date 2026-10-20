/// <reference lib="webworker" />
// WOFF2 compression in its own worker. The encoder (Google's woff2 via
// Emscripten embind) needs eval, so this script is served with a CSP that
// allows it (docker/Caddyfile) while the page itself keeps a strict policy.
import { compress } from 'woff2-encoder'

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const out = new Uint8Array(await compress(e.data))
    ;(self as unknown as DedicatedWorkerGlobalScope).postMessage({ ok: true, data: out.buffer }, [out.buffer])
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

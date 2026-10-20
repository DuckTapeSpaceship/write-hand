// Writes .br and .gz siblings for every compressible file in dist/, so the
// container's Caddy serves them (`file_server { precompressed br gzip }`)
// instead of compressing on each request. Without this, every cache miss on
// the 1 MB WOFF2 worker (e.g. a `?x=N` cache-buster) costs ~25 ms of CPU.
// Runs after `vite build`; the service worker's precache list is already
// written by then and only matches the original extensions.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const DIST = new URL('../dist/', import.meta.url).pathname
const COMPRESSIBLE = /\.(js|mjs|css|html|wasm|json|webmanifest|svg|ttf|txt)$/
const MIN_BYTES = 1024

let count = 0
for (const entry of readdirSync(DIST, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !COMPRESSIBLE.test(entry.name)) continue
  const path = join(entry.parentPath, entry.name)
  const data = readFileSync(path)
  if (data.length < MIN_BYTES) continue
  writeFileSync(`${path}.br`, brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } }))
  writeFileSync(`${path}.gz`, gzipSync(data, { level: 9 }))
  count++
}
console.log(`precompress: ${count} files -> .br + .gz`)

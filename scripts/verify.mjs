// npm run verify: build the fixture fonts, then run the OpenType Sanitizer
// (the same checker Chrome and Firefox use) on each one.
// OTS comes from PyPI's opentype-sanitizer via uv; it has no console script,
// so it runs as `python -m ots`.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// OTS drops a table it can't validate (e.g. a bad GSUB) and still reports
// success, so compare table directories before and after.
function tableTags(path) {
  const b = readFileSync(path)
  const n = b.readUInt16BE(4)
  const tags = []
  for (let i = 0; i < n; i++) tags.push(b.toString('latin1', 12 + i * 16, 16 + i * 16))
  return tags.sort()
}

const dir = 'tests/.out/fonts'
execFileSync('npx', ['vitest', 'run', 'tests/integration'], { stdio: 'inherit' })

const fonts = readdirSync(dir).filter(f => /\.(otf|ttf|woff2?)$/.test(f)).sort()
if (!fonts.length) {
  console.error('no fonts in', dir)
  process.exit(1)
}
const outDir = 'tests/.out/ots'
mkdirSync(outDir, { recursive: true })
let failed = 0
for (const f of fonts) {
  const src = join(dir, f)
  const dst = join(outDir, f)
  const r = spawnSync('uv', ['run', '--quiet', '--no-project', '--with', 'opentype-sanitizer', 'python', '-m', 'ots', src, dst], {
    encoding: 'utf8',
  })
  let out = (r.stdout + r.stderr).trim()
  let ok = r.status === 0
  if (ok && f.endsWith('.woff2')) {
    // WOFF2 has its own table directory; OTS writes plain OTF, so check that
    // the outline and layout tables made it through.
    const after = tableTags(dst)
    const missing = ['CFF ', 'GSUB', 'GPOS', 'cmap'].filter(t => !after.includes(t))
    if (missing.length) {
      ok = false
      out += `\nmissing after OTS: ${missing.join(', ')}`
    }
  } else if (ok) {
    const before = tableTags(src)
    const after = new Set(tableTags(dst))
    const dropped = before.filter(t => !after.has(t))
    if (dropped.length) {
      ok = false
      out += `\nOTS dropped: ${dropped.join(', ')}`
    }
  }
  if (!ok) failed++
  const tags = f.endsWith('.woff2') ? (ok ? tableTags(dst) : []) : tableTags(src)
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${f}  [${tags.join(' ')}]${ok ? '' : '\n' + out.replace(/^/gm, '     ')}`)
}
console.log(`\nOTS: ${fonts.length - failed}/${fonts.length} fonts sanitized`)
process.exit(failed ? 1 : 0)

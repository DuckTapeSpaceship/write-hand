import { DEFAULT_METRICS } from '../model/metrics'
import { PEN_PRESETS, type Project, type Slot, type Stroke } from '../model/project'

export const DEFAULT_SAMPLE = 'Hello! This is my handwriting.'

export function newProject(): Project {
  return { schema: 2, name: 'My Handwriting', metrics: { ...DEFAULT_METRICS }, pen: { ...PEN_PRESETS.fineliner }, slots: {}, sample: DEFAULT_SAMPLE }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function cleanStroke(s: unknown): Stroke | null {
  if (!s || typeof s !== 'object') return null
  const { pts, pointer } = s as Stroke
  if (!Array.isArray(pts) || pts.length < 4 || pts.length % 4 || !pts.every(isNum)) return null
  return { pts, pointer: pointer === 'pen' || pointer === 'touch' ? pointer : 'mouse' }
}

/** Validate and upgrade anything that claims to be a project. Throws on garbage. */
export function migrate(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new Error('not a Write-Hand project')
  const r = raw as Partial<Project> & { schema?: number }
  if (r.schema !== 2) throw new Error(`unsupported project schema ${String(r.schema)}`)
  const base = newProject()
  const slots: Record<string, Slot> = {}
  for (const [id, s] of Object.entries(r.slots ?? {})) {
    if (!s || typeof s !== 'object') continue
    const strokes = (Array.isArray(s.strokes) ? s.strokes : []).map(cleanStroke).filter((x): x is Stroke => !!x)
    if (!strokes.length) continue
    slots[id] = { id, kind: s.kind ?? 'base', unicode: s.unicode, strokes, rev: isNum(s.rev) ? s.rev : 1 }
  }
  return {
    schema: 2,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 64) : base.name,
    metrics: { ...base.metrics, ...(r.metrics ?? {}) },
    pen: { ...base.pen, ...(r.pen ?? {}) },
    slots,
    sample: typeof r.sample === 'string' ? r.sample : base.sample,
  }
}

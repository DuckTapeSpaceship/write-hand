import type { Project } from '../model/project'
import { migrate } from './migrate'

export function slugify(name: string, fallback = 'Write-Hand'): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 _-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return s || fallback
}

export function downloadBlob(filename: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// --- project files (.writehand.json) ---

export const PROJECT_FORMAT = 'write-hand-project'

export function projectFileText(p: Project, appVersion: string): string {
  return JSON.stringify({ format: PROJECT_FORMAT, version: 1, app: appVersion, exportedAt: new Date().toISOString(), project: p }) + '\n'
}

/** Accepts our wrapped format or a bare schema-2 project. Throws on anything else. */
export function parseProjectFile(text: string): Project {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('That file is not JSON.')
  }
  const j = json as { format?: string; project?: unknown }
  if (j && j.format === PROJECT_FORMAT) return migrate(j.project)
  return migrate(json)
}

import { expect, type Locator, type Page } from '@playwright/test'

export type Pt = [number, number] // fractions of the canvas box

export const ZIGZAG: Pt[] = [
  [0.3, 0.3],
  [0.4, 0.6],
  [0.5, 0.35],
  [0.6, 0.65],
  [0.7, 0.3],
]

/** Dispatch a full stroke as real PointerEvents (pen pressure ramps 0.2 → 0.9). */
export async function stroke(canvas: Locator, pts: Pt[] = ZIGZAG, pointerType: 'pen' | 'mouse' | 'touch' = 'pen') {
  await canvas.scrollIntoViewIfNeeded()
  await canvas.evaluate(
    (el, { pts, pointerType }) => {
      const r = el.getBoundingClientRect()
      const steps: [number, number, number][] = []
      for (let i = 0; i < pts.length - 1; i++) {
        for (let k = 0; k < 6; k++) {
          const t = k / 6
          steps.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, 0])
        }
      }
      steps.push([...pts[pts.length - 1], 0])
      steps.forEach((s, i) => (s[2] = 0.2 + (0.7 * i) / Math.max(1, steps.length - 1)))
      const fire = (type: string, [fx, fy, p]: [number, number, number]) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 11,
            pointerType,
            isPrimary: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            pressure: pointerType === 'pen' ? (type === 'pointerup' ? 0 : p) : type === 'pointerup' ? 0 : 0.5,
            clientX: r.left + r.width * fx,
            clientY: r.top + r.height * fy,
          }),
        )
      fire('pointerdown', steps[0])
      for (const s of steps.slice(1)) fire('pointermove', s)
      fire('pointerup', steps[steps.length - 1])
    },
    { pts, pointerType },
  )
}

/** pointerdown, hold, pointerup without moving. */
export async function press(canvas: Locator, holdMs: number, pointerType: 'pen' | 'mouse' | 'touch' = 'pen') {
  await canvas.scrollIntoViewIfNeeded()
  const fire = (type: string) =>
    canvas.evaluate(
      (el, { type, pointerType }) => {
        const r = el.getBoundingClientRect()
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 12,
            pointerType,
            isPrimary: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            pressure: type === 'pointerup' ? 0 : 0.5,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
          }),
        )
      },
      { type, pointerType },
    )
  await fire('pointerdown')
  if (holdMs) await canvas.page().waitForTimeout(holdMs)
  await fire('pointerup')
}

export const cell = (page: Page, id: string) => page.locator(`[data-slot="${id}"]`)
export const cellCanvas = (page: Page, id: string) => cell(page, id).locator('canvas')

export async function freshApp(page: Page, opts: { onboarded?: boolean } = {}) {
  // Clear storage from a same-origin page that isn't running the app, so its
  // pagehide flush can't write the old project back.
  await page.goto('/theme.js')
  await page.evaluate(async onboarded => {
    localStorage.clear()
    if (onboarded) localStorage.setItem('wh-onboarded', '1')
    await new Promise<void>(res => {
      const r = indexedDB.deleteDatabase('write-hand')
      r.onsuccess = r.onerror = r.onblocked = () => res()
    })
  }, opts.onboarded ?? true)
  await page.goto('/')
  await expect(cell(page, 'a')).toBeVisible()
}

export async function setSentence(page: Page, text: string) {
  const input = page.getByLabel('Preview sentence')
  if (!(await input.isVisible())) await page.getByRole('button', { name: 'Edit sentence' }).click() // phone
  await input.fill(text)
}

/** Pixels of a canvas, for before/after comparisons. */
export const canvasData = (canvas: Locator) => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())

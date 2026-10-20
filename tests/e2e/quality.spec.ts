import { expect, test } from '@playwright/test'
import { canvasData, cell, cellCanvas, freshApp, setSentence, stroke } from './helpers'

const kind = () => {
  const n = test.info().project.name
  return n === 'pixel7' || n === 'iphone15' ? 'phone' : n === 'ipad' ? 'tablet' : 'desktop'
}

test.beforeEach(async ({ page }) => {
  await freshApp(page)
})

test('accents tier: e + acute mark composes é in the preview', async ({ page }) => {
  await setSentence(page, 'é')
  await expect(page.locator('[data-testid="preview"] .missing')).toHaveCount(1)
  await stroke(cellCanvas(page, 'e'))
  await page.getByRole('tab', { name: /Accents/ }).click()
  await stroke(cellCanvas(page, 'mark.acute'), [
    [0.45, 0.25],
    [0.6, 0.12],
  ])
  await expect(page.locator('[data-testid="preview"] .missing')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.fonts.check("40px 'WH Preview'", 'é')), { timeout: 15_000 }).toBe(true)
})

test('a missing accented letter jumps to the part still to draw', async ({ page }) => {
  test.skip(kind() === 'phone', 'phones open the write view instead')
  await stroke(cellCanvas(page, 'n'))
  await setSentence(page, 'ñ')
  await page.locator('[data-testid="preview"] .missing').click()
  await expect(page.getByRole('tab', { name: /Accents/ })).toHaveAttribute('aria-selected', 'true')
  await expect(cell(page, 'mark.tilde')).toBeFocused()
})

test('pen style and weight re-render the strokes', async ({ page }) => {
  await stroke(cellCanvas(page, 'a'))
  const before = await canvasData(cellCanvas(page, 'a'))
  await page.getByRole('button', { name: 'Pen and layout settings' }).click()
  await page.getByRole('radio', { name: 'marker' }).click()
  await expect(page.getByRole('radio', { name: 'marker' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => canvasData(cellCanvas(page, 'a'))).not.toBe(before)
  await page.reload()
  await page.getByRole('button', { name: 'Pen and layout settings' }).click()
  await expect(page.getByRole('radio', { name: 'marker' })).toHaveAttribute('aria-checked', 'true') // saved with the project
})

test('cell size L makes cells bigger', async ({ page }) => {
  const before = (await cellCanvas(page, 'a').boundingBox())!.width
  await page.getByRole('button', { name: 'Pen and layout settings' }).click()
  await page.getByRole('radio', { name: 'L', exact: true }).click()
  await expect.poll(async () => (await cellCanvas(page, 'a').boundingBox())!.width).toBeGreaterThan(before + 10)
})

test('write view: ghost neighbours, x-height handle, prev/next', async ({ page }) => {
  await stroke(cellCanvas(page, 'a'))
  await stroke(cellCanvas(page, 'c'))
  // Open b via its cell menu (works for every pointer type).
  await cell(page, 'b').locator('.head').dispatchEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 })
  await page.getByRole('menuitem', { name: 'Open large editor' }).click()
  const dialog = page.getByRole('dialog', { name: 'Write b' })
  await expect(dialog).toBeVisible()
  // Ghosts: the empty b canvas still shows ink from a and c at its edges.
  const inked = await dialog.locator('canvas').evaluate(el => {
    const c = el as HTMLCanvasElement
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    const col = (x0: number, x1: number) => {
      let n = 0
      for (let y = 0; y < c.height; y += 2) for (let x = x0; x < x1; x += 2) if (d[(y * c.width + x) * 4 + 3] > 20) n++
      return n
    }
    return { left: col(0, Math.floor(c.width * 0.15)), right: col(Math.ceil(c.width * 0.85), c.width) }
  })
  expect(inked.left).toBeGreaterThan(20)
  expect(inked.right).toBeGreaterThan(20)

  const xh = dialog.getByRole('slider', { name: 'x-height' })
  await expect(xh).toHaveAttribute('aria-valuenow', '420')
  await xh.focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(xh).toHaveAttribute('aria-valuenow', '430')
  await page.keyboard.press('ArrowRight') // focus is on the slider: ←/→ still change slot
  await expect(page.getByRole('dialog', { name: 'Write c' })).toBeVisible()
})

test('phone: compact bar, preview expands on tap and folds away on scroll', async ({ page }) => {
  test.skip(kind() !== 'phone')
  const header = page.locator('header.top')
  const vh = page.viewportSize()!.height
  expect((await header.boundingBox())!.height).toBeLessThan(vh * 0.32)
  await expect(page.getByLabel('Preview sentence')).toBeHidden()
  await page.getByTestId('preview').locator('.missing').first().click() // a letter tap still jumps
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Edit sentence' }).click()
  await expect(page.getByLabel('Preview sentence')).toBeVisible()
  await expect(page.getByLabel('Font name')).toBeVisible()
  await page.evaluate(() => scrollBy(0, 400))
  await expect(page.getByLabel('Preview sentence')).toBeHidden()
})

test('landscape phone: write view puts the canvas beside the controls', async ({ page }) => {
  test.skip(kind() !== 'phone')
  const vp = page.viewportSize()!
  await page.setViewportSize({ width: vp.height, height: vp.width })
  await cell(page, 'a').locator('.head').dispatchEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 })
  await page.getByRole('menuitem', { name: 'Open large editor' }).click()
  const dialog = page.getByRole('dialog', { name: 'Write a' })
  const canvas = (await dialog.locator('.canvas').boundingBox())!
  const done = (await dialog.getByRole('button', { name: 'Done' }).boundingBox())!
  expect(canvas.x).toBeGreaterThan(done.x + done.width - 1)
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(vp.width + 1)
})

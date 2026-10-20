import { expect, test } from '@playwright/test'
import { canvasData, cell, cellCanvas, expectTier, freshApp, pickTier, setSentence, stroke } from './helpers'

const kind = () => {
  const n = test.info().project.name
  return n === 'pixel7' || n === 'iphone15' ? 'phone' : n === 'ipad' ? 'tablet' : 'desktop'
}

test.beforeEach(async ({ page }) => {
  await freshApp(page)
})

test('accents tier: e + acute mark composes é in the preview', async ({ page }) => {
  await setSentence(page, 'é')
  await expect(page.locator('[data-testid="strip"] .missing')).toHaveCount(1)
  await stroke(cellCanvas(page, 'e'))
  await pickTier(page, 'accents', 'Accents')
  await stroke(cellCanvas(page, 'mark.acute'), [
    [0.45, 0.25],
    [0.6, 0.12],
  ])
  await expect(page.locator('[data-testid="strip"] .missing')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.fonts.check("40px 'WH Preview'", 'é')), { timeout: 15_000 }).toBe(true)
})

test('a missing accented letter jumps to the part still to draw', async ({ page }) => {
  await stroke(cellCanvas(page, 'n'))
  await setSentence(page, 'ñ')
  await page.locator('[data-testid="strip"] .missing').click()
  await expectTier(page, 'accents', 'Accents')
  await expect(cell(page, 'mark.tilde')).toBeFocused()
})

test('pen style and weight re-render the strokes', async ({ page }) => {
  await stroke(cellCanvas(page, 'a'))
  const before = await canvasData(cellCanvas(page, 'a'))
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'marker' }).click()
  await expect(page.getByRole('radio', { name: 'marker' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => canvasData(cellCanvas(page, 'a'))).not.toBe(before)
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('radio', { name: 'marker' })).toHaveAttribute('aria-checked', 'true') // saved with the project
})

test('cell size L makes cells bigger', async ({ page }) => {
  const before = (await cellCanvas(page, 'a').boundingBox())!.width
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'L', exact: true }).click()
  await expect.poll(async () => (await cellCanvas(page, 'a').boundingBox())!.width).toBeGreaterThan(before + 10)
})

test('write view: ghost neighbours, x-height handle, prev/next', async ({ page }) => {
  await stroke(cellCanvas(page, 'a'))
  await stroke(cellCanvas(page, 'c'))
  // Open b via its cell menu (works for every pointer type).
  await cell(page, 'b').locator('.head').dispatchEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 })
  await page.getByRole('menuitem', { name: 'Enlarge' }).click()
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

test('the sentence box collapses into the header line on scroll, and back on tap', async ({ page }) => {
  expect((await page.locator('header.top').boundingBox())!.height).toBeLessThan(60)
  await setSentence(page, 'Zq')
  await expect(page.getByTestId('preview-line')).toHaveCount(0)
  await page.evaluate(() => scrollTo(0, 900))
  const line = page.getByTestId('preview-line')
  await expect(line).toBeVisible()
  await expect(line.locator('.missing')).toHaveCount(2) // the same sentence
  const box = (await line.boundingBox())!
  await page.mouse.click(box.x + box.width - 20, box.y + box.height / 2) // no auto-scroll: that would un-collapse it
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await expect(line).toHaveCount(0)
})

test('landscape phone: write view puts the canvas beside the controls', async ({ page }) => {
  test.skip(kind() !== 'phone')
  const vp = page.viewportSize()!
  await page.setViewportSize({ width: vp.height, height: vp.width })
  await cell(page, 'a').locator('.head').dispatchEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 })
  await page.getByRole('menuitem', { name: 'Enlarge' }).click()
  const dialog = page.getByRole('dialog', { name: 'Write a' })
  const canvas = (await dialog.locator('.canvas').boundingBox())!
  const done = (await dialog.getByRole('button', { name: 'Done' }).boundingBox())!
  expect(canvas.x).toBeGreaterThan(done.x + done.width - 1)
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(vp.width + 1)
})

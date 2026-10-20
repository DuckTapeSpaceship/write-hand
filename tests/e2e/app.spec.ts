import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { parse } from 'opentype.js'
import { cell, cellCanvas, freshApp, press, setSentence, stroke } from './helpers'

const kind = () => {
  const n = test.info().project.name
  return n === 'pixel7' || n === 'iphone15' ? 'phone' : n === 'ipad' ? 'tablet' : 'desktop'
}

test.beforeEach(async ({ page }) => {
  await freshApp(page)
})

test('pen stroke with changing pressure draws H and the preview stops marking it missing', async ({ page }) => {
  await setSentence(page, 'HH')
  await expect(page.locator('[data-testid="preview"] .missing')).toHaveCount(2)
  await stroke(cellCanvas(page, 'H'))
  await expect(cell(page, 'H')).toHaveClass(/filled/)
  await expect(page.locator('[data-testid="preview"] .missing')).toHaveCount(0, { timeout: 15_000 })
  await expect
    .poll(() => page.locator('[data-testid="preview"]').evaluate(el => getComputedStyle(el).fontFamily), { timeout: 15_000 })
    .toContain('WH Preview')
  expect(await page.evaluate(() => document.fonts.check("48px 'WH Preview'", 'H'))).toBe(true)
})

test('strokes survive a reload (IndexedDB)', async ({ page }) => {
  await stroke(cellCanvas(page, 'a'))
  await stroke(cellCanvas(page, 'a'), [
    [0.2, 0.8],
    [0.8, 0.8],
  ])
  await expect(cell(page, 'a')).toHaveClass(/filled/)
  await page.reload() // immediately: inside the autosave debounce
  await expect(cell(page, 'a')).toHaveClass(/filled/)
  await cell(page, 'a').click({ button: 'right', force: true, position: { x: 20, y: 10 } })
  await page.getByRole('menuitem', { name: 'Undo last stroke' }).click()
  await expect(cell(page, 'a')).toHaveClass(/filled/) // one stroke left
})

test('right-click → Clear empties the cell; the toast Undo restores it', async ({ page }) => {
  test.skip(kind() !== 'desktop', 'mouse context menu')
  await stroke(cellCanvas(page, 'b'), undefined, 'mouse')
  await expect(cell(page, 'b')).toHaveClass(/filled/)
  await cellCanvas(page, 'b').click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'Clear cell' }).click()
  await expect(cell(page, 'b')).not.toHaveClass(/filled/)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(cell(page, 'b')).toHaveClass(/filled/)
})

test('long-press → Clear empties the cell; a short tap leaves a dot', async ({ page }) => {
  test.skip(kind() === 'phone', 'phones open the write view on tap')
  await press(cellCanvas(page, 'i'), 0) // the dot
  await expect(cell(page, 'i')).toHaveClass(/filled/)
  await press(cellCanvas(page, 'i'), 800)
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'Clear cell' }).click()
  await expect(cell(page, 'i')).not.toHaveClass(/filled/)
})

test('visible × clears, keyboard undo and Delete work on a focused cell', async ({ page }) => {
  test.skip(kind() !== 'desktop', 'keyboard')
  await stroke(cellCanvas(page, 'c'))
  await stroke(cellCanvas(page, 'c'))
  await cell(page, 'c').focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(cell(page, 'c')).toHaveClass(/filled/)
  await page.keyboard.press('Delete')
  await expect(cell(page, 'c')).not.toHaveClass(/filled/)
  await stroke(cellCanvas(page, 'd'))
  await cell(page, 'd').getByRole('button', { name: 'Clear d' }).click()
  await expect(cell(page, 'd')).not.toHaveClass(/filled/)
})

test('download is gated on the Required tier, then yields a parseable OTF', async ({ page }) => {
  test.skip(kind() !== 'desktop', 'one download run is enough')
  const dl = page.getByTestId('download')
  await expect(dl).toBeDisabled()
  await expect(page.getByText('67 required left')).toBeVisible()
  const ids = await page.locator('[data-slot]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.slot!))
  for (const id of ids) await stroke(cellCanvas(page, id))
  await expect(dl).toBeEnabled()
  await page.getByLabel('Font name').fill('Test Hand')
  const [download] = await Promise.all([page.waitForEvent('download'), dl.click()])
  expect(download.suggestedFilename()).toBe('Test-Hand.otf')
  const buf = readFileSync((await download.path())!)
  const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  expect(font.names.fontFamily.en).toBe('Test Hand')
  for (const ch of 'aZ9?!.,\'') expect(font.charToGlyph(ch).index, ch).toBeGreaterThan(1)
})

test('cells meet the minimum size for the breakpoint', async ({ page }) => {
  const box = (await cellCanvas(page, 'a').boundingBox())!
  const min = { phone: 140, tablet: 170, desktop: 160 }[kind()]
  expect(box.width).toBeGreaterThanOrEqual(min - 4) // minus borders
})

test('phone: grid scrolls with a finger, tap opens the write view', async ({ page, browserName }) => {
  test.skip(kind() !== 'phone')
  await expect(cellCanvas(page, 'a')).toHaveCSS('touch-action', 'pan-y')
  if (browserName === 'chromium') {
    // Real touch input through the compositor, so touch-action is honoured.
    const cdp = await page.context().newCDPSession(page)
    const swipe = async (x: number, y0: number, dy: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (dy * i) / 12 }] })
        await page.waitForTimeout(16)
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    const box = (await cellCanvas(page, 'a').boundingBox())!
    const y = Math.min(box.y + box.height / 2, page.viewportSize()!.height - 40)
    await swipe(box.x + box.width / 2, y, -350)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200)
    await expect(page.locator('.cell.filled')).toHaveCount(0) // the swipe drew nothing
  }
  await press(cellCanvas(page, 'g'), 0, 'touch')
  const dialog = page.getByRole('dialog', { name: 'Write g' })
  await expect(dialog).toBeVisible()
  await stroke(dialog.locator('canvas'), undefined, 'touch')
  await expect(cell(page, 'g')).toHaveClass(/filled/)
  await dialog.getByRole('button', { name: 'Next character' }).click()
  await expect(page.getByRole('dialog', { name: 'Write h' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('tablet: finger draws until a pen is seen, then fingers scroll and tap', async ({ page }) => {
  test.skip(kind() !== 'tablet')
  await expect(cellCanvas(page, 'a')).toHaveCSS('touch-action', 'none')
  await stroke(cellCanvas(page, 'a'), undefined, 'touch')
  await expect(cell(page, 'a')).toHaveClass(/filled/)
  await stroke(cellCanvas(page, 'b'), undefined, 'pen')
  await expect(cellCanvas(page, 'c')).toHaveCSS('touch-action', 'pan-y')
  await stroke(cellCanvas(page, 'c'), undefined, 'touch') // a finger swipe no longer draws
  await expect(cell(page, 'c')).not.toHaveClass(/filled/)
  await press(cellCanvas(page, 'c'), 0, 'touch')
  await expect(page.getByRole('dialog', { name: 'Write c' })).toBeVisible()
})

test('tapping a missing letter jumps to its cell', async ({ page }) => {
  await setSentence(page, 'Zq')
  await page.locator('[data-testid="preview"] .missing', { hasText: 'Z' }).click()
  if (kind() === 'phone') await expect(page.getByRole('dialog', { name: 'Write Z' })).toBeVisible()
  else await expect(cell(page, 'Z')).toBeFocused()
})

test('screenshots in both themes', async ({ page }) => {
  for (const ch of 'Hello') await stroke(cellCanvas(page, ch))
  await page.evaluate(() => scrollTo(0, 0))
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}-${scheme}.png` })
  }
})

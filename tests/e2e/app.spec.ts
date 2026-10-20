import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { parse } from 'opentype.js'
import { cell, cellCanvas, freshApp, press, setSentence, setTheme, stroke } from './helpers'

const kind = () => {
  const n = test.info().project.name
  return n === 'pixel7' || n === 'iphone15' ? 'phone' : n === 'ipad' ? 'tablet' : 'desktop'
}

test.beforeEach(async ({ page }) => {
  await freshApp(page)
})

test('pen stroke with changing pressure draws H and the preview stops marking it missing', async ({ page }) => {
  await setSentence(page, 'HH')
  await expect(page.locator('[data-testid="strip"] .missing')).toHaveCount(2)
  await stroke(cellCanvas(page, 'H'))
  await expect(cell(page, 'H')).toHaveClass(/filled/)
  await expect(page.locator('[data-testid="strip"] .missing')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByTestId('test-strip')).toBeVisible() // shaped from the built font
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
  await page.getByRole('menuitem', { name: 'Undo' }).click()
  await expect(cell(page, 'a')).toHaveClass(/filled/) // one stroke left
})

test('right-click → Clear empties the cell; the toast Undo restores it', async ({ page }) => {
  test.skip(kind() !== 'desktop', 'mouse context menu')
  await stroke(cellCanvas(page, 'b'), undefined, 'mouse')
  await expect(cell(page, 'b')).toHaveClass(/filled/)
  await cellCanvas(page, 'b').click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'Clear' }).click()
  await expect(cell(page, 'b')).not.toHaveClass(/filled/)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(cell(page, 'b')).toHaveClass(/filled/)
})

test('long-press → Clear empties the cell; a short tap leaves a dot', async ({ page }) => {
  await press(cellCanvas(page, 'i'), 0) // the dot
  await expect(cell(page, 'i')).toHaveClass(/filled/)
  await press(cellCanvas(page, 'i'), 800)
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'Clear' }).click()
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

test('export: gated on Required, then OTF + WOFF2; project file round-trips', async ({ page }) => {
  test.skip(kind() === 'phone', 'desktop (Chromium) + iPad (WebKit) cover export')
  await page.getByTestId('export').click()
  const dl = page.getByTestId('download')
  await expect(dl).toBeDisabled()
  await expect(page.getByRole('dialog').getByText('67 required left')).toBeVisible()
  await page.getByRole('button', { name: 'Close export' }).click()

  const ids = await page.locator('[data-slot]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.slot!))
  for (const id of ids) await stroke(cellCanvas(page, id))
  // 67 strokes: the backup reminder shows up.
  await expect(page.getByText('Only saved in this browser')).toBeVisible()

  await page.getByTestId('export').click()
  await page.getByRole('dialog').getByLabel('Font name').fill('Test Hand')
  await expect(dl).toBeEnabled()
  const [otf] = await Promise.all([page.waitForEvent('download'), dl.click()])
  expect(otf.suggestedFilename()).toBe('Test-Hand.otf')
  const buf = readFileSync((await otf.path())!)
  const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  expect(font.names.fontFamily.en).toBe('Test Hand')
  for (const ch of "aZ9?!.,'") expect(font.charToGlyph(ch).index, ch).toBeGreaterThan(1)

  const [woff2] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-woff2').click()])
  expect(woff2.suggestedFilename()).toBe('Test-Hand.woff2')
  expect(readFileSync((await woff2.path())!).subarray(0, 4).toString('latin1')).toBe('wOF2')

  const [proj] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-project').click()])
  expect(proj.suggestedFilename()).toBe('Test-Hand.writehand.json')
  const projPath = (await proj.path())!
  await expect(page.getByText('Only saved in this browser')).toBeHidden() // exported: reminder resets

  // Wipe everything, then import the file.
  await page.getByRole('button', { name: 'Close export' }).click()
  await freshApp(page)
  await page.getByTestId('export').click()
  await page.getByTestId('import-project').setInputFiles(projPath)
  await expect(page.getByText(/Imported “Test Hand” · 67 characters/)).toBeVisible()
  await expect(page.locator('.cell.filled')).toHaveCount(67)
})

test('cells meet the minimum size for the breakpoint', async ({ page }) => {
  const box = (await cellCanvas(page, 'a').boundingBox())!
  const min = { phone: 140, tablet: 170, desktop: 160 }[kind()]
  expect(box.width).toBeGreaterThanOrEqual(min - 4) // minus borders
})

test('phone: a finger draws in the grid, two fingers scroll', async ({ page, browserName }) => {
  test.skip(kind() !== 'phone')
  await expect(cellCanvas(page, 'a')).toHaveCSS('touch-action', 'none')
  await stroke(cellCanvas(page, 'g'), undefined, 'touch')
  await expect(cell(page, 'g')).toHaveClass(/filled/)
  await expect(page.getByRole('dialog')).toHaveCount(0) // no write view
  if (browserName === 'chromium') {
    // Real touch input through the compositor, so touch-action is honoured.
    const cdp = await page.context().newCDPSession(page)
    await page.evaluate(() => scrollTo(0, 0))
    const box = (await cellCanvas(page, 'a').boundingBox())!
    const x = box.x + box.width / 2
    const y0 = Math.min(box.y + box.height / 2, page.viewportSize()!.height - 40)
    const at = (dy: number) => [
      { x: x - 20, y: y0 + dy, id: 1 },
      { x: x + 20, y: y0 + dy, id: 2 },
    ]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) })
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at((-300 * i) / 12) })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200)
    await expect(page.locator('.cell.filled')).toHaveCount(1) // the scroll drew nothing
  }
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
  await page.locator('[data-testid="strip"] .missing', { hasText: 'Z' }).click()
  await expect(cell(page, 'Z')).toBeFocused()
})

test('screenshots in both themes', async ({ page }) => {
  for (const ch of 'Hello') await stroke(cellCanvas(page, ch))
  for (const scheme of ['dark', 'light'] as const) {
    await setTheme(page, scheme)
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForTimeout(400)
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}-${scheme}.png` })
  }
})

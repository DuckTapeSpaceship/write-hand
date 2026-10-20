import { expect, test } from '@playwright/test'

test('lab builds every pen row and records pen pressure', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/lab/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (const id of ['fineliner', 'marker', 'brush', 'custom']) {
    const engine = page.locator(`[data-row="${id}"]`)
    await expect(engine.locator('.busy')).toHaveCount(0, { timeout: 30_000 })
    await expect(engine.locator('.stats dd').nth(2)).not.toHaveText('0')
    await expect(engine.locator('.err')).toHaveCount(0)
  }

  // A new slot, drawn with a pen whose pressure ramps up.
  await page.getByLabel('new slot id').fill('z')
  await page.getByRole('button', { name: 'Add' }).click()
  const box = (await page.getByTestId('recorder').boundingBox())!
  await page.getByTestId('recorder').evaluate((el, b) => {
    const fire = (type: string, i: number, pressure: number) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 7,
          pointerType: 'pen',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          pressure,
          clientX: b.x + b.width * (0.3 + i * 0.02),
          clientY: b.y + b.height * (0.3 + i * 0.015),
        }),
      )
    fire('pointerdown', 0, 0.1)
    for (let i = 1; i <= 20; i++) fire('pointermove', i, 0.1 + i * 0.04)
    fire('pointerup', 20, 0)
  }, box)
  await expect(page.getByText(/slot z · 1 strokes/)).toBeVisible()
  await expect(page.getByText(/pointer pen/)).toBeVisible()
  for (const id of ['fineliner', 'marker', 'brush', 'custom']) {
    await expect(page.locator(`[data-row="${id}"] .stats dd`).nth(4)).not.toHaveText('0', { timeout: 30_000 })
  }
  await page.emulateMedia({ colorScheme: 'light' })
  await page.screenshot({ path: 'test-results/screens/lab-light.png', fullPage: true })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: 'test-results/screens/lab-dark.png', fullPage: true })
  expect(errors).toEqual([])
})

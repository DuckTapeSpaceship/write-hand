import { expect, test } from '@playwright/test'
import { cellCanvas, freshApp, stroke } from './helpers'

test.beforeEach(async ({ page }) => {
  await freshApp(page)
})

test('alternates cycle and ligatures form, shown by the HarfBuzz test strip', async ({ page }) => {
  for (const ch of 'lof') await stroke(cellCanvas(page, ch))
  await page.getByRole('tab', { name: /Alternates/ }).click()
  await stroke(cellCanvas(page, 'l.alt1'), [
    [0.4, 0.8],
    [0.5, 0.2],
    [0.6, 0.8],
  ])
  await page.getByRole('tab', { name: /Ligatures/ }).click()
  await stroke(cellCanvas(page, 'f_f'))

  await page.getByRole('button', { name: /Test strip/ }).click()
  await page.getByLabel('Test strip text').fill('lll off')
  const summary = page.getByTestId('test-strip-summary')
  await expect(summary).toContainText('1 alternate · 1 ligature', { timeout: 20_000 })
  await expect(summary).toContainText('l l.alt1 l space o f_f')
  await expect(page.locator('[data-testid="test-strip"] rect.alt')).toHaveCount(1)
  await expect(page.locator('[data-testid="test-strip"] rect.liga')).toHaveCount(1)

  // The preview's feature toggles drive the strip too.
  const expand = page.getByRole('button', { name: 'Edit sentence' })
  if (await expand.isVisible()) await expand.click()
  await page.getByRole('checkbox', { name: 'ss01' }).check()
  await expect(summary).toContainText('0 alternates · 1 ligature')
  await page.getByRole('checkbox', { name: 'liga' }).uncheck()
  await expect(summary).toContainText('l l l space o f f')
})

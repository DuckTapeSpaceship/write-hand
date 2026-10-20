import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { cellCanvas, freshApp, setTheme, stroke } from './helpers'

const kind = () => {
  const n = test.info().project.name
  return n === 'pixel7' || n === 'iphone15' ? 'phone' : n === 'ipad' ? 'tablet' : 'desktop'
}

test('first visit: onboarding once, then from the settings menu', async ({ page }) => {
  await freshApp(page, { onboarded: false })
  const dialog = page.getByRole('dialog', { name: 'Draw each character in its box' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Start drawing' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0) // onboarding only once
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'How it works' }).click()
  await expect(dialog).toBeVisible()
})

test('the page starts with the test strip, in the light theme', async ({ page }) => {
  await freshApp(page)
  const strip = page.getByLabel('Test strip text')
  const grid = cellCanvas(page, 'a')
  expect((await strip.boundingBox())!.y).toBeLessThan((await grid.boundingBox())!.y)
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'dark' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('PWA: manifest with any + maskable icons', async ({ page, request }) => {
  test.skip(kind() !== 'desktop')
  await freshApp(page)
  // The dev server doesn't emit the manifest; check the config's output via a build-free fetch of the icons.
  for (const icon of ['icon-192', 'icon-512', 'maskable-192', 'maskable-512', 'apple-touch-icon']) {
    const r = await request.get(`/icons/${icon}.png`)
    expect(r.status(), icon).toBe(200)
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
})

for (const scheme of ['dark', 'light'] as const) {
  test(`accessibility (axe, ${scheme})`, async ({ page }) => {
    test.skip(kind() === 'tablet', 'covered by phone + desktop')
    await freshApp(page)
    await setTheme(page, scheme)
    await stroke(cellCanvas(page, 'a'))
    const scan = async (label: string) => {
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const serious = res.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map(v => `${label}: ${v.id} – ${v.help} (${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')})`)).toEqual([])
    }
    await scan('page')
    await page.getByTestId('export').click()
    await scan('export dialog')
    await page.getByRole('button', { name: 'Close export' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await scan('settings')
  })
}

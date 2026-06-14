import { expect, test } from '@playwright/test'

test('robots.txt existe e bloqueia áreas privadas', async ({ page }) => {
  const response = await page.goto('/robots.txt')
  expect(response?.ok()).toBeTruthy()

  const text = await page.locator('body').innerText()

  expect(text).toMatch(/Disallow:\s*\/dashboard/i)
  expect(text).toMatch(/Disallow:\s*\/pedido/i)
  expect(text).toMatch(/Sitemap:/i)
})

test('sitemap.xml existe e contém páginas públicas principais', async ({ page }) => {
  const response = await page.goto('/sitemap.xml')
  expect(response?.ok()).toBeTruthy()

  const xml = await page.locator('body').innerText()

  expect(xml).toContain('https://pratoby.com/')
  expect(xml).toContain('/planos')
  expect(xml).not.toContain('/dashboard')
  expect(xml).not.toContain('/pedido/')
})
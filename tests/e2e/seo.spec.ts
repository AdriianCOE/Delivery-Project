import { expect, test } from '@playwright/test'

async function getMeta(page: any, name: string) {
  return page.locator(`meta[name="${name}"]`).getAttribute('content')
}

async function getPropertyMeta(page: any, property: string) {
  return page.locator(`meta[property="${property}"]`).getAttribute('content')
}

test('homepage tem SEO básico correto', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/PratoBy/i)

  const description = await getMeta(page, 'description')
  expect(description).toBeTruthy()
  expect(description!.length).toBeGreaterThan(40)
  expect(description).not.toMatch(/carregando|undefined|null/i)

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).toBeTruthy()
  expect(canonical).toMatch(/https?:\/\/.+/)
})

test('/planos tem SEO único e não aponta canonical para homepage pura', async ({ page }) => {
  await page.goto('/planos')

  await expect(page).toHaveTitle(/planos|PratoBy/i)

  const description = await getMeta(page, 'description')
  expect(description).toBeTruthy()
  expect(description).not.toMatch(/carregando|undefined|null/i)

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).toBeTruthy()
  expect(canonical).toContain('/planos')
})

test('Open Graph básico existe', async ({ page }) => {
  await page.goto('/')

  const ogTitle = await getPropertyMeta(page, 'og:title')
  const ogDescription = await getPropertyMeta(page, 'og:description')
  const ogUrl = await getPropertyMeta(page, 'og:url')

  expect(ogTitle).toBeTruthy()
  expect(ogDescription).toBeTruthy()
  expect(ogUrl).toBeTruthy()
})
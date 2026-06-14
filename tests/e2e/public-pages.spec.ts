import { expect, test } from '@playwright/test'

const pages = [
  { path: '/', title: /PratoBy/i },
  { path: '/planos', title: /planos|PratoBy/i },
  { path: '/contato', title: /contato|PratoBy/i },
  { path: '/privacidade', title: /privacidade|PratoBy/i },
  { path: '/termos', title: /termos|PratoBy/i },
]

for (const item of pages) {
  test(`abre página pública ${item.path}`, async ({ page }) => {
    await page.goto(item.path)

    await expect(page).toHaveTitle(item.title)
    await expect(page.locator('body')).toBeVisible()

    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/carregando cardápio/i)
    expect(bodyText).not.toMatch(/undefined|null/i)
  })
}

test('página /planos tem conteúdo de planos e preços', async ({ page }) => {
  await page.goto('/planos')

  const body = page.locator('body')

  await expect(body).toContainText(/Essencial/i)
  await expect(body).toContainText(/Profissional/i)
  await expect(body).toContainText(/Premium/i)
  await expect(body).toContainText(/R\$/i)
  await expect(body).toContainText(/sem comissão/i)
})
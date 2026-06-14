import { expect, test } from '@playwright/test'

test('/planos] redireciona para /planos', async ({ page }) => {
  await page.goto('/planos]')

  await expect(page).toHaveURL(/\/planos\/?$/)
  await expect(page).toHaveTitle(/planos|PratoBy/i)
})

test('/planos%5D redireciona para /planos', async ({ page }) => {
  await page.goto('/planos%5D')

  await expect(page).toHaveURL(/\/planos\/?$/)
  await expect(page).toHaveTitle(/planos|PratoBy/i)
})
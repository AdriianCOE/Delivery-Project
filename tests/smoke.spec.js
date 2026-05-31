import { test, expect } from '@playwright/test'

test('home carrega sem quebrar', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/PratoBy|Cardápio|Delivery/i)
})
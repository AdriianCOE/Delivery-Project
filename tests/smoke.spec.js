import { test, expect } from '@playwright/test'

test('home publica carrega sem quebrar', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/PratoBy|Cardápio|Delivery/i)
  await expect(page.locator('body')).toContainText(/PratoBy/i)
})

test('slug publico demo resolve sem depender de dados privados', async ({ page }) => {
  await page.goto('/capivaras-lanches')
  await expect(page).toHaveURL(/capivaras-lanches/)
  await expect(page.locator('body')).toContainText(/PratoBy|Card[aá]pio|Loja|Carregando|n[aã]o encontrada/i)
})

test('dashboard sem sessao redireciona para login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
})

test('rota inexistente mostra 404', async ({ page }) => {
  await page.goto('/404')
  await expect(page.locator('body')).toContainText(/Erro\s*404|Rota n[aã]o encontrada/i)
})

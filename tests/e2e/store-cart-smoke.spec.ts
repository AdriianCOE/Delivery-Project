import { expect, test } from '@playwright/test'

const STORE_SLUG = process.env.PLAYWRIGHT_STORE_SLUG || 'capivaras-lanches'

test('cliente consegue abrir produto ou card do cardápio sem quebrar UI', async ({ page }) => {
  await page.goto(`/${STORE_SLUG}`)

  await expect(page.locator('body')).toBeVisible()
  await expect(page.getByText(/carregando cardápio/i)).not.toBeVisible({
    timeout: 15_000,
  })

  const possibleProductButtons = page
    .locator('button, article, [role="button"]')
    .filter({ hasText: /R\$|adicionar|ver|escolher/i })

  const count = await possibleProductButtons.count()

  if (count === 0) {
    test.skip(true, 'Nenhum produto clicável encontrado nesta loja.')
  }

  await possibleProductButtons.first().click()

  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/erro inesperado|undefined|null/i)
})
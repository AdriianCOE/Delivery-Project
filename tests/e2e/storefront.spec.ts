import { expect, test } from '@playwright/test'

const STORE_SLUG = process.env.PLAYWRIGHT_STORE_SLUG || 'capivaras-lanches'

async function waitForStorefrontReady(page: any) {
  await expect(page.getByText(/Capivaras Lanches|Capivara Burger|Hamb|Card/i).first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/carregando/i)).not.toBeVisible()
}

async function getCanonical(page: any) {
  return page.locator('link[rel="canonical"]').getAttribute('href')
}

test('loja pública abre por slug e não fica presa no loading', async ({ page }) => {
  await page.goto(`/${STORE_SLUG}`)

  await expect(page.locator('body')).toBeVisible()
  await waitForStorefrontReady(page)

  await expect(page.getByText(/carregando cardápio/i)).not.toBeVisible({
    timeout: 15_000,
  })

  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/loja não encontrada/i)
  expect(bodyText).not.toMatch(/undefined|null/i)
})

test('loja pública tem SEO dinâmico e canonical do slug', async ({ page }) => {
  await page.goto(`/${STORE_SLUG}`)

  await waitForStorefrontReady(page)
  await expect(page).not.toHaveTitle(/carregando/i)

  const title = await page.title()
  expect(title.length).toBeGreaterThan(8)
  expect(title).toMatch(/cardápio|pedido|online|PratoBy/i)

  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description).toBeTruthy()
  expect(description).not.toMatch(/carregando|undefined|null/i)

  await expect.poll(() => getCanonical(page)).toContain(STORE_SLUG)
})

test('loja pública tem produtos ou estado vazio amigável', async ({ page }) => {
  await page.goto(`/${STORE_SLUG}`)

  await expect(page.getByText(/carregando cardápio/i)).not.toBeVisible({
    timeout: 15_000,
  })

  await waitForStorefrontReady(page)
  const bodyText = await page.locator('body').innerText()

  expect(bodyText).not.toMatch(/erro inesperado|undefined|null/i)
  expect(bodyText).not.toMatch(/loja não encontrada/i)

  const hasExpectedStoreContent =
    /R\$|adicionar|produto|cardápio|categoria|buscar|pedido|retirada|entrega|loja fechada|sem produtos|indisponível/i.test(bodyText)

  expect(hasExpectedStoreContent).toBeTruthy()
})

test('imagens principais da loja não causam layout sem dimensões óbvias', async ({ page }) => {
  await page.goto(`/${STORE_SLUG}`)

  const images = page.locator('img')
  const count = await images.count()

  for (let i = 0; i < Math.min(count, 10); i += 1) {
    const img = images.nth(i)

    const src = await img.getAttribute('src')
    if (!src) continue

    const box = await img.boundingBox()
    expect(box?.width || 0).toBeGreaterThan(0)
    expect(box?.height || 0).toBeGreaterThan(0)
  }
})

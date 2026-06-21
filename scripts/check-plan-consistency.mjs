import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import {
  PLAN_FEATURES as frontendFeatures,
  PLAN_IDS as frontendPlanIds,
  PLAN_LIMITS as frontendLimits,
  PLAN_OPTIONS as frontendOptions,
} from '../src/utils/planCatalog.js'

const require = createRequire(import.meta.url)
const {
  FEATURE_MIN_PLANS: backendFeatures,
  PLAN_IDS: backendPlanIds,
  PLAN_LIMITS: backendLimits,
} = require('../functions/shared/planAccess.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])])
  )
}

function assertEqual(name, actual, expected) {
  const normalizedActual = JSON.stringify(stable(actual), null, 2)
  const normalizedExpected = JSON.stringify(stable(expected), null, 2)
  if (normalizedActual === normalizedExpected) return

  throw new Error(`${name} divergente.\nAtual: ${normalizedActual}\nEsperado: ${normalizedExpected}`)
}

function planOptionsToBillingCents() {
  return Object.fromEntries(
    frontendOptions.map((plan) => [
      plan.id,
      {
        monthlyCents: Math.round(Number(plan.priceMonthly) * 100),
        annualCents: Math.round(Number(plan.priceAnnual) * 100),
      },
    ])
  )
}

function readAsaasPlanCatalog() {
  const asaasPath = path.join(rootDir, 'functions', 'asaas.js')
  const source = fs.readFileSync(asaasPath, 'utf8')
  const match = source.match(/const PLAN_CATALOG = (\{[\s\S]*?\r?\n\})\s*\r?\nfunction getSecretValue/)

  if (!match) {
    throw new Error('Nao foi possivel localizar PLAN_CATALOG em functions/asaas.js')
  }

  return vm.runInNewContext(`(${match[1]})`)
}

function readRulesFeaturePlans() {
  const rulesPath = path.join(rootDir, 'firestore.rules')
  const source = fs.readFileSync(rulesPath, 'utf8')
  const match = source.match(/function featureRequiredRank\(feature\) \{\s*return feature in \[([\s\S]*?)\]\s*\?\s*3\s*:\s*feature in \[([\s\S]*?)\]\s*\?\s*2\s*:\s*1;\s*\}/)

  if (!match) {
    throw new Error('Nao foi possivel localizar featureRequiredRank em firestore.rules')
  }

  const extract = (value) => [...value.matchAll(/'([^']+)'/g)].map((item) => item[1])
  const premium = new Set(extract(match[1]))
  const professional = new Set(extract(match[2]))

  return Object.fromEntries(
    Object.keys(backendFeatures).map((feature) => [
      feature,
      premium.has(feature)
        ? 'premium'
        : professional.has(feature)
          ? 'professional'
          : 'essential',
    ])
  )
}

function readIndexHtmlOfferPrices() {
  const indexPath = path.join(rootDir, 'index.html')
  const source = fs.readFileSync(indexPath, 'utf8')
  const scripts = [...source.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]

  for (const script of scripts) {
    const json = JSON.parse(script[1])
    const graph = Array.isArray(json?.['@graph']) ? json['@graph'] : []
    const app = graph.find((entry) => entry?.['@type'] === 'SoftwareApplication')
    const offers = Array.isArray(app?.offers) ? app.offers : []

    if (offers.length === 0) continue

    const planByName = {
      essencial: 'essential',
      profissional: 'professional',
      premium: 'premium',
    }

    return Object.fromEntries(
      offers.map((offer) => {
        const lowerName = String(offer.name || '').toLowerCase()
        const planId = Object.entries(planByName).find(([label]) => lowerName.includes(label))?.[1]

        if (!planId) {
          throw new Error(`Oferta sem plano reconhecido no index.html: ${offer.name || '(sem nome)'}`)
        }

        return [planId, Math.round(Number(offer.price) * 100)]
      })
    )
  }

  throw new Error('Nao foi possivel localizar offers de SoftwareApplication no index.html')
}

function comparePlanCatalogs() {
  assertEqual('PLAN_IDS frontend/backend', frontendPlanIds, backendPlanIds)
  assertEqual('PLAN_LIMITS frontend/backend', frontendLimits, backendLimits)
  assertEqual('PLAN_FEATURES frontend/backend', frontendFeatures, backendFeatures)
  assertEqual('PLAN_FEATURES rules/backend', readRulesFeaturePlans(), backendFeatures)

  const frontendBilling = planOptionsToBillingCents()
  const asaasBilling = Object.fromEntries(
    Object.entries(readAsaasPlanCatalog()).map(([planId, plan]) => [
      planId,
      {
        monthlyCents: plan.monthlyCents,
        annualCents: plan.annualCents,
      },
    ])
  )

  assertEqual('Precos frontend/Asaas', frontendBilling, asaasBilling)
  assertEqual(
    'Precos mensais index.html/Asaas',
    readIndexHtmlOfferPrices(),
    Object.fromEntries(
      Object.entries(asaasBilling).map(([planId, price]) => [planId, price.monthlyCents])
    )
  )
}

comparePlanCatalogs()
console.log('Plan consistency OK: frontend, backend, Firestore rules e Asaas estao alinhados.')

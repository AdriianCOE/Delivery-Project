import { useEffect, useMemo, useState } from 'react'
import {
  FiAlertCircle,
  FiCheck,
  FiMinus,
  FiPlus,
  FiShoppingBag,
  FiX,
} from 'react-icons/fi'

import { useCart } from '../../contexts/CartContext'
import { getCloudinaryOptimizedUrl } from '../../services/cloudinary'
import { canAddProductToCart, isProductUnavailable, hasOutOfStock } from '../../utils/productStatus'
import { getProductSchedulingBadges } from '../../utils/publicScheduling'

const DEFAULT_THEME_COLOR = '#f97316'
const INCLUDED_PRICING_MODES = new Set([
  'included',
  'included_first',
  'first_included',
  'firstIncluded',
])

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function moneyToCents(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null && centsValue !== '') {
    return Math.round(Number(centsValue || 0))
  }

  if (value === undefined || value === null || value === '') return 0

  if (typeof value === 'string') {
    let cleaned = value.replace(/[^\d.,-]/g, '')

    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }

    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
  }

  const numericValue = Number(value || 0)

  if (!Number.isFinite(numericValue)) return 0

  if (Math.abs(numericValue) > 999) return Math.round(numericValue)

  return Math.round(numericValue * 100)
}

function centsToMoney(cents) {
  return Number(cents || 0) / 100
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatCents(cents) {
  return formatMoney(centsToMoney(cents))
}

function getProductPriceCents(product) {
  return moneyToCents(
    product?.promotionalPrice ??
      product?.salePrice ??
      product?.promotion?.currentPrice ??
      product?.price,
    product?.promotionalPriceCents ??
      product?.salePriceCents ??
      product?.promotion?.currentPriceCents ??
      product?.priceCents
  )
}

function getProductImage(product) {
  const imageUrl =
    product?.imageUrl ||
    product?.image ||
    product?.photoUrl ||
    product?.thumbnailUrl ||
    product?.coverUrl ||
    ''

  return getCloudinaryOptimizedUrl(imageUrl, 900)
}

function getProductExtras(product) {
  return Array.isArray(product?.extras) ? product.extras : []
}

function getRawOptionGroups(product) {
  if (Array.isArray(product?.optionGroups)) return product.optionGroups
  if (Array.isArray(product?.optionsGroups)) return product.optionsGroups
  if (Array.isArray(product?.customizationGroups)) return product.customizationGroups

  return []
}

function getOptionKey(option, fallback = '') {
  return String(option?.id || option?.optionId || option?.name || fallback)
}

function getGroupKey(group, fallback = '') {
  return String(group?.id || group?.groupId || group?.name || group?.title || fallback)
}

function clampQuantity(value, min = 0, max = 0) {
  const safeValue = Math.max(min, Math.floor(toNumber(value, 0)))

  if (max > 0) return Math.min(safeValue, max)

  return safeValue
}

function normalizeOption(option, index) {
  const name = String(option?.name || option?.title || '').trim()
  const id = getOptionKey(option, `option-${index}`)
  const unitPriceCents = moneyToCents(option?.price, option?.priceCents)

  return {
    id,
    optionId: id,
    name,
    description: option?.description || option?.details || '',
    unitPrice: centsToMoney(unitPriceCents),
    unitPriceCents,
    price: centsToMoney(unitPriceCents),
    priceCents: unitPriceCents,
    available: option?.available !== false && option?.isAvailable !== false,
    isDefault: Boolean(option?.isDefault),
    raw: option,
  }
}

function normalizeGroup(group, index) {
  const rawType = String(group?.type || '').toLowerCase()
  const rawMax = group?.max ?? group?.maxSelections ?? group?.maxSelected
  const hasExplicitMax = rawMax !== undefined && rawMax !== null && rawMax !== ''

  const required = Boolean(
    group?.required || group?.isRequired || Number(group?.min || group?.minSelections || 0) > 0
  )

  const allowQuantity =
    group?.allowQuantity === true ||
    group?.quantityEnabled === true ||
    rawType === 'quantity' ||
    rawType === 'qty'

  let type = rawType || (allowQuantity ? 'quantity' : 'single')

  if (!['single', 'multiple', 'quantity'].includes(type)) {
    type = allowQuantity ? 'quantity' : 'multiple'
  }

  const min = Math.max(
    0,
    Math.floor(toNumber(group?.min ?? group?.minSelections ?? group?.minSelected, required ? 1 : 0))
  )

  const max = type === 'single'
    ? 1
    : Math.max(0, Math.floor(toNumber(rawMax, hasExplicitMax ? 0 : 0)))

  const options = (Array.isArray(group?.options) ? group.options : [])
    .map((option, optionIndex) => normalizeOption(option, optionIndex))
    .filter((option) => option.name)

  return {
    id: getGroupKey(group, `group-${index}`),
    groupId: getGroupKey(group, `group-${index}`),
    title: group?.title || group?.name || `Opção ${index + 1}`,
    name: group?.name || group?.title || `Opção ${index + 1}`,
    description: group?.description || group?.subtitle || '',
    required,
    min,
    max,
    type,
    allowQuantity: type === 'quantity' || allowQuantity,
    pricingMode: group?.pricingMode || group?.priceMode || 'additive',
    includedQuantity: Math.max(
      0,
      Math.floor(toNumber(group?.includedQuantity, min > 0 ? min : 1))
    ),
    options,
  }
}

function getOptionGroups(product) {
  return getRawOptionGroups(product)
    .map((group, index) => normalizeGroup(group, index))
    .filter((group) => group.options.length > 0)
}

function getGroupSelectedQuantity(options = []) {
  return options.reduce((acc, option) => acc + Number(option.quantity || 0), 0)
}

function getOptionQuantity(selectedOptions, groupId, optionId) {
  const groupSelected = selectedOptions[groupId] || []
  const found = groupSelected.find((item) => item.id === optionId)

  return Number(found?.quantity || 0)
}

function buildChargedOptions(group, selected = []) {
  const includedMode = INCLUDED_PRICING_MODES.has(group.pricingMode)
  let includedRemaining = includedMode ? Number(group.includedQuantity || group.min || 1) : 0

  return selected.map((option) => {
    const quantity = Number(option.quantity || 0)
    const includedQuantity = includedMode
      ? Math.min(quantity, Math.max(0, includedRemaining))
      : 0

    includedRemaining = Math.max(0, includedRemaining - includedQuantity)

    const chargedQuantity = Math.max(0, quantity - includedQuantity)
    const totalCents = chargedQuantity * option.unitPriceCents

    return {
      ...option,
      quantity,
      includedQuantity,
      chargedQuantity,
      total: centsToMoney(totalCents),
      totalCents,
      price: centsToMoney(totalCents),
      priceCents: totalCents,
    }
  })
}

function buildOptionsSummary(optionGroups = []) {
  return optionGroups
    .flatMap((group) =>
      group.options.map((option) => {
        const prefix = option.quantity > 1 ? `${option.quantity}x ` : ''
        return `${prefix}${option.name}`
      })
    )
    .join(', ')
}

export default function ProductOptionsModal({
  isOpen,
  product,
  store,
  onClose,
}) {
  const { addToCart } = useCart()

  const [quantity, setQuantity] = useState(1)
  const [observation, setObservation] = useState('')
  const [selectedExtras, setSelectedExtras] = useState([])
  const [selectedOptions, setSelectedOptions] = useState({})
  const [error, setError] = useState('')

  const themeColor =
    store?.themeColor ||
    store?.primaryColor ||
    store?.accentColor ||
    store?.settings?.themeColor ||
    DEFAULT_THEME_COLOR

  const basePriceCents = useMemo(() => getProductPriceCents(product), [product])
  const imageUrl = useMemo(() => getProductImage(product), [product])
  const extras = useMemo(() => getProductExtras(product), [product])
  const optionGroups = useMemo(() => getOptionGroups(product), [product])
  const schedulingBadges = useMemo(
  () => product ? getProductSchedulingBadges(product, store) : [],
  [product, store]
  )

  useEffect(() => {
    if (!isOpen) return

    setQuantity(1)
    setObservation('')
    setSelectedExtras([])
    setSelectedOptions({})
    setError('')
  }, [isOpen, product?.id])

  const normalizedSelectedOptionGroups = useMemo(() => {
    return optionGroups
      .map((group) => {
        const selected = selectedOptions[group.id] || []
        const chargedOptions = buildChargedOptions(group, selected)

        return {
          groupId: group.id,
          id: group.id,
          groupTitle: group.title,
          title: group.title,
          name: group.name,
          required: group.required,
          min: group.min,
          max: group.max,
          type: group.type,
          allowQuantity: group.allowQuantity,
          pricingMode: group.pricingMode,
          options: chargedOptions,
        }
      })
      .filter((group) => group.options.length > 0)
  }, [optionGroups, selectedOptions])

  const normalizedOptionsFlat = useMemo(() => {
    return normalizedSelectedOptionGroups.flatMap((group) =>
      group.options.map((option) => ({
        id: option.id,
        optionId: option.id,
        name: option.name,
        description: option.description || '',
        groupId: group.groupId,
        groupTitle: group.groupTitle,
        quantity: option.quantity,
        includedQuantity: option.includedQuantity,
        chargedQuantity: option.chargedQuantity,
        unitPrice: centsToMoney(option.unitPriceCents),
        unitPriceCents: option.unitPriceCents,
        total: option.total,
        totalCents: option.totalCents,
        price: option.price,
        priceCents: option.priceCents,
        type: 'option',
      }))
    )
  }, [normalizedSelectedOptionGroups])

  const additionsCents = selectedExtras.reduce((acc, extra) => {
    return acc + moneyToCents(extra.price, extra.priceCents)
  }, 0)

  const optionsCents = normalizedOptionsFlat.reduce((acc, option) => {
    return acc + Number(option.totalCents || option.priceCents || 0)
  }, 0)

  const unitPriceCents = basePriceCents + additionsCents + optionsCents
  const totalCents = unitPriceCents * quantity

  if (!isOpen || !product) return null

  const productCanAdd = canAddProductToCart(product)
  const productUnavailable = isProductUnavailable(product)
  const productOutOfStock = hasOutOfStock(product)
  const blockedReason = productOutOfStock
    ? 'Este item está esgotado no momento.'
    : productUnavailable
      ? 'Este item está indisponível no momento.'
      : ''

  function isExtraSelected(extra) {
    const key = getOptionKey(extra, extra.name)
    return selectedExtras.some((item) => getOptionKey(item, item.name) === key)
  }

  function toggleExtra(extra) {
    setError('')

    setSelectedExtras((current) => {
      const extraKey = getOptionKey(extra, extra.name)
      const exists = current.some((item) => getOptionKey(item, item.name) === extraKey)

      if (exists) {
        return current.filter((item) => getOptionKey(item, item.name) !== extraKey)
      }

      return [...current, extra]
    })
  }

  function updateOptionQuantity(group, option, nextQuantity) {
    setError('')

    if (!option.available) return

    setSelectedOptions((current) => {
      const currentGroup = current[group.id] || []
      const optionId = option.id

      if (group.type === 'single' || !group.allowQuantity) {
        const alreadySelected = currentGroup.some((item) => item.id === optionId)

        if (alreadySelected && group.min === 0 && group.type === 'single') {
          return {
            ...current,
            [group.id]: [],
          }
        }

        if (group.type === 'single') {
          return {
            ...current,
            [group.id]: [{ ...option, quantity: 1 }],
          }
        }
      }

      const groupWithoutOption = currentGroup.filter((item) => item.id !== optionId)
      const quantityWithoutOption = getGroupSelectedQuantity(groupWithoutOption)
      const nextSafeQuantity = clampQuantity(nextQuantity, 0)
      const availableSlots = group.max > 0 ? Math.max(0, group.max - quantityWithoutOption) : 999
      const finalQuantity = group.allowQuantity
        ? Math.min(nextSafeQuantity, availableSlots)
        : nextSafeQuantity > 0
          ? 1
          : 0

      if (finalQuantity <= 0) {
        return {
          ...current,
          [group.id]: groupWithoutOption,
        }
      }

      return {
        ...current,
        [group.id]: [
          ...groupWithoutOption,
          {
            ...option,
            quantity: finalQuantity,
          },
        ],
      }
    })
  }

  function validateOptions() {
    for (const group of optionGroups) {
      const selected = selectedOptions[group.id] || []
      const selectedQuantity = getGroupSelectedQuantity(selected)

      if (group.min > 0 && selectedQuantity < group.min) {
        return `Escolha pelo menos ${group.min} item em "${group.title}".`
      }

      if (group.max > 0 && selectedQuantity > group.max) {
        return `Escolha no máximo ${group.max} item em "${group.title}".`
      }
    }

    return ''
  }

  function handleAddToCart() {
    if (!productCanAdd) return

    const validationError = validateOptions()

    if (validationError) {
      setError(validationError)
      return
    }

    const normalizedExtras = selectedExtras.map((extra) => {
      const priceCents = moneyToCents(extra.price, extra.priceCents)

      return {
        id: getOptionKey(extra, extra.name),
        name: extra.name,
        price: centsToMoney(priceCents),
        priceCents,
        unitPrice: centsToMoney(priceCents),
        unitPriceCents: priceCents,
        quantity: 1,
        type: 'extra',
      }
    })

    const optionsSummary = buildOptionsSummary(normalizedSelectedOptionGroups)
    const cartItemId = `${product.id || product.originalProductId || 'product'}-${Date.now()}`

    const cartItem = {
      ...product,
      originalProductId: product.id || product.originalProductId,
      cartItemId,
      quantity,
      observation: observation.trim(),
      itemObservation: observation.trim(),
      basePrice: centsToMoney(basePriceCents),
      basePriceCents,
      price: centsToMoney(basePriceCents),
      priceCents: basePriceCents,
      extras: [...normalizedExtras, ...normalizedOptionsFlat],
      selectedOptions: normalizedOptionsFlat,
      selectedOptionsFlat: normalizedOptionsFlat,
      selectedOptionGroups: normalizedSelectedOptionGroups,
      optionGroupsSnapshot: normalizedSelectedOptionGroups,
      optionsSummary,
      total: centsToMoney(totalCents),
      totalCents,
      unitPrice: centsToMoney(unitPriceCents),
      unitPriceCents,
    }

    addToCart(cartItem)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center md:items-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fechar detalhes do produto"
      />

      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl ring-1 ring-white/70 md:rounded-[2rem]">
        <div className="relative h-60 shrink-0 bg-gray-100 sm:h-64">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#f9fafb] text-gray-300">
              <FiShoppingBag size={52} />
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/10" />

          <div className="absolute bottom-4 left-4 right-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-[#111827] shadow-lg backdrop-blur">
              <FiShoppingBag size={13} />
              Monte seu pedido
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-[#111827] shadow-lg backdrop-blur transition hover:bg-white"
            aria-label="Fechar"
          >
            <FiX size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f9fafb] p-5">
          <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-[#111827]">
              {product.name}
            </h2>

            {schedulingBadges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {schedulingBadges.map((badge) => (
                  <span
                    key={badge.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${
                      badge.tone === 'amber'
                        ? 'bg-amber-50 text-amber-700 ring-amber-100'
                        : badge.tone === 'green'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                          : badge.tone === 'orange'
                            ? 'bg-orange-50 text-orange-700 ring-orange-100'
                            : 'bg-gray-50 text-gray-600 ring-gray-100'
                    }`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {product.description && (
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                {product.description}
              </p>
            )}

            <p className="mt-4 text-2xl font-black text-[#111827]">
              {formatCents(basePriceCents)}
            </p>
          </div>

          {optionGroups.length > 0 && (
            <div className="mt-6 space-y-5">
              {optionGroups.map((group) => {
                const selectedQuantity = getGroupSelectedQuantity(selectedOptions[group.id] || [])
                const maxText = group.max > 0 ? `máx. ${group.max}` : 'sem limite'

                return (
                  <section
                    key={group.id}
                    className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-[#111827]">
                          {group.title}
                        </h3>

                        {group.description && (
                          <p className="mt-1 text-xs leading-5 text-[#6b7280]">
                            {group.description}
                          </p>
                        )}

                        <p className="mt-1 text-xs font-medium text-[#6b7280]">
                          {group.min > 0
                            ? `Escolha pelo menos ${group.min}`
                            : 'Opcional'}
                          {group.type !== 'single' && ` · ${maxText}`}
                          {group.allowQuantity && ' · pode repetir'}
                          {group.max > 0 && selectedQuantity >= group.max && (
                            <span className="ml-2 font-bold text-amber-600">
                              (Máximo atingido)
                            </span>
                          )}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-black ${
                          group.min > 0
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {group.min > 0 ? 'Obrigatório' : 'Opcional'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.options.map((option) => {
                        const selectedOptionQuantity = getOptionQuantity(
                          selectedOptions,
                          group.id,
                          option.id
                        )
                        const active = selectedOptionQuantity > 0
                        const disableIncrease =
                          group.max > 0 && selectedQuantity >= group.max && !active

                        return (
                          <div
                            key={option.id}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                              active
                                ? 'border-green-200 bg-orange-50'
                                : 'border-gray-100 bg-white hover:border-orange-100'
                            } ${!option.available ? 'opacity-50' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                group.allowQuantity
                                  ? updateOptionQuantity(
                                      group,
                                      option,
                                      active ? selectedOptionQuantity : 1
                                    )
                                  : updateOptionQuantity(group, option, active ? 0 : 1)
                              }
                              disabled={!option.available || (!active && disableIncrease)}
                              className="min-w-0 flex-1 text-left disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <p className="text-sm font-black text-[#111827]">
                                {option.name}
                              </p>

                              {option.description && (
                                <p className="mt-0.5 text-xs leading-5 text-[#6b7280]">
                                  {option.description}
                                </p>
                              )}

                              {option.unitPriceCents > 0 && (
                                <p className="mt-1 text-xs font-black text-[#f97316]">
                                  + {formatCents(option.unitPriceCents)}
                                </p>
                              )}
                            </button>

                            {group.allowQuantity ? (
                              <div className="flex shrink-0 items-center gap-1 rounded-xl border border-gray-100 bg-white p-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateOptionQuantity(
                                      group,
                                      option,
                                      selectedOptionQuantity - 1
                                    )
                                  }
                                  disabled={!active}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#111827] transition hover:bg-gray-100 disabled:opacity-30"
                                >
                                  <FiMinus size={14} />
                                </button>

                                <span className="w-7 text-center text-sm font-black text-[#111827]">
                                  {selectedOptionQuantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateOptionQuantity(
                                      group,
                                      option,
                                      selectedOptionQuantity + 1
                                    )
                                  }
                                  disabled={!option.available || disableIncrease || (group.max > 0 && selectedQuantity >= group.max)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#111827] transition hover:bg-gray-100 disabled:opacity-30"
                                >
                                  <FiPlus size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateOptionQuantity(group, option, active ? 0 : 1)}
                                disabled={!option.available || (!active && disableIncrease)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-30 disabled:bg-gray-50"
                                style={
                                  active
                                    ? {
                                        backgroundColor: themeColor,
                                        borderColor: themeColor,
                                        color: '#fff',
                                      }
                                    : undefined
                                }
                              >
                                {active && <FiCheck size={14} />}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {extras.length > 0 && (
            <section className="mt-6 rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black text-[#111827]">
                Adicionais
              </h3>

              <p className="mt-1 text-xs font-medium text-[#6b7280]">
                Escolha se quiser deixar seu pedido ainda melhor.
              </p>

              <div className="mt-3 space-y-2">
                {extras.map((extra, index) => {
                  const active = isExtraSelected(extra)
                  const priceCents = moneyToCents(extra.price, extra.priceCents)
                  const extraKey = getOptionKey(extra, `${extra.name}-${index}`)

                  return (
                    <button
                      key={extraKey}
                      type="button"
                      onClick={() => toggleExtra(extra)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${
                        active
                          ? 'border-green-200 bg-orange-50'
                          : 'border-gray-100 bg-white hover:border-orange-100'
                      }`}
                    >
                      <p className="text-sm font-black text-[#111827]">
                        {extra.name}
                      </p>

                      <div className="flex items-center gap-3">
                        {priceCents > 0 && (
                          <span className="text-xs font-black text-[#f97316]">
                            + {formatCents(priceCents)}
                          </span>
                        )}

                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full border"
                          style={
                            active
                              ? {
                                  backgroundColor: themeColor,
                                  borderColor: themeColor,
                                  color: '#fff',
                                }
                              : undefined
                          }
                        >
                          {active && <FiCheck size={14} />}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section className="mt-6 rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
              Alguma observação?
            </label>

            <textarea
              rows={3}
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Ex: tirar cebola, ponto da carne, sem molho..."
              className="w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </section>

          {blockedReason && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-3 text-sm font-bold text-orange-700">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{blockedReason}</span>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-gray-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-18px_40px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-2xl border border-gray-100 bg-[#f9fafb] p-1">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#111827] transition hover:bg-white"
              >
                <FiMinus />
              </button>

              <span className="w-9 text-center text-sm font-black text-[#111827]">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantity((current) => current + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#111827] transition hover:bg-white"
              >
                <FiPlus />
              </button>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold text-[#6b7280]">
                Subtotal
              </p>

              <p className="text-xl font-black text-[#111827]">
                {formatCents(totalCents)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!productCanAdd}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-white shadow-lg transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
            style={{ backgroundColor: productCanAdd ? themeColor : undefined }}
          >
            <FiShoppingBag />
            {blockedReason ? 'Indisponível' : 'Adicionar ao carrinho'}
          </button>
        </footer>
      </div>
    </div>
  )
}



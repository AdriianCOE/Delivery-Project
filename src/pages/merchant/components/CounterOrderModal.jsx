import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  FiX,
  FiSearch,
  FiShoppingBag,
  FiPlus,
  FiMinus,
  FiLoader,
  FiCheckCircle,
  FiAlertTriangle,
  FiMessageSquare,
  FiCreditCard,
  FiDollarSign,
  FiUser,
  FiFileText,
  FiTrash2,
  FiPackage,
  FiZap,
  FiLayers,
} from 'react-icons/fi'

import { db, functions } from '../../../services/firebase'
import { getCallableErrorMessage } from '../../../utils/callableError'

// ─── Constantes ──────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS = [
  { key: 'dinheiro', label: 'Dinheiro', icon: FiDollarSign, hint: 'Recebido no balcão' },
  { key: 'pix_manual', label: 'Pix manual', icon: FiZap, hint: 'Confirmar manualmente' },
  { key: 'credito', label: 'Crédito', icon: FiCreditCard, hint: 'Maquininha crédito' },
  { key: 'debito', label: 'Débito', icon: FiCreditCard, hint: 'Maquininha débito' },
  { key: 'maquininha', label: 'Cartão', icon: FiCreditCard, hint: 'Crédito/débito sem separar' },
]

const MODAL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.98, y: 18 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 360, damping: 34, mass: 0.82 },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 16,
    transition: { duration: 0.14 },
  },
}

const MINI_MODAL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96, y: 14 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 },
  },
  exit: { opacity: 0, scale: 0.98, y: 12, transition: { duration: 0.12 } },
}

const PANEL_CLASS = 'rounded-[1.5rem] border border-white/10 bg-white shadow-sm ring-1 ring-black/[0.03] dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]'
const MAX_COUNTER_ITEMS = 50
const MAX_LINE_QUANTITY = 99
const MAX_CUSTOMER_NAME_LENGTH = 80
const MAX_NOTE_LENGTH = 300
const MAX_ITEM_OBSERVATION_LENGTH = 200
const ALLOWED_PAYMENT_METHODS = new Set(PAYMENT_OPTIONS.map((option) => option.key))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function toSafeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function moneyToCents(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.round(number * 100)
}

function clampQuantity(value, min = 1, max = MAX_LINE_QUANTITY) {
  const quantity = Math.floor(Number(value ?? min))
  if (!Number.isFinite(quantity)) return min
  return Math.max(min, Math.min(quantity, max))
}

function limitInputText(value, maxLength) {
  return Array.from(String(value || ''))
    .map((char) => (char < ' ' || char === '\u007F' ? ' ' : char))
    .join('')
    .slice(0, maxLength)
}

function sanitizePlainText(value, maxLength) {
  return limitInputText(value, maxLength)
    .replace(/\s+/g, ' ')
    .trim()
}

function getSafeStoreId(value) {
  const id = String(value || '').trim()
  if (!id || id.includes('/') || id.length > 160) return ''
  return id
}

function getProductPriceCents(product) {
  const candidates = [product?.priceCents, product?.priceInCents]
  for (const c of candidates) {
    if (c !== undefined && c !== null && Number.isFinite(Number(c))) {
      return Math.max(0, Math.round(Number(c)))
    }
  }
  return moneyToCents(product?.price || 0)
}

function isProductDeletedOrHidden(product) {
  return Boolean(
    product?.isDeleted ||
    product?.deleted ||
    product?.hidden ||
    product?.isHidden ||
    product?.isVisible === false ||
    product?.visible === false ||
    product?.isActive === false
  )
}

function isProductUnavailableForCounter(product) {
  return Boolean(
    product?.isAvailable === false ||
    product?.available === false ||
    product?.unavailable === true ||
    product?.soldOut === true ||
    product?.stock === 0 ||
    product?.status === 'unavailable'
  )
}

function getOptionPriceCents(option) {
  const candidates = [
    option?.priceCents,
    option?.additionalPriceCents,
    option?.extraPriceCents,
    option?.valueCents,
  ]

  for (const c of candidates) {
    if (c !== undefined && c !== null && Number.isFinite(Number(c))) {
      return Math.max(0, Math.round(Number(c)))
    }
  }

  return moneyToCents(
    option?.price ||
      option?.additionalPrice ||
      option?.extraPrice ||
      option?.value ||
      0
  )
}

function normalizeProducts(docs) {
  return docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((product) => !isProductDeletedOrHidden(product))
    .sort((a, b) => {
      const orderA = Number(a.order ?? a.sortOrder ?? 9999)
      const orderB = Number(b.order ?? b.sortOrder ?? 9999)
      return orderA - orderB || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
    })
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function getProductCategory(product) {
  return String(
    product?.categoryName ||
    product?.category ||
    product?.categoryTitle ||
    product?.categoryId ||
    'Outros'
  ).trim() || 'Outros'
}

function getProductDescription(product) {
  return String(product?.description || product?.shortDescription || '').replace(/\s+/g, ' ').trim()
}

function getRawOptionGroups(product) {
  const candidates = [
    product?.optionGroups,
    product?.optionsGroups,
    product?.modifiers,
    product?.complements,
    product?.extrasGroups,
  ]

  return candidates.find((value) => Array.isArray(value) && value.length > 0) || []
}

function getRawOptions(group) {
  return [
    group?.options,
    group?.items,
    group?.values,
    group?.choices,
    group?.modifiers,
    group?.extras,
  ].find((value) => Array.isArray(value)) || []
}

function normalizeOptionGroups(product) {
  return getRawOptionGroups(product)
    .map((group, groupIndex) => {
      const rawOptions = getRawOptions(group)
      const options = rawOptions
        .map((option, optionIndex) => {
          const id = String(
            option?.id ||
              option?.optionId ||
              option?.valueId ||
              option?.sku ||
              `${groupIndex}-${optionIndex}`
          )

          const name = String(
            option?.name ||
              option?.label ||
              option?.title ||
              option?.description ||
              `Opção ${optionIndex + 1}`
          ).trim()

          return {
            id,
            name,
            priceCents: getOptionPriceCents(option),
            raw: option,
          }
        })
        .filter((option) => option.name)

      const min = Math.max(0, Math.round(toSafeNumber(
        group?.min ??
          group?.minSelection ??
          group?.minSelections ??
          group?.minimum ??
          (group?.required || group?.isRequired ? 1 : 0),
        0
      )))

      const maxRaw = group?.max ?? group?.maxSelection ?? group?.maxSelections ?? group?.maximum
      const max = maxRaw === undefined || maxRaw === null || maxRaw === ''
        ? (min > 1 ? min : 1)
        : Math.max(1, Math.round(toSafeNumber(maxRaw, 1)))

      return {
        id: String(group?.id || group?.groupId || group?.key || `group-${groupIndex}`),
        name: String(group?.name || group?.label || group?.title || `Grupo ${groupIndex + 1}`).trim(),
        min,
        max,
        required: Boolean(group?.required || group?.isRequired || min > 0),
        options,
        raw: group,
      }
    })
    .filter((group) => group.name && group.options.length > 0)
}

function hasProductOptionGroups(product) {
  return normalizeOptionGroups(product).length > 0
}

function hasRequiredProductOptions(product) {
  return normalizeOptionGroups(product).some((group) => group.required || group.min > 0)
}

function isScheduledOnlyProduct(product) {
  const scheduling = product?.scheduling || {}
  return (
    scheduling.mode === 'scheduled_only' ||
    scheduling.orderMode === 'scheduled_only' ||
    product?.orderMode === 'scheduled_only' ||
    product?.availabilityMode === 'scheduled_only'
  )
}

function isTruthySetting(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function isDisabledSetting(value) {
  return value === false || value === 'false' || value === 0 || value === '0'
}

function getStoreEnabledPaymentOptions(store) {
  if (!store) return PAYMENT_OPTIONS

  const methods = {
    ...(store?.paymentMethods || {}),
    ...(store?.payments?.manual || {}),
  }

  const hasExplicitConfig = Object.keys(methods).length > 0 || Boolean(store?.pix)
  if (!hasExplicitConfig) return PAYMENT_OPTIONS

  const pixConfig = store?.pix || store?.payment?.pix || {}
  const pixEnabled = !isDisabledSetting(methods.pix) &&
    !isDisabledSetting(methods.pix_manual) &&
    !isDisabledSetting(pixConfig.enabled)

  const cashEnabled = !isDisabledSetting(methods.cash) &&
    !isDisabledSetting(methods.dinheiro)

  const creditEnabled = isTruthySetting(methods.credit) ||
    isTruthySetting(methods.creditCard) ||
    isTruthySetting(methods.card) ||
    isTruthySetting(methods.maquininha)

  const debitEnabled = isTruthySetting(methods.debit) ||
    isTruthySetting(methods.debitCard) ||
    isTruthySetting(methods.card) ||
    isTruthySetting(methods.maquininha)

  const genericCardEnabled = isTruthySetting(methods.card) || isTruthySetting(methods.maquininha)

  return PAYMENT_OPTIONS.filter((option) => {
    if (option.key === 'dinheiro') return cashEnabled
    if (option.key === 'pix_manual') return pixEnabled
    if (option.key === 'credito') return creditEnabled
    if (option.key === 'debito') return debitEnabled
    if (option.key === 'maquininha') return genericCardEnabled && !isTruthySetting(methods.credit) && !isTruthySetting(methods.debit)
    return false
  })
}

function getLineOptionsPriceCents(line) {
  return (line.selectedOptionsFlat || []).reduce((acc, option) => (
    acc + Math.max(0, Number(option.priceCents || 0))
  ), 0)
}

function getLineUnitPriceCents(line) {
  return getProductPriceCents(line.product) + getLineOptionsPriceCents(line)
}

function buildLineKey(productId, selectedOptionIds = []) {
  if (!selectedOptionIds.length) return String(productId)
  return `${productId}::${selectedOptionIds.slice().sort().join('|')}`
}

function buildSelectionPayload(product, groups, selectedByGroup) {
  const selectedOptionGroups = groups
    .map((group) => {
      const selectedIds = selectedByGroup[group.id] || []
      const options = group.options
        .filter((option) => selectedIds.includes(option.id))
        .map((option) => ({
          id: option.id,
          optionId: option.id,
          name: option.name,
          label: option.name,
          priceCents: option.priceCents,
          price: option.priceCents / 100,
          quantity: 1,
        }))

      return {
        id: group.id,
        groupId: group.id,
        name: group.name,
        label: group.name,
        min: group.min,
        max: group.max,
        required: group.required,
        options,
      }
    })
    .filter((group) => group.options.length > 0)

  const selectedOptionsFlat = selectedOptionGroups.flatMap((group) => (
    group.options.map((option) => ({
      ...option,
      groupId: group.id,
      groupName: group.name,
    }))
  ))

  const extras = selectedOptionsFlat.map((option) => ({
    id: option.id,
    optionId: option.id,
    name: option.name,
    label: option.name,
    groupId: option.groupId,
    groupName: option.groupName,
    priceCents: option.priceCents,
    price: option.priceCents / 100,
    quantity: option.quantity || 1,
  }))

  return {
    lineKey: buildLineKey(product.id, selectedOptionsFlat.map((option) => option.id)),
    selectedOptionGroups,
    selectedOptionsFlat,
    extras,
  }
}

function getSelectionError(groups, selectedByGroup) {
  const invalid = groups.find((group) => {
    const count = (selectedByGroup[group.id] || []).length
    return count < group.min || count > group.max
  })

  if (!invalid) return ''

  if ((selectedByGroup[invalid.id] || []).length < invalid.min) {
    return `Escolha pelo menos ${invalid.min} opção${invalid.min === 1 ? '' : 'es'} em "${invalid.name}".`
  }

  return `Escolha no máximo ${invalid.max} opção${invalid.max === 1 ? '' : 'es'} em "${invalid.name}".`
}

function getCartLineOptionsLabel(item) {
  const groups = item.selectedOptionGroups || []
  return groups.flatMap((group) => {
    const options = group.options || []
    if (!options.length) return []

    return [`${group.name}: ${options.map((option) => option.name).join(', ')}`]
  })
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ProductItem({ product, quantity, onAdd, onRemove, onObsChange }) {
  const priceCents = getProductPriceCents(product)
  const [showObs, setShowObs] = useState(false)
  const description = getProductDescription(product)
  const hasOptions = hasProductOptionGroups(product)
  const hasRequiredOptions = hasRequiredProductOptions(product)
  const scheduledOnly = isScheduledOnlyProduct(product)
  const unavailable = isProductUnavailableForCounter(product)
  const blocked = unavailable || scheduledOnly

  return (
    <article
      className={[
        'group overflow-hidden rounded-[1.35rem] border bg-white shadow-sm transition-all dark:bg-[#1f1f23]',
        quantity > 0
          ? 'border-orange-200 ring-2 ring-orange-500/10 dark:border-orange-500/35'
          : blocked
            ? 'border-white/10 bg-zinc-950/60 dark:border-white/10 dark:bg-zinc-950/60 opacity-65'
            : 'border-gray-100 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/10 dark:border-white/10 dark:hover:border-orange-500/25',
      ].join(' ')}
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-500/10 dark:to-amber-500/10">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-orange-500">
              <FiPackage size={24} />
            </div>
          )}

          {quantity > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-black text-white shadow-lg">
              {quantity}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-950 dark:text-zinc-50">
                {product.name}
              </h3>
              {description && (
                <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-gray-500 dark:text-zinc-400">
                  {description}
                </p>
              )}
            </div>

            {priceCents > 0 && (
              <p className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black tabular-nums text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {formatMoney(priceCents / 100)}
              </p>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {unavailable && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-600 dark:bg-red-500/10 dark:text-red-300">
                Indisponível
              </span>
            )}
            {hasOptions && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                {hasRequiredOptions ? 'Opções obrigatórias' : 'Opções'}
              </span>
            )}
            {scheduledOnly && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                Sob encomenda
              </span>
            )}
            {product.isPromotion && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-600 dark:bg-red-500/10 dark:text-red-300">
                Promoção
              </span>
            )}
          </div>

          {scheduledOnly && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-4 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Produto sob encomenda. Use o fluxo de agendamento da loja pública.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
        {quantity > 0 && !hasOptions && (
          <button
            type="button"
            onClick={() => setShowObs((value) => !value)}
            className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 transition hover:bg-white hover:text-orange-600 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-orange-300"
            title="Observação do último item simples"
            aria-label="Observação do último item simples"
          >
            <FiMessageSquare size={16} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRemove(product.id)}
            disabled={quantity === 0}
            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            aria-label="Remover item"
          >
            <FiMinus size={15} />
          </button>

          <span className="w-8 text-center text-sm font-black tabular-nums text-gray-950 dark:text-zinc-50">
            {quantity}
          </span>

          <button
            type="button"
            onClick={() => {
              if (blocked) return
              onAdd(product)
            }}
            disabled={blocked}
            className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-zinc-800"
            aria-label="Adicionar item"
          >
            <FiPlus size={15} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showObs && quantity > 0 && !hasOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-gray-100 dark:border-white/10"
          >
            <div className="p-3">
              <input
                type="text"
                onChange={(e) => onObsChange(product.id, e.target.value)}
                placeholder="Observação do item simples: sem cebola, ao ponto..."
                maxLength={200}
                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200 dark:focus:ring-orange-500/20"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

function OptionConfigurator({ product, onClose, onConfirm }) {
  const groups = useMemo(() => normalizeOptionGroups(product), [product])
  const [selectedByGroup, setSelectedByGroup] = useState(() => {
    const initial = {}
    groups.forEach((group) => {
      initial[group.id] = []
    })
    return initial
  })
  const [quantity, setQuantity] = useState(1)
  const [observation, setObservation] = useState('')
  const [error, setError] = useState('')

  const selectedPayload = useMemo(() => (
    buildSelectionPayload(product, groups, selectedByGroup)
  ), [groups, product, selectedByGroup])

  const unitCents = getProductPriceCents(product) + selectedPayload.selectedOptionsFlat.reduce((acc, option) => (
    acc + Math.max(0, Number(option.priceCents || 0))
  ), 0)

  const toggleOption = useCallback((group, option) => {
    setError('')
    setSelectedByGroup((prev) => {
      const current = prev[group.id] || []
      const selected = current.includes(option.id)

      if (selected) {
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== option.id),
        }
      }

      if (group.max <= 1) {
        return {
          ...prev,
          [group.id]: [option.id],
        }
      }

      if (current.length >= group.max) return prev

      return {
        ...prev,
        [group.id]: [...current, option.id],
      }
    })
  }, [])

  const handleConfirm = useCallback(() => {
    const invalidMessage = getSelectionError(groups, selectedByGroup)
    if (invalidMessage) {
      setError(invalidMessage)
      return
    }

    onConfirm({
      product,
      quantity,
      observation,
      ...selectedPayload,
    })
  }, [groups, observation, onConfirm, product, quantity, selectedByGroup, selectedPayload])

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div
          className="absolute inset-0 bg-zinc-950/70 sm:backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        <motion.div
          variants={MINI_MODAL_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl dark:bg-[#17171a] sm:rounded-[2rem]"
        >
          <header className="border-b border-gray-100 bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950 px-5 py-4 text-white dark:border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-200">
                  Configurar produto
                </p>
                <h3 className="mt-1 truncate text-xl font-black">
                  {product?.name || 'Produto'}
                </h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-zinc-300">
                  Escolha as opções obrigatórias antes de adicionar ao pedido de balcão.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-zinc-200 transition hover:bg-white/15 hover:text-white"
                aria-label="Fechar configuração"
              >
                <FiX size={20} />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 pratoby-scrollbar">
            <div className="space-y-4">
              {groups.map((group) => {
                const selectedIds = selectedByGroup[group.id] || []
                return (
                  <section
                    key={group.id}
                    className="rounded-[1.35rem] border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-gray-950 dark:text-zinc-50">
                          {group.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-zinc-400">
                          {group.required
                            ? `Escolha ${group.min}${group.max > group.min ? ` a ${group.max}` : ''}`
                            : `Opcional · até ${group.max}`}
                        </p>
                      </div>

                      {group.required && (
                        <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                          Obrigatório
                        </span>
                      )}
                    </div>

                    <div className="grid gap-2">
                      {group.options.map((option) => {
                        const selected = selectedIds.includes(option.id)
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleOption(group, option)}
                            className={[
                              'flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition',
                              selected
                                ? 'border-orange-300 bg-orange-50 text-orange-800 ring-2 ring-orange-500/10 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-100'
                                : 'border-gray-100 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-orange-500/10',
                            ].join(' ')}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={[
                                'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                                selected
                                  ? 'border-orange-500 bg-orange-500 text-white'
                                  : 'border-gray-300 bg-white dark:border-white/20 dark:bg-white/5',
                              ].join(' ')}
                              >
                                {selected && <FiCheckCircle size={12} />}
                              </span>
                              <span className="min-w-0 text-sm font-black">
                                {option.name}
                              </span>
                            </span>

                            {option.priceCents > 0 && (
                              <span className="shrink-0 text-xs font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                                +{formatMoney(option.priceCents / 100)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}

              <section className="rounded-[1.35rem] border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-gray-500 dark:text-zinc-400">
                    <FiMessageSquare size={13} />
                    Observação deste item
                  </span>
                  <input
                    type="text"
                    value={observation}
                    onChange={(event) => setObservation(event.target.value)}
                    placeholder="Ex.: gelado, sem gelo, dividir embalagem..."
                    maxLength={200}
                    className="h-11 w-full rounded-2xl border border-gray-100 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-zinc-950/30 dark:text-white dark:focus:ring-orange-500/15"
                  />
                </label>

                <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2 dark:bg-white/[0.04]">
                  <span className="text-xs font-black text-gray-500 dark:text-zinc-400">
                    Quantidade
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                    >
                      <FiMinus size={15} />
                    </button>
                    <span className="w-8 text-center text-sm font-black tabular-nums text-gray-950 dark:text-zinc-50">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white transition hover:bg-orange-600"
                    >
                      <FiPlus size={15} />
                    </button>
                  </div>
                </div>
              </section>

              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  <FiAlertTriangle size={18} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-gray-100 bg-white/95 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#17171a]/95">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500">
                  Valor configurado
                </p>
                <p className="text-xl font-black tabular-nums text-gray-950 dark:text-zinc-50">
                  {formatMoney((unitCents * quantity) / 100)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-black text-white shadow-xl shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98]"
              >
                <FiPlus size={16} />
                Adicionar
              </button>
            </div>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function EmptyState({ search }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-orange-500 shadow-sm dark:bg-white/10">
        <FiSearch size={22} />
      </div>
      <p className="mt-3 text-sm font-black text-gray-900 dark:text-zinc-100">
        {search ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
      </p>
      <p className="mt-1 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
        {search
          ? 'Tente buscar por outro nome ou limpe o campo de busca.'
          : 'Cadastre produtos ativos para criar pedidos de balcão.'}
      </p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CounterOrderModal({ storeId, store, onClose, onSuccess }) {
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState(null)
  const [productsReloadKey, setProductsReloadKey] = useState(0)

  // cart: { [lineKey]: { productId, qty, obs, selectedOptionGroups, selectedOptionsFlat, extras } }
  const [cart, setCart] = useState({})
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('dinheiro')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [configuringProduct, setConfiguringProduct] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const searchRef = useRef(null)
  const safeStoreId = useMemo(() => getSafeStoreId(storeId), [storeId])

  // ── Carregar produtos ───────────────────────────────────────────────────────
  useEffect(() => {
    let active = true

    if (!safeStoreId) return undefined

    queueMicrotask(() => {
      if (!active) return
      setLoadingProducts(true)
      setProductsError(null)
    })

    // Lê da coleção privada `products` — acessível via canManageStoreId
    // independente do status de billing da loja (ao contrário de publicStores).
    const productsQuery = query(
      collection(db, 'products'),
      where('storeId', '==', safeStoreId),
      orderBy('order', 'asc'),
    )

    getDocs(productsQuery)
      .then((snap) => {
        if (active) setProducts(normalizeProducts(snap.docs))
      })
      .catch(() => {
        // Fallback: tenta sem orderBy (índice pode não existir)
        getDocs(query(
          collection(db, 'products'),
          where('storeId', '==', safeStoreId),
        ))
          .then((snap) => {
            if (active) setProducts(normalizeProducts(snap.docs))
          })
          .catch(() => {
            if (active) {
              setProducts([])
              setProductsError('Não foi possível carregar os produtos.')
            }
          })
      })
      .finally(() => {
        if (active) setLoadingProducts(false)
      })

    return () => {
      active = false
    }
  }, [productsReloadKey, safeStoreId])

  // ── Focar no search ao abrir ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 120)
    return () => clearTimeout(timer)
  }, [])

  // ── Fechar com Esc ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape' && !configuringProduct && !submitting) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [configuringProduct, onClose, submitting])

  // ── Helpers de carrinho ─────────────────────────────────────────────────────
  const addSimpleItem = useCallback((product) => {
    const productId = product?.id
    if (!productId) return

    const groups = normalizeOptionGroups(product)
    if (groups.length > 0) {
      setSubmitError(null)
      setConfiguringProduct(product)
      return
    }

    setSubmitError(null)
    setCart((prev) => {
      if (!prev[productId] && Object.keys(prev).length >= MAX_COUNTER_ITEMS) return prev

      return {
        ...prev,
        [productId]: {
          productId,
          qty: clampQuantity((prev[productId]?.qty || 0) + 1),
          obs: prev[productId]?.obs || '',
          selectedOptionGroups: [],
          selectedOptionsFlat: [],
          extras: [],
        },
      }
    })
  }, [])

  const addConfiguredItem = useCallback((payload) => {
    const productId = payload?.product?.id
    if (!productId) return

    setCart((prev) => {
      const existing = prev[payload.lineKey]
      return {
        ...prev,
        [payload.lineKey]: {
          productId,
          qty: clampQuantity((existing?.qty || 0) + clampQuantity(payload.quantity)),
          obs: sanitizePlainText(payload.observation || existing?.obs || '', MAX_ITEM_OBSERVATION_LENGTH),
          selectedOptionGroups: payload.selectedOptionGroups || [],
          selectedOptionsFlat: payload.selectedOptionsFlat || [],
          extras: payload.extras || [],
        },
      }
    })

    setConfiguringProduct(null)
  }, [])

  const removeItem = useCallback((productId) => {
    setCart((prev) => {
      const matchingLineKey = Object.keys(prev).find((lineKey) => prev[lineKey]?.productId === productId)
      if (!matchingLineKey) return prev

      const current = prev[matchingLineKey]?.qty || 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[matchingLineKey]
        return next
      }

      return {
        ...prev,
        [matchingLineKey]: {
          ...prev[matchingLineKey],
          qty: current - 1,
        },
      }
    })
  }, [])

  const removeLine = useCallback((lineKey) => {
    setCart((prev) => {
      const next = { ...prev }
      delete next[lineKey]
      return next
    })
  }, [])

  const updateLineQuantity = useCallback((lineKey, delta) => {
    setCart((prev) => {
      const current = prev[lineKey]
      if (!current) return prev

      const nextQty = Math.max(0, Math.min(MAX_LINE_QUANTITY, Number(current.qty || 0) + delta))
      if (nextQty <= 0) {
        const next = { ...prev }
        delete next[lineKey]
        return next
      }

      return {
        ...prev,
        [lineKey]: {
          ...current,
          qty: nextQty,
        },
      }
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart({})
    setNote('')
    setSubmitError(null)
  }, [])

  const setObs = useCallback((productId, obs) => {
    setCart((prev) => {
      const lineKey = Object.keys(prev).find((key) => key === productId)
      if (!lineKey || !prev[lineKey]) return prev

      return {
        ...prev,
        [lineKey]: { ...prev[lineKey], obs: limitInputText(obs, MAX_ITEM_OBSERVATION_LENGTH) },
      }
    })
  }, [])

  // ── Derivados ───────────────────────────────────────────────────────────────
  const cartProductMap = useMemo(() => (
    Object.fromEntries(products.map((product) => [product.id, product]))
  ), [products])

  const counterProducts = useMemo(() => {
    return products.filter((product) => !isProductDeletedOrHidden(product))
  }, [products])

  const categories = useMemo(() => {
    const counts = new Map()
    counterProducts.forEach((product) => {
      const category = getProductCategory(product)
      counts.set(category, (counts.get(category) || 0) + 1)
    })

    return [
      { key: 'all', label: 'Todos', count: counterProducts.length },
      ...Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
        .map(([label, count]) => ({ key: label, label, count })),
    ]
  }, [counterProducts])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search)

    return counterProducts.filter((product) => {
      if (activeCategory !== 'all' && getProductCategory(product) !== activeCategory) return false
      if (!normalizedSearch) return true

      return normalizeText(`${product.name || ''} ${product.description || ''}`).includes(normalizedSearch)
    })
  }, [activeCategory, counterProducts, search])

  const cartItems = useMemo(() => Object.entries(cart)
    .filter(([, value]) => value.qty > 0)
    .map(([lineKey, item]) => ({
      lineKey,
      productId: item.productId,
      qty: item.qty,
      obs: item.obs,
      selectedOptionGroups: item.selectedOptionGroups || [],
      selectedOptionsFlat: item.selectedOptionsFlat || [],
      extras: item.extras || [],
      product: cartProductMap[item.productId],
    }))
    .filter((item) => item.product), [cart, cartProductMap])

  const productQuantities = useMemo(() => {
    const quantities = {}
    cartItems.forEach((item) => {
      quantities[item.productId] = (quantities[item.productId] || 0) + item.qty
    })
    return quantities
  }, [cartItems])

  const totalCents = useMemo(() => cartItems.reduce((acc, item) => (
    acc + getLineUnitPriceCents(item) * item.qty
  ), 0), [cartItems])

  const totalItems = useMemo(() => cartItems.reduce((acc, item) => acc + item.qty, 0), [cartItems])
  const hasItems = cartItems.length > 0
  const enabledPaymentOptions = useMemo(() => getStoreEnabledPaymentOptions(store), [store])
  const enabledPaymentKeys = useMemo(() => new Set(enabledPaymentOptions.map((option) => option.key)), [enabledPaymentOptions])
  const selectedPayment = enabledPaymentOptions.find((option) => option.key === paymentMethod) || enabledPaymentOptions[0] || PAYMENT_OPTIONS[0]
  const paymentAllowedByStore = enabledPaymentKeys.has(paymentMethod)
  const visibleProductsError = safeStoreId ? productsError : 'Loja inválida para criar pedido de balcão.'
  const visibleLoadingProducts = Boolean(safeStoreId && loadingProducts)
  const canSubmit = Boolean(
    hasItems &&
    safeStoreId &&
    totalCents > 0 &&
    ALLOWED_PAYMENT_METHODS.has(paymentMethod) &&
    paymentAllowedByStore &&
    !visibleLoadingProducts &&
    !visibleProductsError &&
    !submitting
  )


  useEffect(() => {
    if (!enabledPaymentOptions.length) return
    if (!enabledPaymentOptions.some((option) => option.key === paymentMethod)) {
      setPaymentMethod(enabledPaymentOptions[0].key)
    }
  }, [enabledPaymentOptions, paymentMethod])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting) return

    if (!safeStoreId) {
      setSubmitError('Loja inválida para criar pedido de balcão.')
      return
    }

    if (!hasItems) {
      setSubmitError('Adicione ao menos 1 produto antes de criar o pedido.')
      return
    }

    if (cartItems.length > MAX_COUNTER_ITEMS) {
      setSubmitError(`O pedido de balcão aceita no máximo ${MAX_COUNTER_ITEMS} linhas de itens.`)
      return
    }

    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod) || !paymentAllowedByStore) {
      setSubmitError('Este método de pagamento não está ativo para esta loja. Configure em Pagamentos ou escolha outro método.')
      return
    }

    const itemsPayload = cartItems.map((item) => ({
      productId: String(item.productId || '').trim(),
      quantity: clampQuantity(item.qty),
      observation: sanitizePlainText(item.obs, MAX_ITEM_OBSERVATION_LENGTH),
      selectedOptionGroups: Array.isArray(item.selectedOptionGroups) ? item.selectedOptionGroups : [],
      selectedOptionsFlat: Array.isArray(item.selectedOptionsFlat) ? item.selectedOptionsFlat : [],
      extras: Array.isArray(item.extras) ? item.extras : [],
    })).filter((item) => item.productId)

    if (!itemsPayload.length) {
      setSubmitError('Os itens do pedido estão inválidos. Recarregue os produtos e tente novamente.')
      return
    }

    setSubmitError(null)
    setSubmitting(true)

    try {
      const fn = httpsCallable(functions, 'createMerchantCounterOrder')
      const result = await fn({
        storeId: safeStoreId,
        items: itemsPayload,
        paymentMethod,
        customerName: sanitizePlainText(customerName, MAX_CUSTOMER_NAME_LENGTH) || undefined,
        note: sanitizePlainText(note, MAX_NOTE_LENGTH) || undefined,
      })

      onSuccess?.(result.data)
    } catch (err) {
      setSubmitError(getCallableErrorMessage(err) || 'Erro ao criar pedido. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }, [cartItems, customerName, hasItems, note, onSuccess, paymentAllowedByStore, paymentMethod, safeStoreId, submitting])

  // ─── Render ─────────────────────────────────────────────────────────────────
  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        {/* Overlay */}
        <motion.div
          key="counter-overlay"
          className="absolute inset-0 bg-zinc-950/75 sm:backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!submitting) onClose()
          }}
        />

        {/* Modal */}
        <motion.div
          key="counter-modal"
          variants={MODAL_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="counter-order-title"
          className="relative z-10 flex h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2rem] bg-[#f7f7f8] shadow-2xl dark:bg-[#111113] sm:h-[min(92dvh,820px)] sm:rounded-[2rem]"
        >
          {/* Header */}
          <header className="relative overflow-hidden border-b border-white/10 bg-zinc-950 px-5 py-4 text-white sm:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.35),transparent_38%),radial-gradient(circle_at_top_right,rgba(234,88,12,0.18),transparent_34%)]" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                <FiShoppingBag size={22} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="counter-order-title" className="text-lg font-black tracking-tight">
                    Pedido de balcão
                  </h2>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-orange-100 ring-1 ring-white/10">
                    Presencial
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-200 ring-1 ring-white/10">
                    Sem endereço
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-200 ring-1 ring-white/10">
                    Retirada balcão
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold leading-5 text-zinc-300 sm:text-sm">
                  Monte um pedido presencial usando os produtos cadastrados da loja.
                </p>
              </div>

              {hasItems && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-200 transition hover:bg-white/10 sm:inline-flex"
                >
                  <FiTrash2 size={14} />
                  Limpar
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-zinc-200 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar pedido de balcão"
              >
                <FiX size={20} />
              </button>
            </div>
          </header>

          {/* Body */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_390px]">
            {/* Produtos */}
            <section className="min-h-0 overflow-y-auto p-4 pratoby-scrollbar sm:p-5">
              <div className={`${PANEL_CLASS} overflow-hidden`}>
                <div className="border-b border-gray-100 p-4 dark:border-white/10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <FiSearch
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar produto do cardápio..."
                        className="h-12 w-full rounded-2xl border border-gray-100 bg-gray-50 pl-11 pr-4 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-orange-500/50 dark:focus:bg-white/[0.06] dark:focus:ring-orange-500/15"
                      />
                    </div>

                    {hasItems && (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 text-xs font-black text-gray-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-red-500/10 dark:hover:text-red-300 sm:hidden"
                      >
                        <FiTrash2 size={14} />
                        Limpar pedido
                      </button>
                    )}
                  </div>

                  {categories.length > 1 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 pratoby-scrollbar">
                      {categories.map((category) => {
                        const active = activeCategory === category.key
                        return (
                          <button
                            key={category.key}
                            type="button"
                            onClick={() => setActiveCategory(category.key)}
                            className={[
                              'shrink-0 rounded-2xl px-3.5 py-2 text-xs font-black transition',
                              active
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-700 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-200',
                            ].join(' ')}
                          >
                            {category.label}
                            <span className={active ? 'ml-1.5 text-orange-100' : 'ml-1.5 text-gray-400'}>
                              {category.count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {visibleLoadingProducts && (
                    <div className="flex items-center justify-center gap-3 py-14 text-gray-400">
                      <FiLoader size={20} className="animate-spin" />
                      <span className="text-sm font-bold">Carregando produtos...</span>
                    </div>
                  )}

                  {visibleProductsError && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                      <div className="flex items-start gap-3">
                        <FiAlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p>{visibleProductsError}</p>
                          <button
                            type="button"
                            onClick={() => setProductsReloadKey((value) => value + 1)}
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!visibleLoadingProducts && !visibleProductsError && (
                    <div className="grid gap-3 xl:grid-cols-2">
                      {filteredProducts.length === 0 && (
                        <div className="xl:col-span-2">
                          <EmptyState search={search} />
                        </div>
                      )}

                      {filteredProducts.map((product) => (
                        <ProductItem
                          key={product.id}
                          product={product}
                          quantity={productQuantities[product.id] || 0}
                          onAdd={addSimpleItem}
                          onRemove={removeItem}
                          onObsChange={setObs}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Resumo */}
            <aside className="flex min-h-0 flex-col border-t border-gray-200 bg-white dark:border-white/10 dark:bg-[#151518] lg:border-l lg:border-t-0">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pratoby-scrollbar sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-500">
                      Pedido atual
                    </p>
                    <h3 className="mt-1 text-xl font-black text-gray-950 dark:text-zinc-50">
                      {hasItems ? `${totalItems} item${totalItems === 1 ? '' : 's'}` : 'Vazio'}
                    </h3>
                  </div>
                  <div className="rounded-2xl bg-orange-50 px-3 py-2 text-right dark:bg-orange-500/10">
                    <p className="text-[10px] font-black uppercase tracking-wide text-orange-600 dark:text-orange-300">
                      Total
                    </p>
                    <p className="text-lg font-black tabular-nums text-orange-700 dark:text-orange-200">
                      {formatMoney(totalCents / 100)}
                    </p>
                  </div>
                </div>

                {!hasItems ? (
                  <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-orange-500 shadow-sm dark:bg-white/10">
                      <FiShoppingBag size={26} />
                    </div>
                    <p className="mt-4 text-sm font-black text-gray-900 dark:text-zinc-100">
                      Adicione produtos para montar o pedido.
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                      Use a busca ou escolha uma categoria para vender rápido no balcão.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cartItems.map((item) => {
                      const lineTotal = getLineUnitPriceCents(item) * item.qty
                      const optionLines = getCartLineOptionsLabel(item)

                      return (
                        <div
                          key={item.lineKey}
                          className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-950 dark:text-zinc-50">
                                {item.qty}× {item.product.name}
                              </p>

                              {optionLines.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {optionLines.map((line) => (
                                    <p
                                      key={line}
                                      className="text-[11px] font-semibold leading-4 text-violet-700 dark:text-violet-300"
                                    >
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              )}

                              {item.obs && (
                                <p className="mt-1 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                                  Obs.: {item.obs}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black tabular-nums text-gray-950 dark:text-zinc-50">
                                {formatMoney(lineTotal / 100)}
                              </p>

                              <div className="mt-2 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateLineQuantity(item.lineKey, -1)}
                                  className="grid h-7 w-7 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                                >
                                  <FiMinus size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateLineQuantity(item.lineKey, 1)}
                                  className="grid h-7 w-7 place-items-center rounded-lg bg-orange-500 text-white transition hover:bg-orange-600"
                                >
                                  <FiPlus size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeLine(item.lineKey)}
                                  className="grid h-7 w-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  <FiTrash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  {/* Pagamento */}
                  <section className="rounded-[1.35rem] border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="mb-3 flex items-center gap-2">
                      <FiCreditCard className="text-orange-500" size={17} />
                      <p className="text-xs font-black uppercase tracking-[0.13em] text-gray-500 dark:text-zinc-400">
                        Pagamento presencial
                      </p>
                    </div>

                    {!enabledPaymentOptions.length && (
                      <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        <FiAlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>
                          Nenhuma forma de pagamento presencial está ativa. Configure em <strong>Pagamentos</strong> antes de criar pedidos de balcão.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      {enabledPaymentOptions.map((option) => {
                        const Icon = option.icon
                        const active = paymentMethod === option.key

                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setPaymentMethod(option.key)}
                            className={[
                              'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                              active
                                ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm ring-2 ring-orange-500/10 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-100'
                                : 'border-gray-100 bg-white text-gray-700 hover:border-orange-200 hover:bg-orange-50/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-orange-500/10',
                            ].join(' ')}
                          >
                            <span className={[
                              'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                              active ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-zinc-400',
                            ].join(' ')}
                            >
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-black">{option.label}</span>
                              <span className="block text-[11px] font-semibold opacity-70">{option.hint}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {paymentMethod === 'pix_manual' && (
                      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        <FiAlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>
                          Pedido criado como <strong>Pix pendente</strong>. Confirme o recebimento
                          manualmente na tela de pedidos.
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Dados opcionais */}
                  <section className="rounded-[1.35rem] border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="mb-3 flex items-center gap-2">
                      <FiUser className="text-orange-500" size={17} />
                      <p className="text-xs font-black uppercase tracking-[0.13em] text-gray-500 dark:text-zinc-400">
                        Cliente opcional
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-black text-gray-500 dark:text-zinc-400">
                          Nome para chamar no balcão
                        </span>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(event) => setCustomerName(limitInputText(event.target.value, MAX_CUSTOMER_NAME_LENGTH))}
                          placeholder="Ex.: João, Mesa 5..."
                          maxLength={80}
                          className="h-11 w-full rounded-2xl border border-gray-100 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-zinc-950/30 dark:text-white dark:focus:ring-orange-500/15"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-gray-500 dark:text-zinc-400">
                          <FiFileText size={13} />
                          Observação geral
                        </span>
                        <textarea
                          value={note}
                          onChange={(event) => setNote(limitInputText(event.target.value, MAX_NOTE_LENGTH))}
                          placeholder="Ex.: cliente aguarda no balcão, levar talheres..."
                          maxLength={300}
                          rows={3}
                          className="w-full resize-none rounded-2xl border border-gray-100 bg-white px-3 py-2 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100 dark:border-white/10 dark:bg-zinc-950/30 dark:text-white dark:focus:ring-orange-500/15"
                        />
                      </label>
                    </div>
                  </section>

                  {/* Fluxo operacional */}
                  <section className="rounded-[1.35rem] border border-orange-100 bg-orange-50/70 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-orange-600 shadow-sm dark:bg-black/10 dark:text-orange-200">
                        <FiLayers size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-black text-gray-950 dark:text-orange-50">
                          Vai para a operação como balcão
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-gray-600 dark:text-orange-100/80">
                          Será criado sem endereço, como pedido presencial/retirada no balcão.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Erro de submit */}
                  {submitError && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                      <FiAlertTriangle size={18} className="mt-0.5 shrink-0" />
                      {submitError}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 bg-white/95 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#151518]/95">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500">
                      Total do balcão
                    </p>
                    <p className="text-2xl font-black tabular-nums text-gray-950 dark:text-zinc-50">
                      {formatMoney(totalCents / 100)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 px-3 py-2 text-right dark:bg-white/[0.05]">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                      Método
                    </p>
                    <p className="text-xs font-black text-gray-800 dark:text-zinc-200">
                      {selectedPayment.label}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={[
                    'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all',
                    canSubmit
                      ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20 hover:bg-orange-600 active:scale-[0.98]'
                      : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500',
                  ].join(' ')}
                >
                  {submitting ? (
                    <>
                      <FiLoader size={17} className="animate-spin" />
                      Criando pedido...
                    </>
                  ) : (
                    <>
                      <FiCheckCircle size={17} />
                      {hasItems
                        ? `Criar pedido de balcão · ${formatMoney(totalCents / 100)}`
                        : 'Adicione ao menos 1 produto'}
                    </>
                  )}
                </button>
              </div>
            </aside>
          </div>
        </motion.div>

        {configuringProduct && (
          <OptionConfigurator
            product={configuringProduct}
            onClose={() => setConfiguringProduct(null)}
            onConfirm={addConfiguredItem}
          />
        )}
      </div>
    </AnimatePresence>,
    document.body
  )
}

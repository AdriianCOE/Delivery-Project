import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  collection,
  getDocs,
  query,
  orderBy,
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
  { key: 'maquininha', label: 'Maquininha', icon: FiCreditCard, hint: 'Cartão presencial' },
  { key: 'pix_manual', label: 'Pix manual', icon: FiZap, hint: 'Confirmar manualmente' },
  { key: 'credito', label: 'Crédito', icon: FiCreditCard, hint: 'Maquininha crédito' },
  { key: 'debito', label: 'Débito', icon: FiCreditCard, hint: 'Maquininha débito' },
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

const PANEL_CLASS = 'rounded-[1.5rem] border border-white/10 bg-white shadow-sm ring-1 ring-black/[0.03] dark:bg-[#18181b] dark:shadow-black/20 dark:ring-white/[0.03]'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function getProductPriceCents(product) {
  const candidates = [product?.priceCents, product?.priceInCents]
  for (const c of candidates) {
    if (c !== undefined && c !== null && Number.isFinite(Number(c))) {
      return Math.max(0, Math.round(Number(c)))
    }
  }
  const price = Number(product?.price || 0)
  if (Number.isFinite(price) && price > 0) return Math.round(price * 100)
  return 0
}

function isProductAvailable(product) {
  if (!product) return false
  if (product.isDeleted === true || product.deletedAt) return false
  if (product.isActive === false || product.active === false) return false
  if (product.isAvailable === false || product.available === false) return false
  if (product.isVisible === false || product.hidden === true) return false
  const stock = product.stock
  if (stock !== undefined && stock !== null && stock !== '' && Number(stock) <= 0) return false
  return true
}

function normalizeProducts(docs) {
  return docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(isProductAvailable)
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

function hasProductOptionGroups(product) {
  return [
    product?.optionGroups,
    product?.optionsGroups,
    product?.modifiers,
    product?.complements,
    product?.extrasGroups,
  ].some((value) => Array.isArray(value) && value.length > 0)
}

function hasRequiredProductOptions(product) {
  const groups = [
    product?.optionGroups,
    product?.optionsGroups,
    product?.modifiers,
    product?.complements,
    product?.extrasGroups,
  ].find((value) => Array.isArray(value))

  return Boolean(groups?.some((group) => (
    group?.required === true ||
    group?.isRequired === true ||
    Number(group?.min || group?.minSelection || group?.minSelections || 0) > 0
  )))
}

function isScheduledOnlyProduct(product) {
  return product?.scheduling?.mode === 'scheduled_only'
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ProductItem({ product, cartItem, onAdd, onRemove, onObsChange }) {
  const priceCents = getProductPriceCents(product)
  const qty = cartItem?.qty || 0
  const [showObs, setShowObs] = useState(false)
  const description = getProductDescription(product)
  const hasOptions = hasProductOptionGroups(product)
  const hasRequiredOptions = hasRequiredProductOptions(product)
  const scheduledOnly = isScheduledOnlyProduct(product)
  const blocked = hasRequiredOptions || scheduledOnly

  return (
    <article
      className={[
        'group overflow-hidden rounded-[1.35rem] border bg-white shadow-sm transition-all dark:bg-[#1f1f23]',
        qty > 0
          ? 'border-orange-200 ring-2 ring-orange-500/10 dark:border-orange-500/35'
          : 'border-gray-100 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/10 dark:border-white/10 dark:hover:border-orange-500/25',
        blocked ? 'opacity-85' : '',
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

          {qty > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-black text-white shadow-lg">
              {qty}
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
            {hasOptions && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                Opções
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

          {blocked && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-4 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              {scheduledOnly
                ? 'Produto sob encomenda. Use o fluxo de agendamento da loja pública.'
                : 'Produto com opções obrigatórias. Configure pelo fluxo completo antes de vender.'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
        {qty > 0 && (
          <button
            type="button"
            onClick={() => setShowObs((value) => !value)}
            className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 transition hover:bg-white hover:text-orange-600 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-orange-300"
            title="Observação do item"
            aria-label="Observação do item"
          >
            <FiMessageSquare size={16} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRemove(product.id)}
            disabled={qty === 0}
            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            aria-label="Remover item"
          >
            <FiMinus size={15} />
          </button>

          <span className="w-8 text-center text-sm font-black tabular-nums text-gray-950 dark:text-zinc-50">
            {qty}
          </span>

          <button
            type="button"
            onClick={() => onAdd(product.id)}
            disabled={blocked}
            className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-zinc-800"
            aria-label="Adicionar item"
          >
            <FiPlus size={15} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showObs && qty > 0 && (
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
                value={cartItem?.obs || ''}
                onChange={(e) => onObsChange(product.id, e.target.value)}
                placeholder="Observação do item: sem cebola, ao ponto..."
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

export default function CounterOrderModal({ storeId, onClose, onSuccess }) {
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState(null)

  // cart: { [productId]: { qty: number, obs: string } }
  const [cart, setCart] = useState({})
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [paymentMethod, setPaymentMethod] = useState('dinheiro')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const searchRef = useRef(null)

  // ── Carregar produtos ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return

    setLoadingProducts(true)
    setProductsError(null)

    const productsRef = collection(db, 'publicStores', storeId, 'products')
    const productsQuery = query(productsRef, orderBy('order', 'asc'))

    getDocs(productsQuery)
      .then((snap) => {
        setProducts(normalizeProducts(snap.docs))
      })
      .catch(() => {
        // Fallback: tenta sem orderBy (índice pode não existir)
        getDocs(collection(db, 'publicStores', storeId, 'products'))
          .then((snap) => setProducts(normalizeProducts(snap.docs)))
          .catch(() => setProductsError('Não foi possível carregar os produtos.'))
      })
      .finally(() => setLoadingProducts(false))
  }, [storeId])

  // ── Focar no search ao abrir ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 120)
    return () => clearTimeout(timer)
  }, [])

  // ── Fechar com Esc ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Helpers de carrinho ─────────────────────────────────────────────────────
  const addItem = useCallback((productId) => {
    setCart((prev) => ({
      ...prev,
      [productId]: { qty: (prev[productId]?.qty || 0) + 1, obs: prev[productId]?.obs || '' },
    }))
  }, [])

  const removeItem = useCallback((productId) => {
    setCart((prev) => {
      const current = prev[productId]?.qty || 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[productId]
        return next
      }
      return { ...prev, [productId]: { ...prev[productId], qty: current - 1 } }
    })
  }, [])

  const clearCart = useCallback(() => {
    setCart({})
    setNote('')
    setSubmitError(null)
  }, [])

  const setObs = useCallback((productId, obs) => {
    setCart((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], obs },
    }))
  }, [])

  // ── Derivados ───────────────────────────────────────────────────────────────
  const cartProductMap = useMemo(() => (
    Object.fromEntries(products.map((product) => [product.id, product]))
  ), [products])

  const categories = useMemo(() => {
    const counts = new Map()
    products.forEach((product) => {
      const category = getProductCategory(product)
      counts.set(category, (counts.get(category) || 0) + 1)
    })

    return [
      { key: 'all', label: 'Todos', count: products.length },
      ...Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
        .map(([label, count]) => ({ key: label, label, count })),
    ]
  }, [products])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search)

    return products.filter((product) => {
      if (activeCategory !== 'all' && getProductCategory(product) !== activeCategory) return false
      if (!normalizedSearch) return true

      return normalizeText(`${product.name || ''} ${product.description || ''}`).includes(normalizedSearch)
    })
  }, [activeCategory, products, search])

  const cartItems = useMemo(() => Object.entries(cart)
    .filter(([, value]) => value.qty > 0)
    .map(([productId, { qty, obs }]) => ({
      productId,
      qty,
      obs,
      product: cartProductMap[productId],
    }))
    .filter((item) => item.product), [cart, cartProductMap])

  const totalCents = useMemo(() => cartItems.reduce((acc, { product, qty }) => (
    acc + getProductPriceCents(product) * qty
  ), 0), [cartItems])

  const totalItems = useMemo(() => cartItems.reduce((acc, item) => acc + item.qty, 0), [cartItems])
  const hasItems = cartItems.length > 0
  const selectedPayment = PAYMENT_OPTIONS.find((option) => option.key === paymentMethod) || PAYMENT_OPTIONS[0]

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!hasItems || submitting) return
    setSubmitError(null)
    setSubmitting(true)

    try {
      const fn = httpsCallable(functions, 'createMerchantCounterOrder')
      const result = await fn({
        storeId,
        items: cartItems.map(({ productId, qty, obs }) => ({
          productId,
          quantity: qty,
          observation: obs || '',
        })),
        paymentMethod,
        customerName: customerName.trim() || undefined,
        note: note.trim() || undefined,
      })

      onSuccess?.(result.data)
    } catch (err) {
      setSubmitError(getCallableErrorMessage(err) || 'Erro ao criar pedido. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }, [hasItems, submitting, storeId, cartItems, paymentMethod, customerName, note, onSuccess])

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
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          key="counter-modal"
          variants={MODAL_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
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
                  <h2 className="text-lg font-black tracking-tight">
                    Pedido de balcão
                  </h2>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-orange-100 ring-1 ring-white/10">
                    Presencial
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-200 ring-1 ring-white/10">
                    Sem endereço
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
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-zinc-200 transition hover:bg-white/15 hover:text-white"
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
                  {loadingProducts && (
                    <div className="flex items-center justify-center gap-3 py-14 text-gray-400">
                      <FiLoader size={20} className="animate-spin" />
                      <span className="text-sm font-bold">Carregando produtos...</span>
                    </div>
                  )}

                  {productsError && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                      <FiAlertTriangle size={18} className="mt-0.5 shrink-0" />
                      {productsError}
                    </div>
                  )}

                  {!loadingProducts && !productsError && (
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
                          cartItem={cart[product.id]}
                          onAdd={addItem}
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
                    {cartItems.map(({ productId, qty, obs, product }) => {
                      const lineTotal = getProductPriceCents(product) * qty
                      return (
                        <div
                          key={productId}
                          className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-950 dark:text-zinc-50">
                                {qty}× {product.name}
                              </p>
                              {obs && (
                                <p className="mt-1 text-xs font-semibold leading-5 text-gray-500 dark:text-zinc-400">
                                  Obs.: {obs}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 text-sm font-black tabular-nums text-gray-950 dark:text-zinc-50">
                              {formatMoney(lineTotal / 100)}
                            </p>
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

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      {PAYMENT_OPTIONS.map((option) => {
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
                          onChange={(event) => setCustomerName(event.target.value)}
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
                          onChange={(event) => setNote(event.target.value)}
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
                          Vai para a operação
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-gray-600 dark:text-orange-100/80">
                          O pedido de balcão será criado sem endereço e aparecerá na tela de pedidos conforme o fluxo configurado no backend.
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
                  disabled={!hasItems || submitting}
                  className={[
                    'flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all',
                    hasItems && !submitting
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
      </div>
    </AnimatePresence>,
    document.body
  )
}

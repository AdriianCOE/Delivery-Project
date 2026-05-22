import { useCallback, useEffect, useMemo, useState, useRef } from 'react'

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import {
  FiBox,
  FiCopy,
  FiDollarSign,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiImage,
  FiLayout,
  FiList,
  FiMapPin,
  FiMessageCircle,
  FiPercent,
  FiPlus,
  FiSave,
  FiSearch,
  FiSettings,
  FiShoppingBag,
  FiStar,
  FiTag,
  FiTrash2,
  FiTruck,
  FiX,
} from 'react-icons/fi'

import { db } from '../../services/firebase'

const BAIRROS_ARACAJU = [
  '13 de Julho',
  '17 de Março',
  'Aeroporto',
  'América',
  'Atalaia',
  'Bugio',
  'Capucho',
  'Centro',
  'Cidade Nova',
  'Cirurgia',
  'Coroa do Meio',
  'Dezoito do Forte',
  'Dom Luciano',
  'Farolândia',
  'Getúlio Vargas',
  'Grageru',
  'Inácio Barbosa',
  'Industrial',
  'Jabotiana',
  'Japãozinho',
  'Jardim Centenário',
  'Jardins',
  'José Conrado de Araújo',
  'Lamarão',
  'Luzia',
  'Marivan',
  'Novo Paraíso',
  'Olaria',
  'Palestina',
  'Pereira Lobo',
  'Ponto Novo',
  'Porto Dantas',
  'Salgado Filho',
  'Santa Maria',
  'Santo Antônio',
  'Santos Dumont',
  'São Conrado',
  'São José',
  'Siqueira Campos',
  'Soledade',
  'Suíssa',
  'Zona de Expansão',
]

const EMPTY_PRODUCT_FORM = {
  name: '',
  description: '',
  price: '',
  oldPrice: '',
  categoryId: '',
  imageUrl: '',
  preparationTime: '',
  serves: '',
  stock: '',
  priceDescription: '',
  isAvailable: true,
  isVisible: true,
  isPopular: false,
  isFeatured: false,
  couponEligible: true,
  extras: [],
  optionGroups: [],
}

const EMPTY_COUPON_FORM = {
  code: '',
  type: 'percent',
  value: '',
  minOrder: '',
  maxDiscount: '',
  startsAt: '',
  expiresAt: '',
  targetId: 'all',
  usageLimit: '',
  active: true,
}

const DEFAULT_STORE_EDIT = {
  name: '',
  description: '',
  themeColor: '#f97316',
  isOpen: true,
  isActive: true,
  whatsapp: '',
  instagram: '',
  deliveryTime: '25-40 min',
  minOrder: '0,00',
  deliveryFee: '0,00',
  freeDeliveryFrom: '',
  paymentPix: true,
  paymentCard: true,
  paymentCash: true,
}

const DEFAULT_ADDRESS = {
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  city: '',
  state: 'SE',
}

const TABS = [
  { id: 'loja', icon: FiLayout, label: 'Loja' },
  { id: 'categorias', icon: FiList, label: 'Categorias' },
  { id: 'produtos', icon: FiBox, label: 'Produtos' },
  { id: 'entrega', icon: FiTruck, label: 'Entrega' },
  { id: 'cupons', icon: FiTag, label: 'Cupons' },
  { id: 'avaliacoes', icon: FiStar, label: 'Avaliações' },
]

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))]
}

function getStoreDocId(store) {
  return store?.id || store?.storeId || store?.storeSlug || store?.slug
}

function getFinalStoreId(store) {
  return store?.storeSlug || store?.slug || store?.storeId || store?.id
}

function getStoreKeys(store) {
  return uniqueArray([
    store?.storeSlug,
    store?.slug,
    store?.storeId,
    store?.id,
  ])
}

function parseCurrency(value) {
  let cleaned = String(value || '0').replace(/[^\d.,]/g, '')

  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numericValue = Number(value || 0)

  if (numericValue > 999) return numericValue / 100

  return numericValue
}

function moneyToInput(value, centsValue) {
  return normalizeMoney(value, centsValue).toFixed(2).replace('.', ',')
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function createLocalId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyOption() {
  return {
    id: createLocalId('option'),
    name: '',
    description: '',
    price: '',
    available: true,
  }
}

function createEmptyOptionGroup() {
  return {
    id: createLocalId('group'),
    title: '',
    description: '',
    type: 'single',
    required: true,
    min: '1',
    max: '1',
    pricingMode: 'additive',
    includedQuantity: '1',
    options: [createEmptyOption()],
  }
}

function getRawProductOptionGroups(product) {
  if (Array.isArray(product?.optionGroups)) return product.optionGroups
  if (Array.isArray(product?.optionsGroups)) return product.optionsGroups
  if (Array.isArray(product?.customizationGroups)) return product.customizationGroups

  return []
}

function normalizeProductOptionGroupsForForm(product) {
  return getRawProductOptionGroups(product).map((group, groupIndex) => {
    const type = ['single', 'multiple', 'quantity'].includes(group?.type)
      ? group.type
      : group?.allowQuantity
        ? 'quantity'
        : Number(group?.max || group?.maxSelections || 1) === 1
          ? 'single'
          : 'multiple'

    const required = Boolean(
      group?.required ||
      group?.isRequired ||
      Number(group?.min || group?.minSelections || 0) > 0
    )

    const min = Number(group?.min ?? group?.minSelections ?? (required ? 1 : 0))
    const max = type === 'single'
      ? 1
      : Number(group?.max ?? group?.maxSelections ?? 0)

    return {
      id: group?.id || group?.groupId || createLocalId(`group-${groupIndex}`),
      title: group?.title || group?.name || '',
      description: group?.description || group?.subtitle || '',
      type,
      required,
      min: String(Number.isFinite(min) ? min : required ? 1 : 0),
      max: String(Number.isFinite(max) ? max : type === 'single' ? 1 : 0),
      pricingMode: group?.pricingMode || group?.priceMode || 'additive',
      includedQuantity: String(group?.includedQuantity ?? (min || 1)),
      options: Array.isArray(group?.options)
        ? group.options.map((option, optionIndex) => ({
            id:
              option?.id ||
              option?.optionId ||
              createLocalId(`option-${optionIndex}`),
            name: option?.name || option?.title || '',
            description: option?.description || option?.details || '',
            price: moneyToInput(option?.price, option?.priceCents),
            available: option?.available !== false && option?.isAvailable !== false,
          }))
        : [],
    }
  })
}

function sanitizeOptionGroupsForSave(optionGroups = []) {
  return optionGroups
    .map((group) => {
      const type = ['single', 'multiple', 'quantity'].includes(group.type)
        ? group.type
        : 'single'

      const required = Boolean(group.required)
      const min = Math.max(0, Number(group.min || (required ? 1 : 0)))
      const max = type === 'single'
        ? 1
        : Math.max(0, Number(group.max || 0))

      const options = (Array.isArray(group.options) ? group.options : [])
        .filter((option) => option.name.trim())
        .map((option) => {
          const price = parseCurrency(option.price)
          const optionId = option.id || createLocalId('option')

          return {
            id: optionId,
            optionId,
            name: option.name.trim(),
            description: option.description.trim(),
            price,
            priceCents: Math.round(price * 100),
            available: option.available !== false,
            isAvailable: option.available !== false,
          }
        })

      const groupId = group.id || createLocalId('group')

      return {
        id: groupId,
        groupId,
        title: group.title.trim(),
        name: group.title.trim(),
        description: group.description.trim(),
        type,
        required,
        isRequired: required,
        min,
        minSelections: min,
        max,
        maxSelections: max,
        allowQuantity: type === 'quantity',
        pricingMode: group.pricingMode || 'additive',
        includedQuantity: Math.max(0, Number(group.includedQuantity || min || 1)),
        options,
      }
    })
    .filter((group) => group.title && group.options.length > 0)
}

function normalizePhoneBR(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length >= 10) return `55${digits}`

  return digits
}

function sanitizeSocial(value) {
  return String(value || '').replace('@', '').trim()
}

function getAddressFromStore(store) {
  const address = store?.address || {}

  if (typeof address === 'string') {
    return {
      ...DEFAULT_ADDRESS,
      street: address,
      city: store?.city || '',
      state: store?.state || 'SE',
      neighborhood: store?.neighborhood || '',
      cep: store?.cep || '',
    }
  }

  return {
    cep: address.cep || store?.cep || '',
    street: address.street || address.rua || store?.street || '',
    number: address.number || address.numero || store?.number || '',
    neighborhood:
      address.neighborhood ||
      address.bairro ||
      store?.neighborhood ||
      '',
    complement:
      address.complement ||
      address.complemento ||
      store?.complement ||
      '',
    city: address.city || address.cidade || store?.city || '',
    state: address.state || address.uf || store?.state || 'SE',
  }
}

function getDateLabel(value) {
  if (!value) return '—'

  const date = value?.toDate ? value.toDate() : new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getProductPrice(product) {
  return normalizeMoney(product?.price, product?.priceCents)
}

function getReviewRating(review) {
  return Number(review?.rating || review?.average || 0)
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <Icon size={19} />
        </div>

        <div>
          <h3 className="text-base font-black text-[#111827]">
            {title}
          </h3>

          {description && (
            <p className="mt-1 text-sm leading-6 text-[#6b7280]">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  )
}

function Label({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#6b7280]">
      {children}
    </label>
  )
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
        <Icon size={24} />
      </div>

      <h4 className="mt-4 font-black text-[#111827]">
        {title}
      </h4>

      {description && (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6b7280]">
          {description}
        </p>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-[#f9fafb] p-4">
      <div>
        <p className="text-sm font-black text-[#111827]">
          {label}
        </p>

        {description && (
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">
            {description}
          </p>
        )}
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-[#f97316]"
      />
    </label>
  )
}

export default function MerchantDrawer({
  isOpen,
  onClose,
  store,
  categories = [],
  products = [],
  quickEditProduct = null,
  onQuickEditHandled,
}) {

  const productFormRef = useRef(null)

  
  const [activeTab, setActiveTab] = useState('produtos')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [coupons, setCoupons] = useState([])
  const [reviews, setReviews] = useState([])

  const [storeEdit, setStoreEdit] = useState(DEFAULT_STORE_EDIT)
  const [addressEdit, setAddressEdit] = useState(DEFAULT_ADDRESS)
  const [deliveryFees, setDeliveryFees] = useState({})
  const [deliverySearch, setDeliverySearch] = useState('')

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')

  const [editingProductId, setEditingProductId] = useState(null)
  const [productSearch, setProductSearch] = useState('')
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM)

  const [couponForm, setCouponForm] = useState(EMPTY_COUPON_FORM)

  const storeDocId = getStoreDocId(store)
  const finalStoreId = getFinalStoreId(store)
  const storeKeys = useMemo(() => getStoreKeys(store), [store])

  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter((category) => category?.isDeleted !== true)
      .sort((a, b) => Number(a?.order ?? 9999) - Number(b?.order ?? 9999))
  }, [categories])

  const visibleBairros = useMemo(() => {
    const term = deliverySearch.trim().toLowerCase()

    if (!term) return BAIRROS_ARACAJU

    return BAIRROS_ARACAJU.filter((bairro) =>
      bairro.toLowerCase().includes(term)
    )
  }, [deliverySearch])

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()

    return [...products]
      .filter((product) => product?.isDeleted !== true && !product?.deletedAt)
      .filter((product) => {
        if (!term) return true

        return [
          product.name,
          product.description,
          product.categoryName,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => {
        const orderA = Number(a?.order ?? 9999)
        const orderB = Number(b?.order ?? 9999)

        if (orderA !== orderB) return orderA - orderB

        return String(a?.name || '').localeCompare(String(b?.name || ''))
      })
  }, [productSearch, products])

  const groupedProducts = useMemo(() => {
    return sortedCategories.map((category) => ({
      category,
      products: filteredProducts.filter(
        (product) => product.categoryId === category.id
      ),
    }))
  }, [filteredProducts, sortedCategories])

  const uncategorizedProducts = useMemo(() => {
    const categoryIds = new Set(sortedCategories.map((category) => category.id))

    return filteredProducts.filter(
      (product) => !product.categoryId || !categoryIds.has(product.categoryId)
    )
  }, [filteredProducts, sortedCategories])

  const reviewStats = useMemo(() => {
    if (!reviews.length) {
      return {
        average: 0,
        total: 0,
        openProblems: 0,
      }
    }

    const totalRating = reviews.reduce(
      (acc, review) => acc + getReviewRating(review),
      0
    )

    return {
      average: totalRating / reviews.length,
      total: reviews.length,
      openProblems: reviews.filter(
        (review) => getReviewRating(review) <= 3 && !review.resolved
      ).length,
    }
  }, [reviews])

  const inputClass =
    'h-12 w-full rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100'

  const textareaClass =
    'w-full resize-none rounded-2xl border border-gray-100 bg-[#f9fafb] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100'

  const showToast = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }, [])

  useEffect(() => {
    if (!store) return

    setStoreEdit({
      name: store.name || '',
      description: store.description || '',
      themeColor: store.themeColor || '#f97316',
      isOpen: store.isOpen ?? true,
      isActive: store.isActive ?? true,
      whatsapp: store.whatsapp || store.whatsapp1 || '',
      instagram: store.instagram || store.social?.instagram || '',
      deliveryTime: store.deliveryTime || '25-40 min',
      minOrder: moneyToInput(store.minOrder, store.minOrderCents),
      deliveryFee: moneyToInput(store.deliveryFee, store.deliveryFeeCents),
      freeDeliveryFrom: moneyToInput(
        store.freeDeliveryFrom,
        store.freeDeliveryFromCents
      ),
      paymentPix: store.paymentMethods?.pix ?? true,
      paymentCard: store.paymentMethods?.card ?? true,
      paymentCash: store.paymentMethods?.cash ?? true,
    })

    setAddressEdit(getAddressFromStore(store))
    setDeliveryFees(store.deliveryFees || {})
  }, [store])

  useEffect(() => {
    if (!isOpen || !storeKeys.length) return

    const couponsQuery =
      storeKeys.length === 1
        ? query(collection(db, 'coupons'), where('storeId', '==', storeKeys[0]))
        : query(
            collection(db, 'coupons'),
            where('storeId', 'in', storeKeys.slice(0, 10))
          )

    const unsubscribeCoupons = onSnapshot(
      couponsQuery,
      (snapshot) => {
        setCoupons(
          snapshot.docs
            .map((couponDoc) => ({
              id: couponDoc.id,
              ...couponDoc.data(),
            }))
            .filter((coupon) => coupon.isDeleted !== true)
        )
      },
      () => {
        setCoupons([])
      }
    )

    return () => unsubscribeCoupons()
  }, [isOpen, storeKeys])

  useEffect(() => {
    if (!isOpen || !storeKeys.length) return

    const reviewsQuery =
      storeKeys.length === 1
        ? query(collection(db, 'reviews'), where('storeId', '==', storeKeys[0]))
        : query(
            collection(db, 'reviews'),
            where('storeId', 'in', storeKeys.slice(0, 10))
          )

    const unsubscribeReviews = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        setReviews(
          snapshot.docs
            .map((reviewDoc) => ({
              id: reviewDoc.id,
              ...reviewDoc.data(),
            }))
            .sort((a, b) => {
              const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
              const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
              return dateB - dateA
            })
        )
      },
      () => {
        setReviews([])
      }
    )

    return () => unsubscribeReviews()
  }, [isOpen, storeKeys])

  const handleUpdateStore = useCallback(async () => {
    if (!storeDocId) return

    setLoading(true)

    try {
      const minOrder = parseCurrency(storeEdit.minOrder)
      const deliveryFee = parseCurrency(storeEdit.deliveryFee)
      const freeDeliveryFrom = parseCurrency(storeEdit.freeDeliveryFrom)

      await updateDoc(doc(db, 'stores', storeDocId), {
        name: storeEdit.name.trim(),
        description: storeEdit.description.trim(),
        themeColor: storeEdit.themeColor || '#f97316',
        isOpen: storeEdit.isOpen,
        isActive: storeEdit.isActive,
        whatsapp: normalizePhoneBR(storeEdit.whatsapp),
        whatsapp1: normalizePhoneBR(storeEdit.whatsapp),
        instagram: sanitizeSocial(storeEdit.instagram),
        social: {
          instagram: sanitizeSocial(storeEdit.instagram),
        },
        deliveryTime: storeEdit.deliveryTime.trim() || '25-40 min',

        minOrder,
        minOrderCents: Math.round(minOrder * 100),
        deliveryFee,
        deliveryFeeCents: Math.round(deliveryFee * 100),
        freeDeliveryFrom: freeDeliveryFrom || null,
        freeDeliveryFromCents: freeDeliveryFrom
          ? Math.round(freeDeliveryFrom * 100)
          : null,

        paymentMethods: {
          pix: storeEdit.paymentPix,
          card: storeEdit.paymentCard,
          cash: storeEdit.paymentCash,
        },

        updatedAt: serverTimestamp(),
      })

      showToast('Configurações da loja salvas.')
    } catch (error) {
      console.error(error)
      showToast('Erro ao salvar configurações.')
    } finally {
      setLoading(false)
    }
  }, [showToast, storeDocId, storeEdit])

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim() || !finalStoreId) {
      showToast('Digite o nome da categoria.')
      return
    }

    setLoading(true)

    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim(),
        storeId: finalStoreId,
        storeSlug: finalStoreId,
        order: sortedCategories.length,
        isVisible: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setNewCategoryName('')
      setNewCategoryDescription('')
      showToast('Categoria criada.')
    } catch (error) {
      console.error(error)
      showToast('Erro ao criar categoria.')
    } finally {
      setLoading(false)
    }
  }, [
    finalStoreId,
    newCategoryDescription,
    newCategoryName,
    showToast,
    sortedCategories.length,
  ])

  const handleUpdateCategory = useCallback(
    async (categoryId, data) => {
      try {
        await updateDoc(doc(db, 'categories', categoryId), {
          ...data,
          updatedAt: serverTimestamp(),
        })
      } catch (error) {
        console.error(error)
        showToast('Erro ao atualizar categoria.')
      }
    },
    [showToast]
  )

  const handleArchiveCategory = useCallback(
    async (categoryId) => {
      const confirmed = window.confirm(
        'Arquivar esta categoria? Os produtos não serão excluídos.'
      )

      if (!confirmed) return

      try {
        await updateDoc(doc(db, 'categories', categoryId), {
          isVisible: false,
          isDeleted: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        showToast('Categoria arquivada.')
      } catch (error) {
        console.error(error)
        showToast('Erro ao arquivar categoria.')
      }
    },
    [showToast]
  )

  const addExtraToForm = useCallback(() => {
    setProductForm((prev) => ({
      ...prev,
      extras: [...prev.extras, { name: '', price: '' }],
    }))
  }, [])

  const removeExtraFromForm = useCallback((index) => {
    setProductForm((prev) => ({
      ...prev,
      extras: prev.extras.filter((_, itemIndex) => itemIndex !== index),
    }))
  }, [])


  const addOptionGroupToForm = useCallback(() => {
    setProductForm((prev) => ({
      ...prev,
      optionGroups: [...(prev.optionGroups || []), createEmptyOptionGroup()],
    }))
  }, [])

  const removeOptionGroupFromForm = useCallback((groupIndex) => {
    setProductForm((prev) => ({
      ...prev,
      optionGroups: (prev.optionGroups || []).filter(
        (_, itemIndex) => itemIndex !== groupIndex
      ),
    }))
  }, [])

  const updateOptionGroupInForm = useCallback((groupIndex, patch) => {
    setProductForm((prev) => {
      const nextGroups = [...(prev.optionGroups || [])]
      const currentGroup = nextGroups[groupIndex]

      if (!currentGroup) return prev

      const nextGroup = {
        ...currentGroup,
        ...patch,
      }

      if (patch.type === 'single') {
        nextGroup.required = true
        nextGroup.min = '1'
        nextGroup.max = '1'
      }

      if (patch.type === 'multiple') {
        nextGroup.max = currentGroup.max === '1' ? '0' : currentGroup.max
      }

      if (patch.type === 'quantity') {
        nextGroup.max = currentGroup.max === '1' ? '0' : currentGroup.max
      }

      if (patch.required === false && Number(nextGroup.min || 0) > 0) {
        nextGroup.min = '0'
      }

      if (patch.required === true && Number(nextGroup.min || 0) === 0) {
        nextGroup.min = '1'
      }

      nextGroups[groupIndex] = nextGroup

      return {
        ...prev,
        optionGroups: nextGroups,
      }
    })
  }, [])

  const addOptionToGroupInForm = useCallback((groupIndex) => {
    setProductForm((prev) => {
      const nextGroups = [...(prev.optionGroups || [])]
      const currentGroup = nextGroups[groupIndex]

      if (!currentGroup) return prev

      nextGroups[groupIndex] = {
        ...currentGroup,
        options: [...(currentGroup.options || []), createEmptyOption()],
      }

      return {
        ...prev,
        optionGroups: nextGroups,
      }
    })
  }, [])

  const updateOptionInGroupForm = useCallback((groupIndex, optionIndex, patch) => {
    setProductForm((prev) => {
      const nextGroups = [...(prev.optionGroups || [])]
      const currentGroup = nextGroups[groupIndex]

      if (!currentGroup) return prev

      const nextOptions = [...(currentGroup.options || [])]
      nextOptions[optionIndex] = {
        ...nextOptions[optionIndex],
        ...patch,
      }

      nextGroups[groupIndex] = {
        ...currentGroup,
        options: nextOptions,
      }

      return {
        ...prev,
        optionGroups: nextGroups,
      }
    })
  }, [])

  const removeOptionFromGroupForm = useCallback((groupIndex, optionIndex) => {
    setProductForm((prev) => {
      const nextGroups = [...(prev.optionGroups || [])]
      const currentGroup = nextGroups[groupIndex]

      if (!currentGroup) return prev

      nextGroups[groupIndex] = {
        ...currentGroup,
        options: (currentGroup.options || []).filter(
          (_, itemIndex) => itemIndex !== optionIndex
        ),
      }

      return {
        ...prev,
        optionGroups: nextGroups,
      }
    })
  }, [])

    const scrollToProductForm = useCallback(() => {
    window.setTimeout(() => {
      productFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 150)
  }, [])

  const handleEditProductClick = useCallback((product) => {
  setProductForm({
    name: product.name || '',
    description: product.description || '',
    price: moneyToInput(product.price, product.priceCents),
    oldPrice:
      product.oldPrice || product.oldPriceCents
        ? moneyToInput(product.oldPrice, product.oldPriceCents)
        : '',
    categoryId: product.categoryId || '',
    imageUrl: product.imageUrl || product.image || product.photoUrl || '',
    preparationTime: product.preparationTime || product.prepTime || '',
    serves: product.serves || product.serving || '',
    stock:
      product.stock !== undefined && product.stock !== null
        ? String(product.stock)
        : '',
    priceDescription: product.priceDescription || '',
    isAvailable: product.isAvailable !== false,
    isVisible: product.isVisible !== false,
    isPopular: Boolean(product.isPopular),
    isFeatured: Boolean(product.isFeatured || product.featured),
    couponEligible: product.couponEligible !== false,
    extras: Array.isArray(product.extras)
      ? product.extras
          .filter((extra) => extra?.type !== 'option' && !extra?.groupTitle)
          .map((extra) => ({
            name: extra.name || '',
            price: moneyToInput(extra.price, extra.priceCents),
          }))
      : [],
    optionGroups: normalizeProductOptionGroupsForForm(product),
  })

  setEditingProductId(product.id)
  setActiveTab('produtos')
  scrollToProductForm()
}, [scrollToProductForm])

    useEffect(() => {
    if (!isOpen || !quickEditProduct) return

    handleEditProductClick(quickEditProduct)
    onQuickEditHandled?.()
  }, [
    isOpen,
    quickEditProduct,
    handleEditProductClick,
    onQuickEditHandled,
  ])

  const cancelProductEdit = useCallback(() => {
    setProductForm(EMPTY_PRODUCT_FORM)
    setEditingProductId(null)
  }, [])

  const handleSaveProduct = useCallback(async () => {
    if (!finalStoreId) return

    if (!productForm.name.trim()) {
      showToast('Digite o nome do produto.')
      return
    }

    if (!productForm.price) {
      showToast('Digite o preço do produto.')
      return
    }

    if (!productForm.categoryId) {
      showToast('Selecione uma categoria.')
      return
    }

    setLoading(true)

    try {
      const price = parseCurrency(productForm.price)
      const oldPrice = parseCurrency(productForm.oldPrice)

      const processedExtras = productForm.extras
        .filter((extra) => extra.name.trim())
        .map((extra) => {
          const extraPrice = parseCurrency(extra.price)

          return {
            name: extra.name.trim(),
            price: extraPrice,
            priceCents: Math.round(extraPrice * 100),
            type: 'extra',
          }
        })

      const processedOptionGroups = sanitizeOptionGroupsForSave(
        productForm.optionGroups
      )

      const productData = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        categoryId: productForm.categoryId,
        price,
        priceCents: Math.round(price * 100),
        oldPrice: oldPrice || null,
        oldPriceCents: oldPrice ? Math.round(oldPrice * 100) : null,
        imageUrl: productForm.imageUrl.trim() || null,
        preparationTime: productForm.preparationTime.trim(),
        serves: productForm.serves.trim(),
        stock:
          productForm.stock !== ''
            ? Number(productForm.stock)
            : null,
        priceDescription: productForm.priceDescription.trim(),
        extras: processedExtras,
        optionGroups: processedOptionGroups,
        customizationGroups: processedOptionGroups,
        hasRequiredOptions: processedOptionGroups.some((group) => group.required),
        hasOptionQuantities: processedOptionGroups.some((group) => group.allowQuantity),
        isAvailable: productForm.isAvailable,
        isVisible: productForm.isVisible,
        isPopular: productForm.isPopular,
        isFeatured: productForm.isFeatured,
        featured: productForm.isFeatured,
        couponEligible: productForm.couponEligible,
        storeId: finalStoreId,
        storeSlug: finalStoreId,
        updatedAt: serverTimestamp(),
      }

      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productData)
        showToast('Produto atualizado.')
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          order: products.length,
          createdAt: serverTimestamp(),
        })

        showToast('Produto criado.')
      }

      cancelProductEdit()
    } catch (error) {
      console.error(error)
      showToast('Erro ao salvar produto.')
    } finally {
      setLoading(false)
    }
  }, [
    cancelProductEdit,
    editingProductId,
    finalStoreId,
    productForm,
    products.length,
    showToast,
  ])

  const handleToggleProductStatus = useCallback(
    async (productId, currentStatus) => {
      try {
        await updateDoc(doc(db, 'products', productId), {
          isAvailable: !currentStatus,
          updatedAt: serverTimestamp(),
        })
      } catch (error) {
        console.error(error)
        showToast('Erro ao atualizar disponibilidade.')
      }
    },
    [showToast]
  )

  const handleToggleVisibility = useCallback(
    async (productId, currentStatus) => {
      try {
        await updateDoc(doc(db, 'products', productId), {
          isVisible: !currentStatus,
          updatedAt: serverTimestamp(),
        })
      } catch (error) {
        console.error(error)
        showToast('Erro ao atualizar visibilidade.')
      }
    },
    [showToast]
  )

  const handleArchiveProduct = useCallback(
    async (productId) => {
      const confirmed = window.confirm(
        'Arquivar este produto? Ele deixará de aparecer no cardápio.'
      )

      if (!confirmed) return

      try {
        await updateDoc(doc(db, 'products', productId), {
          isAvailable: false,
          isVisible: false,
          isDeleted: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        showToast('Produto arquivado.')
      } catch (error) {
        console.error(error)
        showToast('Erro ao arquivar produto.')
      }
    },
    [showToast]
  )

  const handleSaveDelivery = useCallback(async () => {
    if (!storeDocId) return

    setLoading(true)

    try {
      const normalizedFees = Object.entries(deliveryFees).reduce(
        (acc, [bairro, value]) => {
          if (value === '' || value === null || value === undefined) return acc

          const parsedValue = Number(value)

          if (!Number.isFinite(parsedValue)) return acc

          acc[bairro] = parsedValue

          return acc
        },
        {}
      )

      await updateDoc(doc(db, 'stores', storeDocId), {
        address: {
          cep: addressEdit.cep.trim(),
          street: addressEdit.street.trim(),
          number: addressEdit.number.trim(),
          neighborhood: addressEdit.neighborhood.trim(),
          complement: addressEdit.complement.trim(),
          city: addressEdit.city.trim(),
          state: addressEdit.state.trim(),
        },
        cep: addressEdit.cep.trim(),
        city: addressEdit.city.trim(),
        neighborhood: addressEdit.neighborhood.trim(),
        state: addressEdit.state.trim(),
        deliveryFees: normalizedFees,
        updatedAt: serverTimestamp(),
      })

      showToast('Configurações de entrega salvas.')
    } catch (error) {
      console.error(error)
      showToast('Erro ao salvar entrega.')
    } finally {
      setLoading(false)
    }
  }, [addressEdit, deliveryFees, showToast, storeDocId])

  const handleAddCoupon = useCallback(async () => {
    if (!finalStoreId) return

    if (!couponForm.code.trim() || !couponForm.value) {
      showToast('Preencha o código e o desconto.')
      return
    }

    setLoading(true)

    try {
      const isPercent = couponForm.type === 'percent'
      const value = isPercent
        ? Number(couponForm.value)
        : parseCurrency(couponForm.value)

      const minOrder = parseCurrency(couponForm.minOrder)
      const maxDiscount = parseCurrency(couponForm.maxDiscount)

      await addDoc(collection(db, 'coupons'), {
        code: couponForm.code.trim().toUpperCase(),
        type: couponForm.type,
        value,
        valueCents: isPercent ? null : Math.round(value * 100),
        minOrder: minOrder || null,
        minOrderCents: minOrder ? Math.round(minOrder * 100) : null,
        maxDiscount: maxDiscount || null,
        maxDiscountCents: maxDiscount ? Math.round(maxDiscount * 100) : null,
        targetId: couponForm.targetId,
        storeId: finalStoreId,
        storeSlug: finalStoreId,
        startsAt: couponForm.startsAt ? new Date(couponForm.startsAt) : null,
        expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt) : null,
        usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : null,
        active: couponForm.active,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setCouponForm(EMPTY_COUPON_FORM)
      showToast('Cupom criado.')
    } catch (error) {
      console.error(error)
      showToast('Erro ao criar cupom.')
    } finally {
      setLoading(false)
    }
  }, [couponForm, finalStoreId, showToast])

  const handleToggleCoupon = useCallback(
    async (couponId, currentStatus) => {
      try {
        await updateDoc(doc(db, 'coupons', couponId), {
          active: !currentStatus,
          updatedAt: serverTimestamp(),
        })
      } catch (error) {
        console.error(error)
        showToast('Erro ao atualizar cupom.')
      }
    },
    [showToast]
  )

  const handleArchiveCoupon = useCallback(
    async (couponId) => {
      const confirmed = window.confirm('Arquivar este cupom?')

      if (!confirmed) return

      try {
        await updateDoc(doc(db, 'coupons', couponId), {
          active: false,
          isDeleted: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        showToast('Cupom arquivado.')
      } catch (error) {
        console.error(error)
        showToast('Erro ao arquivar cupom.')
      }
    },
    [showToast]
  )

  const handleResolveReview = useCallback(
    async (reviewId, currentStatus) => {
      try {
        await updateDoc(doc(db, 'reviews', reviewId), {
          resolved: !currentStatus,
          resolvedAt: !currentStatus ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        })

        showToast(!currentStatus ? 'Avaliação marcada como resolvida.' : 'Avaliação reaberta.')
      } catch (error) {
        console.error(error)
        showToast('Erro ao atualizar avaliação.')
      }
    },
    [showToast]
  )

  const handleOpenReviewWhatsApp = useCallback((review) => {
    const phone = normalizePhoneBR(
      review.customerPhone || review.phone || review.customer?.phone
    )

    if (!phone) {
      showToast('Cliente sem WhatsApp cadastrado.')
      return
    }

    const message = encodeURIComponent(
      `Olá, ${review.customerName || 'tudo bem'}! Vimos sua avaliação no PratoBy e queremos entender melhor sua experiência.`
    )

    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer')
  }, [showToast])

  const handleCopyStoreLink = useCallback(async () => {
    const slug = store?.storeSlug || store?.slug || finalStoreId
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/${slug}`
        : `/${slug}`

    try {
      await navigator.clipboard.writeText(url)
      showToast('Link da loja copiado.')
    } catch {
      showToast('Não foi possível copiar o link.')
    }
  }, [finalStoreId, showToast, store])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar painel"
      />

      <aside className="relative flex h-full w-full max-w-3xl flex-col bg-[#f9fafb] shadow-2xl">
        <header className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-600/20">
                <FiSettings size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black tracking-tight text-[#111827]">
                  Gerenciar loja
                </h2>

                <p className="mt-1 text-sm text-[#6b7280]">
                  Produtos, entrega, cupons e operação da loja.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827]"
              aria-label="Fechar"
            >
              <FiX size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] p-3">
            <span
              className={`h-3 w-3 rounded-full ${
                storeEdit.isOpen ? 'bg-[#f97316]' : 'bg-red-500'
              }`}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[#111827]">
                {store?.name || 'Sua loja'}
              </p>

              <p className="truncate text-xs text-[#6b7280]">
                /{store?.storeSlug || store?.slug || finalStoreId}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyStoreLink}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#f97316] shadow-sm transition hover:bg-orange-50"
              title="Copiar link da loja"
            >
              <FiCopy />
            </button>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                  active
                    ? 'bg-[#f97316] text-white shadow-lg shadow-orange-600/20'
                    : 'bg-gray-50 text-[#6b7280] hover:bg-orange-50 hover:text-[#f97316]'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {toast && (
            <div className="mb-5 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-black text-[#f97316]">
              {toast}
            </div>
          )}

          {activeTab === 'loja' && (
            <div className="space-y-5">
              <Section
                icon={FiLayout}
                title="Dados principais"
                description="Essas informações aparecem na loja pública e no checkout."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Nome da loja</Label>
                    <input
                      value={storeEdit.name}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Nome da loja"
                    />
                  </div>

                  <div>
                    <Label>WhatsApp</Label>
                    <input
                      value={storeEdit.whatsapp}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          whatsapp: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="5579999999999"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Descrição</Label>
                    <textarea
                      value={storeEdit.description}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      className={textareaClass}
                      placeholder="Ex: A verdadeira massa artesanal. O autêntico sabor de Aju."
                    />
                  </div>

                  <div>
                    <Label>Instagram</Label>
                    <input
                      value={storeEdit.instagram}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          instagram: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="@sualoja"
                    />
                  </div>

                  <div>
                    <Label>Tempo médio</Label>
                    <input
                      value={storeEdit.deliveryTime}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          deliveryTime: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="25-40 min"
                    />
                  </div>

                  <div>
                    <Label>Pedido mínimo</Label>
                    <input
                      value={storeEdit.minOrder}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          minOrder: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="0,00"
                    />
                  </div>

                  <div>
                    <Label>Taxa padrão de entrega</Label>
                    <input
                      value={storeEdit.deliveryFee}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          deliveryFee: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="0,00"
                    />
                  </div>

                  <div>
                    <Label>Frete grátis a partir de</Label>
                    <input
                      value={storeEdit.freeDeliveryFrom}
                      onChange={(event) =>
                        setStoreEdit((prev) => ({
                          ...prev,
                          freeDeliveryFrom: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="Opcional"
                    />
                  </div>

                  <div>
                    <Label>Cor do tema</Label>
                    <div className="flex h-12 items-center gap-3 rounded-2xl border border-gray-100 bg-[#f9fafb] px-4">
                      <input
                        type="color"
                        value={storeEdit.themeColor}
                        onChange={(event) =>
                          setStoreEdit((prev) => ({
                            ...prev,
                            themeColor: event.target.value,
                          }))
                        }
                        className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                      />

                      <span className="text-sm font-black text-[#111827]">
                        {storeEdit.themeColor}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setStoreEdit((prev) => ({
                            ...prev,
                            themeColor: '#f97316',
                          }))
                        }
                        className="ml-auto text-xs font-black text-[#f97316]"
                      >
                        PratoBy
                      </button>
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                icon={FiDollarSign}
                title="Pagamento manual"
                description="Por enquanto, o PratoBy apenas organiza o pedido. O pagamento fica entre cliente e loja."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <Toggle
                    checked={storeEdit.paymentPix}
                    onChange={(value) =>
                      setStoreEdit((prev) => ({
                        ...prev,
                        paymentPix: value,
                      }))
                    }
                    label="Pix"
                    description="Manual"
                  />

                  <Toggle
                    checked={storeEdit.paymentCard}
                    onChange={(value) =>
                      setStoreEdit((prev) => ({
                        ...prev,
                        paymentCard: value,
                      }))
                    }
                    label="Maquininha"
                    description="Na entrega"
                  />

                  <Toggle
                    checked={storeEdit.paymentCash}
                    onChange={(value) =>
                      setStoreEdit((prev) => ({
                        ...prev,
                        paymentCash: value,
                      }))
                    }
                    label="Dinheiro"
                    description="Com troco"
                  />
                </div>
              </Section>

              <Section
                icon={FiSettings}
                title="Operação"
                description="Controle se a loja aparece ativa e se está recebendo pedidos."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Toggle
                    checked={storeEdit.isOpen}
                    onChange={(value) =>
                      setStoreEdit((prev) => ({
                        ...prev,
                        isOpen: value,
                      }))
                    }
                    label="Loja aberta"
                    description="Permite finalizar pedidos."
                  />

                  <Toggle
                    checked={storeEdit.isActive}
                    onChange={(value) =>
                      setStoreEdit((prev) => ({
                        ...prev,
                        isActive: value,
                      }))
                    }
                    label="Loja ativa"
                    description="Controla acesso público."
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdateStore}
                  disabled={loading}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FiSave />
                  {loading ? 'Salvando...' : 'Salvar loja'}
                </button>
              </Section>
            </div>
          )}

          {activeTab === 'categorias' && (
            <div className="space-y-5">
              <Section
                icon={FiPlus}
                title="Nova categoria"
                description="Organize o cardápio em grupos como pizzas, bebidas e combos."
              >
                <div className="space-y-3">
                  <input
                    placeholder="Ex: Pizzas"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    className={inputClass}
                  />

                  <input
                    placeholder="Descrição opcional"
                    value={newCategoryDescription}
                    onChange={(event) =>
                      setNewCategoryDescription(event.target.value)
                    }
                    className={inputClass}
                  />

                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:opacity-70"
                  >
                    <FiPlus />
                    Criar categoria
                  </button>
                </div>
              </Section>

              <div className="space-y-3">
                {sortedCategories.length === 0 ? (
                  <EmptyState
                    icon={FiList}
                    title="Nenhuma categoria"
                    description="Crie categorias para organizar melhor os produtos da loja."
                  />
                ) : (
                  sortedCategories.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={category.order ?? 0}
                          onChange={(event) =>
                            handleUpdateCategory(category.id, {
                              order: Number(event.target.value),
                            })
                          }
                          className="h-11 w-16 rounded-xl border border-gray-100 bg-[#f9fafb] text-center text-sm font-black text-[#111827] outline-none focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[#111827]">
                            {category.name}
                          </p>

                          <p className="text-xs text-[#6b7280]">
                            {
                              products.filter(
                                (product) => product.categoryId === category.id
                              ).length
                            }{' '}
                            produto(s)
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCategory(category.id, {
                              isVisible: category.isVisible === false,
                            })
                          }
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            category.isVisible === false
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-orange-50 text-[#f97316]'
                          }`}
                        >
                          {category.isVisible === false ? <FiEyeOff /> : <FiEye />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleArchiveCategory(category.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'produtos' && (
            <div ref={productFormRef} className="scroll-mt-6">
                <Section
                  icon={editingProductId ? FiEdit2 : FiPlus}
                  title={editingProductId ? 'Editar produto' : 'Novo produto'}
                  description="Adicione informações que ajudam o cliente a decidir mais rápido."
                >
                <div className="space-y-4">
                  <input
                    placeholder="Nome do produto"
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />

                  <textarea
                    placeholder="Descrição"
                    value={productForm.description}
                    onChange={(event) =>
                      setProductForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className={textareaClass}
                    rows={3}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      placeholder="Preço. Ex: 25,90"
                      value={productForm.price}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          price: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <input
                      placeholder="Preço antigo. Opcional"
                      value={productForm.oldPrice}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          oldPrice: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <select
                      value={productForm.categoryId}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          categoryId: event.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">Selecione uma categoria</option>
                      {sortedCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>

                    <input
                      placeholder="Tempo. Ex: 20-30 min"
                      value={productForm.preparationTime}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          preparationTime: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <input
                      placeholder="Serve. Ex: 2 pessoas"
                      value={productForm.serves}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          serves: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <input
                      placeholder="Estoque. Opcional"
                      type="number"
                      value={productForm.stock}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          stock: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <input
                      placeholder="URL da imagem"
                      value={productForm.imageUrl}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          imageUrl: event.target.value,
                        }))
                      }
                      className={`${inputClass} sm:col-span-2`}
                    />

                    <input
                      placeholder="Descrição do preço. Ex: a partir de"
                      value={productForm.priceDescription}
                      onChange={(event) =>
                        setProductForm((prev) => ({
                          ...prev,
                          priceDescription: event.target.value,
                        }))
                      }
                      className={`${inputClass} sm:col-span-2`}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Toggle
                      checked={productForm.isAvailable}
                      onChange={(value) =>
                        setProductForm((prev) => ({
                          ...prev,
                          isAvailable: value,
                        }))
                      }
                      label="Disponível"
                      description="Pode ser vendido."
                    />

                    <Toggle
                      checked={productForm.isVisible}
                      onChange={(value) =>
                        setProductForm((prev) => ({
                          ...prev,
                          isVisible: value,
                        }))
                      }
                      label="Visível"
                      description="Aparece no cardápio."
                    />

                    <Toggle
                      checked={productForm.isPopular}
                      onChange={(value) =>
                        setProductForm((prev) => ({
                          ...prev,
                          isPopular: value,
                        }))
                      }
                      label="Popular"
                      description="Badge no card."
                    />

                    <Toggle
                      checked={productForm.isFeatured}
                      onChange={(value) =>
                        setProductForm((prev) => ({
                          ...prev,
                          isFeatured: value,
                        }))
                      }
                      label="Destaque"
                      description="Aparece nos destaques."
                    />
                  </div>

                  <div className="rounded-[1.4rem] border border-dashed border-gray-200 bg-[#f9fafb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#111827]">
                          Opções do produto
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#6b7280]">
                          Configure escolhas obrigatórias, múltiplas ou com quantidade. Ex: sabores, tamanhos, bebidas.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addOptionGroupToForm}
                        className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-black text-[#f97316]"
                      >
                        + Grupo
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {(productForm.optionGroups || []).map((group, groupIndex) => (
                        <div
                          key={group.id || groupIndex}
                          className="rounded-[1.25rem] border border-gray-100 bg-white p-3"
                        >
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              placeholder="Nome do grupo. Ex: Escolha sua bebida"
                              value={group.title}
                              onChange={(event) =>
                                updateOptionGroupInForm(groupIndex, {
                                  title: event.target.value,
                                })
                              }
                              className={`${inputClass} sm:col-span-2`}
                            />

                            <input
                              placeholder="Descrição. Opcional"
                              value={group.description}
                              onChange={(event) =>
                                updateOptionGroupInForm(groupIndex, {
                                  description: event.target.value,
                                })
                              }
                              className={`${inputClass} sm:col-span-2`}
                            />

                            <select
                              value={group.type}
                              onChange={(event) =>
                                updateOptionGroupInForm(groupIndex, {
                                  type: event.target.value,
                                })
                              }
                              className={inputClass}
                            >
                              <option value="single">Escolha única</option>
                              <option value="multiple">Múltipla escolha</option>
                              <option value="quantity">Múltipla com quantidade</option>
                            </select>

                            <select
                              value={group.pricingMode || 'additive'}
                              onChange={(event) =>
                                updateOptionGroupInForm(groupIndex, {
                                  pricingMode: event.target.value,
                                })
                              }
                              className={inputClass}
                            >
                              <option value="additive">Somar preço das opções</option>
                              <option value="included_first">Primeira escolha inclusa no preço</option>
                            </select>

                            <input
                              type="number"
                              min="0"
                              placeholder="Mínimo"
                              value={group.min}
                              onChange={(event) =>
                                updateOptionGroupInForm(groupIndex, {
                                  min: event.target.value,
                                  required: Number(event.target.value || 0) > 0,
                                })
                              }
                              className={inputClass}
                            />

                            <input
                              type="number"
                              min="0"
                              placeholder="Máximo. 0 = sem limite"
                              value={group.max}
                              disabled={group.type === 'single'}
                              onChange={(event) =>
                                updateOptionGroupInForm(groupIndex, {
                                  max: event.target.value,
                                })
                              }
                              className={inputClass}
                            />

                            {group.pricingMode === 'included_first' && (
                              <input
                                type="number"
                                min="0"
                                placeholder="Qtd. inclusa no preço"
                                value={group.includedQuantity}
                                onChange={(event) =>
                                  updateOptionGroupInForm(groupIndex, {
                                    includedQuantity: event.target.value,
                                  })
                                }
                                className={`${inputClass} sm:col-span-2`}
                              />
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                              Itens da opção
                            </p>

                            <button
                              type="button"
                              onClick={() => addOptionToGroupInForm(groupIndex)}
                              className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-black text-[#111827]"
                            >
                              + Item
                            </button>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(group.options || []).map((option, optionIndex) => (
                              <div
                                key={option.id || optionIndex}
                                className="grid gap-2 rounded-2xl bg-[#f9fafb] p-2 sm:grid-cols-[1fr_110px_auto]"
                              >
                                <input
                                  placeholder="Nome. Ex: Coca-Cola"
                                  value={option.name}
                                  onChange={(event) =>
                                    updateOptionInGroupForm(groupIndex, optionIndex, {
                                      name: event.target.value,
                                    })
                                  }
                                  className="h-11 rounded-xl border border-gray-100 bg-white px-3 text-sm outline-none focus:border-[#f97316]"
                                />

                                <input
                                  placeholder="Preço"
                                  value={option.price}
                                  onChange={(event) =>
                                    updateOptionInGroupForm(groupIndex, optionIndex, {
                                      price: event.target.value,
                                    })
                                  }
                                  className="h-11 rounded-xl border border-gray-100 bg-white px-3 text-sm outline-none focus:border-[#f97316]"
                                />

                                <button
                                  type="button"
                                  onClick={() => removeOptionFromGroupForm(groupIndex, optionIndex)}
                                  className="flex h-11 w-full items-center justify-center rounded-xl bg-red-50 text-red-600 sm:w-11"
                                >
                                  <FiX />
                                </button>

                                <input
                                  placeholder="Descrição. Opcional"
                                  value={option.description}
                                  onChange={(event) =>
                                    updateOptionInGroupForm(groupIndex, optionIndex, {
                                      description: event.target.value,
                                    })
                                  }
                                  className="h-11 rounded-xl border border-gray-100 bg-white px-3 text-sm outline-none focus:border-[#f97316] sm:col-span-3"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeOptionGroupFromForm(groupIndex)}
                              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                            >
                              Remover grupo
                            </button>
                          </div>
                        </div>
                      ))}

                      {(productForm.optionGroups || []).length === 0 && (
                        <p className="rounded-2xl bg-white p-3 text-xs font-bold leading-5 text-[#6b7280]">
                          Nenhum grupo criado. Use quando o cliente precisar escolher sabor, tamanho, bebida ou adicionais com quantidade.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-dashed border-gray-200 bg-[#f9fafb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#111827]">
                          Adicionais
                        </p>

                        <p className="mt-1 text-xs text-[#6b7280]">
                          Ex: borda, bacon, queijo extra.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addExtraToForm}
                        className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-black text-[#f97316]"
                      >
                        + Extra
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {productForm.extras.map((extra, index) => (
                        <div key={index} className="grid grid-cols-[1fr_110px_auto] gap-2">
                          <input
                            placeholder="Nome"
                            value={extra.name}
                            onChange={(event) => {
                              const nextExtras = [...productForm.extras]
                              nextExtras[index].name = event.target.value

                              setProductForm((prev) => ({
                                ...prev,
                                extras: nextExtras,
                              }))
                            }}
                            className="h-11 rounded-xl border border-gray-100 bg-white px-3 text-sm outline-none focus:border-[#f97316]"
                          />

                          <input
                            placeholder="Preço"
                            value={extra.price}
                            onChange={(event) => {
                              const nextExtras = [...productForm.extras]
                              nextExtras[index].price = event.target.value

                              setProductForm((prev) => ({
                                ...prev,
                                extras: nextExtras,
                              }))
                            }}
                            className="h-11 rounded-xl border border-gray-100 bg-white px-3 text-sm outline-none focus:border-[#f97316]"
                          />

                          <button
                            type="button"
                            onClick={() => removeExtraFromForm(index)}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"
                          >
                            <FiX />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {editingProductId && (
                      <button
                        type="button"
                        onClick={cancelProductEdit}
                        className="flex-1 rounded-2xl bg-gray-100 px-5 py-3 text-sm font-black text-[#111827] transition hover:bg-gray-200"
                      >
                        Cancelar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveProduct}
                      disabled={loading}
                      className="flex-[2] rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:opacity-70"
                    >
                      {loading
                        ? 'Salvando...'
                        : editingProductId
                          ? 'Salvar produto'
                          : 'Adicionar produto'}
                    </button>
                  </div>
                </div>
              </Section>

              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" />

                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  className={`${inputClass} pl-11`}
                  placeholder="Buscar produto..."
                />
              </div>

              <div className="space-y-5">
                {filteredProducts.length === 0 ? (
                  <EmptyState
                    icon={FiShoppingBag}
                    title="Nenhum produto"
                    description="Crie produtos para começar a vender pelo cardápio."
                  />
                ) : (
                  <>
                    {groupedProducts.map(({ category, products: categoryProducts }) => {
                      if (categoryProducts.length === 0) return null

                      return (
                        <div key={category.id} className="space-y-2">
                          <div className="flex items-center justify-between rounded-2xl bg-gray-100 px-4 py-2">
                            <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                              {category.name}
                            </p>

                            <span className="text-xs font-black text-[#6b7280]">
                              {categoryProducts.length} item(s)
                            </span>
                          </div>

                          {categoryProducts.map((product) => (
                            <div
                              key={product.id}
                              className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm"
                            >
                              <div className="flex gap-3">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 text-gray-400">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <FiImage size={22} />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-black text-[#111827]">
                                      {product.name}
                                    </p>

                                    {product.isPopular && (
                                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">
                                        Popular
                                      </span>
                                    )}

                                    {product.isFeatured && (
                                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-[#f97316]">
                                        Destaque
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-1 line-clamp-1 text-xs text-[#6b7280]">
                                    {product.description || 'Sem descrição'}
                                  </p>

                                  <p className="mt-2 text-sm font-black text-[#f97316]">
                                    {formatMoney(getProductPrice(product))}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleProductStatus(
                                      product.id,
                                      product.isAvailable !== false
                                    )
                                  }
                                  className={`rounded-xl px-3 py-2 text-xs font-black ${
                                    product.isAvailable !== false
                                      ? 'bg-orange-50 text-[#f97316]'
                                      : 'bg-amber-50 text-amber-600'
                                  }`}
                                >
                                  {product.isAvailable !== false
                                    ? 'Disponível'
                                    : 'Esgotado'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVisibility(
                                      product.id,
                                      product.isVisible !== false
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black ${
                                    product.isVisible !== false
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {product.isVisible !== false ? <FiEye /> : <FiEyeOff />}
                                  {product.isVisible !== false ? 'Visível' : 'Oculto'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEditProductClick(product)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-[#111827]"
                                >
                                  <FiEdit2 />
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleArchiveProduct(product.id)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                                >
                                  <FiTrash2 />
                                  Arquivar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {uncategorizedProducts.length > 0 && (
                      <div className="space-y-2">
                        <div className="rounded-2xl bg-gray-100 px-4 py-2">
                          <p className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                            Sem categoria
                          </p>
                        </div>

                        {uncategorizedProducts.map((product) => (
                          <div
                            key={product.id}
                            className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-[#111827]">
                                  {product.name}
                                </p>

                                <p className="text-sm font-black text-[#f97316]">
                                  {formatMoney(getProductPrice(product))}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleEditProductClick(product)}
                                className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-[#111827]"
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'entrega' && (
            <div className="space-y-5">
              <Section
                icon={FiMapPin}
                title="Endereço da loja"
                description="Usado como origem da operação e referência para o cliente."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    placeholder="CEP"
                    value={addressEdit.cep}
                    onChange={(event) =>
                      setAddressEdit((prev) => ({
                        ...prev,
                        cep: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />

                  <input
                    placeholder="Rua"
                    value={addressEdit.street}
                    onChange={(event) =>
                      setAddressEdit((prev) => ({
                        ...prev,
                        street: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />

                  <input
                    placeholder="Número"
                    value={addressEdit.number}
                    onChange={(event) =>
                      setAddressEdit((prev) => ({
                        ...prev,
                        number: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />

                  <input
                    placeholder="Bairro"
                    value={addressEdit.neighborhood}
                    onChange={(event) =>
                      setAddressEdit((prev) => ({
                        ...prev,
                        neighborhood: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />

                  <input
                    placeholder="Cidade"
                    value={addressEdit.city}
                    onChange={(event) =>
                      setAddressEdit((prev) => ({
                        ...prev,
                        city: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />

                  <input
                    placeholder="Estado"
                    value={addressEdit.state}
                    onChange={(event) =>
                      setAddressEdit((prev) => ({
                        ...prev,
                        state: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />

                  <input
                    placeholder="Complemento"
                    value={addressEdit.complement}
                    onChange={(event) =>
                      setAddressEdit((prev) => ({
                        ...prev,
                        complement: event.target.value,
                      }))
                    }
                    className={`${inputClass} sm:col-span-2`}
                  />
                </div>
              </Section>

              <Section
                icon={FiTruck}
                title="Taxas por bairro"
                description="Deixe vazio se a loja não atende o bairro. Use 0 para entrega grátis."
              >
                <div className="relative mb-4">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" />

                  <input
                    value={deliverySearch}
                    onChange={(event) => setDeliverySearch(event.target.value)}
                    className={`${inputClass} pl-11`}
                    placeholder="Buscar bairro..."
                  />
                </div>

                <div className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-100 bg-white">
                  {visibleBairros.map((bairro) => (
                    <div
                      key={bairro}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <span className="text-sm font-bold text-[#111827]">
                        {bairro}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#6b7280]">
                          R$
                        </span>

                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={deliveryFees[bairro] ?? ''}
                          onChange={(event) =>
                            setDeliveryFees((prev) => ({
                              ...prev,
                              [bairro]:
                                event.target.value === ''
                                  ? ''
                                  : Number(event.target.value),
                            }))
                          }
                          className="h-10 w-24 rounded-xl border border-gray-100 bg-[#f9fafb] px-3 text-right text-sm font-black text-[#111827] outline-none focus:border-[#f97316] focus:ring-4 focus:ring-orange-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveDelivery}
                  disabled={loading}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:opacity-70"
                >
                  <FiSave />
                  {loading ? 'Salvando...' : 'Salvar entrega'}
                </button>
              </Section>
            </div>
          )}

          {activeTab === 'cupons' && (
            <div className="space-y-5">
              <Section
                icon={FiPercent}
                title="Criar cupom"
                description="Crie descontos por porcentagem ou valor fixo para estimular pedidos."
              >
                <div className="space-y-3">
                  <input
                    placeholder="CÓDIGO. Ex: PROMO10"
                    value={couponForm.code}
                    onChange={(event) =>
                      setCouponForm((prev) => ({
                        ...prev,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    className={`${inputClass} font-black uppercase`}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={couponForm.type}
                      onChange={(event) =>
                        setCouponForm((prev) => ({
                          ...prev,
                          type: event.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="percent">Porcentagem (%)</option>
                      <option value="fixed">Valor fixo (R$)</option>
                    </select>

                    <input
                      placeholder="Desconto"
                      value={couponForm.value}
                      onChange={(event) =>
                        setCouponForm((prev) => ({
                          ...prev,
                          value: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <input
                      placeholder="Pedido mínimo"
                      value={couponForm.minOrder}
                      onChange={(event) =>
                        setCouponForm((prev) => ({
                          ...prev,
                          minOrder: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <input
                      placeholder="Limite de uso"
                      type="number"
                      value={couponForm.usageLimit}
                      onChange={(event) =>
                        setCouponForm((prev) => ({
                          ...prev,
                          usageLimit: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <select
                      value={couponForm.targetId}
                      onChange={(event) =>
                        setCouponForm((prev) => ({
                          ...prev,
                          targetId: event.target.value,
                        }))
                      }
                      className={`${inputClass} sm:col-span-2`}
                    >
                      <option value="all">Loja inteira</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          Apenas: {product.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="datetime-local"
                      value={couponForm.startsAt}
                      onChange={(event) =>
                        setCouponForm((prev) => ({
                          ...prev,
                          startsAt: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />

                    <input
                      type="datetime-local"
                      value={couponForm.expiresAt}
                      onChange={(event) =>
                        setCouponForm((prev) => ({
                          ...prev,
                          expiresAt: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>

                  <Toggle
                    checked={couponForm.active}
                    onChange={(value) =>
                      setCouponForm((prev) => ({
                        ...prev,
                        active: value,
                      }))
                    }
                    label="Cupom ativo"
                    description="Clientes poderão usar este cupom."
                  />

                  <button
                    type="button"
                    onClick={handleAddCoupon}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:opacity-70"
                  >
                    <FiTag />
                    Criar cupom
                  </button>
                </div>
              </Section>

              <div className="space-y-3">
                {coupons.length === 0 ? (
                  <EmptyState
                    icon={FiTag}
                    title="Nenhum cupom"
                    description="Crie cupons para campanhas, clientes recorrentes e promoções rápidas."
                  />
                ) : (
                  coupons.map((coupon) => (
                    <div
                      key={coupon.id}
                      className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-black text-[#111827]">
                              {coupon.code}
                            </p>

                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                coupon.active
                                  ? 'bg-orange-50 text-[#f97316]'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {coupon.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>

                          <p className="mt-1 text-sm font-bold text-[#6b7280]">
                            {coupon.type === 'percent'
                              ? `${coupon.value}% OFF`
                              : `${formatMoney(coupon.value)} OFF`}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleCoupon(coupon.id, coupon.active)
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-[#111827]"
                          >
                            {coupon.active ? <FiEye /> : <FiEyeOff />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchiveCoupon(coupon.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'avaliacoes' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-[#6b7280]">
                    Média
                  </p>

                  <p className="mt-2 text-2xl font-black text-[#111827]">
                    {reviewStats.average.toFixed(1)} ⭐
                  </p>
                </div>

                <div className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-[#6b7280]">
                    Avaliações
                  </p>

                  <p className="mt-2 text-2xl font-black text-[#111827]">
                    {reviewStats.total}
                  </p>
                </div>

                <div className="rounded-[1.4rem] border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase text-[#6b7280]">
                    Problemas
                  </p>

                  <p className="mt-2 text-2xl font-black text-red-600">
                    {reviewStats.openProblems}
                  </p>
                </div>
              </div>

              {reviews.length === 0 ? (
                <EmptyState
                  icon={FiStar}
                  title="Nenhuma avaliação ainda"
                  description="Quando o cliente avaliar um pedido entregue, a avaliação privada aparecerá aqui."
                />
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => {
                    const rating = getReviewRating(review)
                    const isProblem = rating <= 3

                    return (
                      <div
                        key={review.id}
                        className={`rounded-[1.4rem] border bg-white p-4 shadow-sm ${
                          isProblem && !review.resolved
                            ? 'border-amber-200'
                            : 'border-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-black text-[#111827]">
                                {rating || 0} ⭐
                              </p>

                              {review.resolved && (
                                <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-[#f97316]">
                                  Resolvida
                                </span>
                              )}

                              {isProblem && !review.resolved && (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                                  Atenção
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm font-bold text-[#111827]">
                              {review.customerName || 'Cliente'}
                            </p>

                            <p className="text-xs text-[#6b7280]">
                              Pedido #{review.orderId?.slice?.(0, 8) || '—'} ·{' '}
                              {getDateLabel(review.createdAt)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleResolveReview(review.id, review.resolved)
                            }
                            className={`rounded-xl px-3 py-2 text-xs font-black ${
                              review.resolved
                                ? 'bg-gray-100 text-[#111827]'
                                : 'bg-orange-50 text-[#f97316]'
                            }`}
                          >
                            {review.resolved ? 'Reabrir' : 'Resolver'}
                          </button>
                        </div>

                        {review.comment && (
                          <p className="mt-3 rounded-2xl bg-[#f9fafb] p-3 text-sm leading-6 text-[#111827]">
                            {review.comment}
                          </p>
                        )}

                        {Array.isArray(review.tags) && review.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {review.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-[#6b7280]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenReviewWhatsApp(review)}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-black text-[#111827]"
                          >
                            <FiMessageCircle />
                            WhatsApp
                          </button>

                          {review.wouldOrderAgain !== undefined && (
                            <span
                              className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-black ${
                                review.wouldOrderAgain
                                  ? 'bg-orange-50 text-[#f97316]'
                                  : 'bg-red-50 text-red-600'
                              }`}
                            >
                              {review.wouldOrderAgain
                                ? 'Pediria novamente'
                                : 'Não pediria novamente'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}


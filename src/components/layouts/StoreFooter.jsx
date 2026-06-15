import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiCheck,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiExternalLink,
  FiFacebook,
  FiInstagram,
  FiLink,
  FiLock,
  FiLogIn,
  FiMapPin,
  FiMessageCircle,
  FiShield,
  FiShoppingBag,
  FiZap,
} from 'react-icons/fi'

const DEFAULT_THEME = '#f97316'
const PRATOBY_URL = 'https://pratoby.com'

function firstValid(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ''
  )
}

function sanitizeHandle(value) {
  return String(value || '')
    .replace('@', '')
    .trim()
}

function onlyNumbers(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase()
}

function getThemeColor(store) {
  return firstValid(
    store?.themeColor,
    store?.primaryColor,
    store?.brandColor,
    store?.settings?.themeColor,
    store?.settings?.primaryColor,
    DEFAULT_THEME
  )
}

function getLogoUrl(store) {
  const logoUrl = firstValid(
    store?.logoUrl,
    store?.logo,
    store?.logoImage,
    store?.avatarUrl,
    store?.photoUrl,
    store?.brand?.logoUrl,
    store?.settings?.logoUrl,
    '/icons/favicon-32x32.png'
  )

  const normalizedLogoUrl = String(logoUrl)

  if (!normalizedLogoUrl.includes('res.cloudinary.com') || !normalizedLogoUrl.includes('/upload/')) {
    return normalizedLogoUrl
  }

  return normalizedLogoUrl.replace('/upload/', '/upload/f_auto,q_auto,c_fill,w_96,h_96/')
}

function getAddressText(store) {
  if (typeof store?.address === 'string') return store.address

  const address = store?.address || store?.location || {}

  const street = firstValid(address.street, address.rua, store?.street)
  const number = firstValid(address.number, address.numero, store?.number)
  const neighborhood = firstValid(
    address.neighborhood,
    address.bairro,
    store?.neighborhood
  )
  const city = firstValid(address.city, address.cidade, store?.city)
  const state = firstValid(address.state, address.uf, store?.state)

  const line1 = [street, number].filter(Boolean).join(', ')
  const line2 = [neighborhood, city].filter(Boolean).join(' - ')

  return [line1, line2, state].filter(Boolean).join(' · ')
}

function getSocials(store) {
  const instagram = sanitizeHandle(
    firstValid(
      store?.instagram,
      store?.social?.instagram,
      store?.socials?.instagram,
      store?.settings?.instagram
    )
  )

  const facebook = sanitizeHandle(
    firstValid(
      store?.facebook,
      store?.social?.facebook,
      store?.socials?.facebook,
      store?.settings?.facebook
    )
  )

  return { instagram, facebook }
}

function isPublicProviderEnabled(value) {
  if (value === true) return true
  if (!value || typeof value !== 'object') return false

  const enabled = firstValid(value.enabled, value.active, value.isEnabled)
  const status = String(firstValid(value.status, value.connectionStatus, '')).toLowerCase()

  if (enabled === false) return false

  if (
    [
      'disabled',
      'inactive',
      'inativa',
      'inativo',
      'disconnected',
      'desconectado',
      'pending',
      'pendente',
      'failed',
      'error',
    ].includes(status)
  ) {
    return false
  }

  return Boolean(enabled) || ['active', 'connected', 'enabled', 'ativo'].includes(status)
}

function addUniquePayment(methods, label) {
  const normalized = normalizeKey(label)

  if (!label || methods.some((method) => normalizeKey(method) === normalized)) {
    return methods
  }

  return [...methods, label]
}

function addOnlinePaymentLabels(methods, config) {
  if (config && typeof config === 'object') {
    const allowPix = firstValid(config.allowPix, config.pix, config.billingType === 'PIX')
    const allowCard = firstValid(
      config.allowCreditCard,
      config.allowCard,
      config.card,
      config.creditCard,
      config.billingType === 'CREDIT_CARD'
    )
    const allowBoleto = firstValid(config.allowBoleto, config.boleto)

    let nextMethods = methods

    if (allowPix) nextMethods = addUniquePayment(nextMethods, 'Pix online')
    if (allowCard) nextMethods = addUniquePayment(nextMethods, 'Cartão online')
    if (allowBoleto) nextMethods = addUniquePayment(nextMethods, 'Boleto')

    if (nextMethods.length !== methods.length) return nextMethods
  }

  return addUniquePayment(methods, 'Pagamento online')
}

function isManualPaymentEnabled(value) {
  if (value === true) return true
  if (!value || value === false) return false
  if (typeof value !== 'object') return Boolean(value)

  const enabled = firstValid(value.enabled, value.active, value.isEnabled)
  const status = String(firstValid(value.status, '')).toLowerCase()

  if (enabled === false) return false
  if (['disabled', 'inactive', 'inativa', 'inativo'].includes(status)) return false

  return true
}

function labelPaymentKey(key, value) {
  const normalized = normalizeKey(key)

  if (['manual', 'pixmanual', 'manualpix'].includes(normalized)) {
    return 'Pix por comprovante'
  }

  if (['pix'].includes(normalized)) return 'Pix'
  if (['cash', 'dinheiro'].includes(normalized)) return 'Dinheiro'
  if (['card', 'cartao', 'credit', 'credito', 'debit', 'debito'].includes(normalized)) {
    return 'Cartão'
  }

  if (['delivery', 'entrega'].includes(normalized)) return 'Na entrega'
  if (['pickup', 'retirada'].includes(normalized)) return 'Na retirada'
  if (['online', 'paymentonline', 'pagamentoonline'].includes(normalized)) return 'Pagamento online'

  if (['asaas', 'mercadopago', 'mercadopagopix', 'mercadopagocard'].includes(normalized)) {
    return isPublicProviderEnabled(value) ? 'Pagamento online' : null
  }

  if (typeof value === 'string') return value

  return null
}

function normalizePaymentLabel(value) {
  const normalized = normalizeKey(value)

  if (['manual', 'pixmanual', 'manualpix'].includes(normalized)) {
    return 'Pix por comprovante'
  }

  if (['asaas', 'mercadopago', 'mercadopagopix', 'mercadopagocard'].includes(normalized)) {
    return 'Pagamento online'
  }

  if (['cartao', 'card', 'credit', 'credito', 'debit', 'debito'].includes(normalized)) {
    return 'Cartão'
  }

  if (normalized === 'cash' || normalized === 'dinheiro') return 'Dinheiro'
  if (normalized === 'pix') return 'Pix'
  if (normalized === 'boleto') return 'Boleto'
  if (normalized === 'online') return 'Pagamento online'

  return String(value || '').trim()
}

function normalizePayments(store) {
  const source = firstValid(
    store?.paymentMethods,
    store?.payments,
    store?.settings?.paymentMethods
  )

  let methods = []

  if (Array.isArray(source)) {
    source.forEach((item) => {
      const rawLabel = typeof item === 'string' ? item : item?.label || item?.name || item?.title
      const label = normalizePaymentLabel(rawLabel)
      methods = addUniquePayment(methods, label)
    })

    return methods.slice(0, 5)
  }

  if (source && typeof source === 'object') {
    Object.entries(source).forEach(([key, value]) => {
      const normalized = normalizeKey(key)

      if (['asaas', 'mercadopago'].includes(normalized)) {
        if (isPublicProviderEnabled(value)) {
          methods = addOnlinePaymentLabels(methods, value)
        }
        return
      }

      const isManual = ['manual', 'pixmanual', 'manualpix'].includes(normalized)
      const isEnabled = isManual
        ? isManualPaymentEnabled(value)
        : typeof value === 'object'
          ? isPublicProviderEnabled(value)
          : Boolean(value)
      if (!isEnabled) return

      const label = labelPaymentKey(key, value)
      methods = addUniquePayment(methods, label)
    })
  }

  if (methods.length === 0) {
    methods = ['Pix', 'Cartão', 'Dinheiro']
  }

  return methods.slice(0, 5)
}

function getStoreStatus(store) {
  const explicitOpen = firstValid(
    store?.isOpen,
    store?.open,
    store?.opened,
    store?.isOpened,
    store?.acceptingOrders,
    store?.settings?.isOpen
  )

  if (explicitOpen !== undefined) {
    return Boolean(explicitOpen)
  }

  const status = String(
    firstValid(store?.status, store?.storeStatus, store?.settings?.status, '')
  ).toLowerCase()

  if (['open', 'opened', 'aberto', 'ativa', 'active'].includes(status)) {
    return true
  }

  if (
    ['closed', 'fechado', 'fechada', 'inactive', 'inativa'].includes(status) ||
    store?.isClosed === true
  ) {
    return false
  }

  return false
}

function getPublicStoreUrl(store) {
  const customUrl = firstValid(
    store?.publicUrl,
    store?.storeUrl,
    store?.links?.publicUrl,
    store?.settings?.publicUrl
  )

  if (customUrl) return customUrl

  const slug = normalizeSlug(
    firstValid(store?.slug, store?.storeSlug, store?.id, store?.docId)
  )

  if (typeof window !== 'undefined') {
    if (slug) return `${window.location.origin}/${slug}`

    return window.location.href.split('?')[0]
  }

  if (slug) return `${PRATOBY_URL}/${slug}`

  return PRATOBY_URL
}

function getPaymentIcon(method) {
  const normalized = normalizeKey(method)

  if (normalized.includes('pix')) return FiZap
  if (normalized.includes('cartao') || normalized.includes('card')) return FiCreditCard
  if (normalized.includes('dinheiro')) return FiDollarSign
  if (normalized.includes('online') || normalized.includes('boleto')) return FiLock

  return FiShoppingBag
}

async function copyText(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'

  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function FooterInfoCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-orange-100/80 bg-white/80 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
            {title}
          </p>
          <div className="mt-1 text-sm font-bold leading-5 text-[#374151]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StoreFooter({ store, todayHoursLabel }) {
  const [copied, setCopied] = useState(false)

  const year = new Date().getFullYear()
  const themeColor = getThemeColor(store)
  const logoUrl = getLogoUrl(store)
  const addressText = getAddressText(store)
  const socials = getSocials(store)
  const payments = normalizePayments(store)
  const isOpen = getStoreStatus(store)

  const publicStoreUrl = useMemo(() => getPublicStoreUrl(store), [store])

  const whatsappDigits = onlyNumbers(
    firstValid(store?.whatsapp, store?.phone, store?.contactPhone)
  )

  const storeName = store?.name || 'Loja'
  const description =
    store?.shortDescription ||
    store?.description ||
    'Cardápio digital com pedido online.'

  const handleCopyLink = useCallback(async () => {
    try {
      await copyText(publicStoreUrl)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 1800)
    } catch (error) {
      console.error('Erro ao copiar link da loja:', error)
    }
  }, [publicStoreUrl])

  if (!store) return null

  return (
    <footer className="relative overflow-hidden border-t border-orange-100/80 bg-gradient-to-b from-white via-orange-50/20 to-[#fff7ed]/35 antialiased">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,.1),transparent_30%)]" />

      <div className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-orange-100/90 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, ${themeColor}, #fb923c, #ffb67b)`,
            }}
          />

          <div className="grid gap-6 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:px-6 lg:py-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative shrink-0">
                <div className="rounded-[1.4rem] bg-gradient-to-br from-orange-50 via-white to-amber-50 p-1 shadow-[0_14px_36px_rgba(249,115,22,0.16)] ring-1 ring-orange-100">
                  <img
                    src={logoUrl}
                    alt={storeName}
                    className="h-14 w-14 rounded-[1.15rem] object-cover sm:h-16 sm:w-16"
                    loading="lazy"
                  />
                </div>

                <span
                  className={[
                    'absolute -bottom-1 -right-1 h-[18px] w-[18px] rounded-full border-[3px] border-white shadow-sm',
                    isOpen ? 'bg-emerald-500' : 'bg-gray-400',
                  ].join(' ')}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-black tracking-tight text-[#111827] sm:text-lg">
                    {storeName}
                  </p>

                  <span
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1',
                      isOpen
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-gray-100 text-gray-600 ring-gray-200',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'h-1.5 w-1.5 rounded-full',
                        isOpen ? 'bg-emerald-500' : 'bg-gray-400',
                      ].join(' ')}
                    />
                    {isOpen ? 'Aberto agora' : 'Fechado agora'}
                  </span>
                </div>

                <p className="mt-1.5 max-w-2xl text-sm font-semibold leading-6 text-[#64748b]">
                  {description}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                    <FiShield size={13} />
                    Página segura PratoBy
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-black text-orange-700">
                    <FiShoppingBag size={13} />
                    Pedido online
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[300px] lg:grid-cols-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-white px-4 text-sm font-black text-orange-700 shadow-sm shadow-orange-100/70 transition hover:-translate-y-0.5 hover:bg-orange-50 focus:outline-none focus:ring-4 focus:ring-orange-100"
                aria-label="Copiar link da loja"
              >
                {copied ? <FiCheck size={17} /> : <FiCopy size={17} />}
                {copied ? 'Link copiado' : 'Copiar link'}
              </button>

              {whatsappDigits && (
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-black text-white shadow-[0_14px_32px_rgba(249,115,22,.24)] transition hover:-translate-y-0.5 hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-100"
                  aria-label="Falar com a loja no WhatsApp"
                >
                  <FiMessageCircle size={17} />
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-3 border-t border-orange-100/80 bg-gradient-to-br from-orange-50/55 via-white to-emerald-50/35 px-4 py-4 sm:px-5 lg:grid-cols-3 lg:px-6">
            <FooterInfoCard icon={FiMapPin} title="Endereço">
              {addressText ? (
                <span className="line-clamp-2">{addressText}</span>
              ) : (
                <span>Consulte a loja para combinar retirada ou entrega.</span>
              )}
            </FooterInfoCard>

            <FooterInfoCard icon={FiClock} title="Funcionamento">
              {todayHoursLabel ? (
                <span>{todayHoursLabel}</span>
              ) : (
                <span>Horários informados pela loja.</span>
              )}
            </FooterInfoCard>
            <FooterInfoCard icon={FiLock} title="Compartilhamento">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 text-left font-black text-orange-700 underline-offset-4 transition hover:text-orange-800 hover:underline"
              >
                <FiLink size={14} />
                {copied ? 'Link copiado para enviar' : 'Copiar cardápio'}
              </button>
            </FooterInfoCard>
          </div>

          <div className="border-t border-orange-100/80 px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                  Formas de pedido e pagamento
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {payments.map((method) => {
                    const Icon = getPaymentIcon(method)

                    return (
                      <span
                        key={method}
                        className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-white px-3 py-1.5 text-[11px] font-black text-orange-700 shadow-sm shadow-orange-50"
                      >
                        <Icon size={13} />
                        {method}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                <div className="flex items-center gap-2">
                  {socials.instagram && (
                    <a
                      href={`https://instagram.com/${socials.instagram}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-gray-400 ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:text-[#f97316] hover:shadow-md hover:shadow-orange-100/70"
                      aria-label="Instagram da loja"
                    >
                      <FiInstagram size={17} />
                    </a>
                  )}

                  {socials.facebook && (
                    <a
                      href={`https://facebook.com/${socials.facebook}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-gray-400 ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:text-[#16a34a] hover:shadow-md hover:shadow-orange-100/70"
                      aria-label="Facebook da loja"
                    >
                      <FiFacebook size={17} />
                    </a>
                  )}
                </div>

                <Link
                  to="/login"
                  className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-2xl bg-orange-50 px-3 text-[11px] font-black text-[#f97316] ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:bg-white hover:text-[#ea580c] hover:shadow-md hover:shadow-orange-100/70 sm:px-4 sm:text-xs"
                >
                  <FiLogIn size={14} className="shrink-0" />
                  <span className="truncate">Área do lojista</span>
                </Link>

                <a
                  href={PRATOBY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-2 inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-[11px] font-black text-[#64748b] ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:text-[#111827] hover:shadow-md hover:shadow-orange-100/70 sm:col-span-1 sm:px-4 sm:text-xs"
                >
                  <span>Tecnologia</span>
                  <strong className="font-black text-[#111827]">
                    Prato<span className="text-[#f97316]">By</span>
                  </strong>
                  <FiExternalLink size={13} className="shrink-0" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-center text-[11px] font-bold text-[#94a3b8] sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>
            © {year} {storeName}. Todos os direitos reservados.
          </p>

          <p>
            Cardápio digital e pedidos online com{' '}
            <a
              href={PRATOBY_URL}
              target="_blank"
              rel="noreferrer"
              className="font-black text-[#111827] transition hover:text-[#f97316]"
            >
              Prato<span className="text-[#f97316]">By</span>
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}

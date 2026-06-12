import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiCheck,
  FiClock,
  FiCopy,
  FiExternalLink,
  FiFacebook,
  FiInstagram,
  FiLogIn,
  FiMapPin,
  FiMessageCircle,
  FiShield,
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

  if (!logoUrl.includes('res.cloudinary.com') || !logoUrl.includes('/upload/')) {
    return logoUrl
  }

  return logoUrl.replace('/upload/', '/upload/f_auto,q_auto,c_fill,w_64,h_64/')
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

function normalizePayments(store) {
  const source = firstValid(
    store?.paymentMethods,
    store?.payments,
    store?.settings?.paymentMethods
  )

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === 'string') return item
        return item?.label || item?.name || item?.title
      })
      .filter(Boolean)
      .slice(0, 4)
  }

  if (source && typeof source === 'object') {
    const labels = {
      pix: 'Pix',
      card: 'Cartão',
      cartao: 'Cartão',
      credit: 'Crédito',
      credito: 'Crédito',
      debit: 'Débito',
      debito: 'Débito',
      cash: 'Dinheiro',
      dinheiro: 'Dinheiro',
      delivery: 'Na entrega',
      online: 'Online',
    }

    return Object.entries(source)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => labels[key] || key)
      .slice(0, 4)
  }

  return ['Pix', 'Cartão', 'Dinheiro']
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
    <footer className="border-t border-orange-100/70 bg-white antialiased">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[1.7rem] border border-orange-100 bg-gradient-to-br from-white via-[#f7fef9] to-white shadow-[0_18px_60px_rgba(22,163,74,0.08)]">
          <div className="flex flex-col gap-5 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <div className="relative shrink-0">
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-12 w-12 rounded-2xl object-cover ring-1 ring-orange-100"
                  loading="lazy"
                />

                <span
                  className={[
                    'absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white',
                    isOpen ? 'bg-emerald-500' : 'bg-gray-400',
                  ].join(' ')}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-black tracking-tight text-[#111827] sm:text-base">
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
                    {isOpen ? 'Aberto' : 'Fechado'}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#6b7280] sm:line-clamp-1">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:items-end">
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-2 text-[11px] font-black text-orange-700">
                  <FiShield size={14} />
                  Ambiente seguro processado por PratoBy
                </div>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3 py-2 text-[11px] font-black text-orange-700 shadow-sm shadow-orange-100/50 transition hover:-translate-y-0.5 hover:bg-orange-50"
                  aria-label="Copiar link da loja"
                >
                  {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                  {copied ? 'Link copiado' : 'Copiar link'}
                </button>
              </div>

              <div className="flex flex-col gap-2 text-xs font-bold text-[#6b7280] lg:items-end">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                  {addressText && (
                    <div className="flex min-w-0 items-center gap-2">
                      <FiMapPin
                        className="shrink-0"
                        size={14}
                        style={{ color: themeColor }}
                      />
                      <span className="line-clamp-1">{addressText}</span>
                    </div>
                  )}

                  {todayHoursLabel && (
                    <div className="flex items-center gap-2">
                      <FiClock
                        className="shrink-0"
                        size={14}
                        style={{ color: themeColor }}
                      />
                      <span>{todayHoursLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-orange-100/70 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {payments.map((method) => (
                  <span
                    key={method}
                    className="rounded-full border border-orange-100 bg-white px-2.5 py-1 text-[10px] font-black text-orange-700"
                  >
                    {method}
                  </span>
                ))}

                <span className="rounded-full border border-orange-100 bg-white px-2.5 py-1 text-[10px] font-black text-[#6b7280]">
                  Pedido online
                </span>

              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {socials.instagram && (
                  <a
                    href={`https://instagram.com/${socials.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:text-[#f97316]"
                    aria-label="Instagram da loja"
                  >
                    <FiInstagram size={15} />
                  </a>
                )}

                {socials.facebook && (
                  <a
                    href={`https://facebook.com/${socials.facebook}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:text-[#16a34a]"
                    aria-label="Facebook da loja"
                  >
                    <FiFacebook size={15} />
                  </a>
                )}

                {whatsappDigits && (
                  <a
                    href={`https://wa.me/${whatsappDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-orange-600 px-3 text-[11px] font-black text-white shadow-sm shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-700"
                    aria-label="Falar com a loja no WhatsApp"
                  >
                    <FiMessageCircle size={15} />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-[11px] font-bold text-[#9ca3af] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {storeName}. Todos os direitos reservados.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/login"
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-black text-[#f97316] ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:bg-white hover:text-[#ea580c]"
            >
              <FiLogIn size={12} />
              Área do lojista
            </Link>

            <a
              href={PRATOBY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#6b7280] ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:text-[#111827]"
            >
              Tecnologia
              <strong className="font-black text-[#111827]">
                Prato<span className="text-[#f97316]">By</span>
              </strong>
              <FiExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

import { useMemo, useState } from 'react'
import {
  FiCheck,
  FiClock,
  FiCopy,
  FiExternalLink,
  FiHelpCircle,
  FiHome,
  FiMessageCircle,
  FiShield,
} from 'react-icons/fi'

const DEFAULT_THEME = '#f97316'
const PRATOBY_URL = 'https://pratoby.com'
const SUPPORT_WHATSAPP = '5579999786984'

function firstValid(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ''
  )
}

function onlyNumbers(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeStoreSlug(store) {
  return String(
    firstValid(store?.storeSlug, store?.slug, '')
  )
    .trim()
    .replace(/^\/+/, '')
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

function getStoreName(store) {
  return firstValid(store?.name, store?.storeName, 'Sua loja')
}

function getStoreLogoUrl(store) {
  return firstValid(
    store?.logoUrl,
    store?.logo,
    store?.logoImage,
    store?.avatarUrl,
    store?.photoUrl,
    store?.brand?.logoUrl,
    store?.settings?.logoUrl,
    ''
  )
}

function getStoreStatus(store) {
  const statusOpen = String(store?.status || '').toLowerCase() === 'open'
  const isOpen =
    store?.isOpen ??
    store?.open ??
    statusOpen

  return Boolean(isOpen)
}

function getPublicStoreUrl(store) {
  const subscriptionStatus = String(store?.subscriptionStatus || store?.subscription?.status || '').trim()
  const isDraft =
    store?.isBillingBlocked === true ||
    ['checkout_pending', 'pending_checkout', 'billing_pending', 'billing_pending_payment_method'].includes(subscriptionStatus)

  if (isDraft) return ''

  const customUrl = firstValid(
    store?.publicUrl,
    store?.storeUrl,
    store?.links?.publicUrl
  )

  if (customUrl) return customUrl

  const slug = normalizeStoreSlug(store)

  if (!slug) return ''

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/${slug}`
  }

  return `${PRATOBY_URL}/${slug}`
}

function getSupportUrl() {
  const text = encodeURIComponent(
    'Olá! Preciso de ajuda com meu painel do PratoBy.'
  )

  return `https://wa.me/${onlyNumbers(SUPPORT_WHATSAPP)}?text=${text}`
}

function getCurrentYear() {
  return new Date().getFullYear()
}

function DashboardFooterAction({
  href,
  onClick,
  icon: Icon,
  children,
  external = false,
  disabled = false,
}) {
  const className =
    'inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 text-xs font-black text-[#6b7280] shadow-sm transition hover:border-orange-100 hover:bg-orange-50 hover:text-[#f97316] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

  if (href) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        className={className}
      >
        {Icon && <Icon size={14} />}
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  )
}

export default function DashboardFooter({
  store = null,
  className = '',
  compact = false,
}) {
  const [copied, setCopied] = useState(false)

  const year = getCurrentYear()
  const themeColor = getThemeColor(store)
  const storeName = getStoreName(store)
  const storeIsOpen = getStoreStatus(store)
  const storeLogoUrl = getStoreLogoUrl(store)

  const publicStoreUrl = useMemo(() => {
    return getPublicStoreUrl(store)
  }, [store])

  const supportUrl = useMemo(() => {
    return getSupportUrl()
  }, [])

  const handleCopyStoreLink = async () => {
    if (!publicStoreUrl || publicStoreUrl === PRATOBY_URL) return

    try {
      await navigator.clipboard.writeText(publicStoreUrl)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <footer
      className={`mt-8 border-t border-gray-100 bg-[#f9fafb]/80 px-4 py-5 antialiased sm:px-6 lg:px-8 ${className}`}
    >
      <div
        className={`mx-auto max-w-[1440px] ${
          compact ? 'space-y-3' : 'space-y-4'
        }`}
      >
        <div className="flex flex-col gap-4 rounded-[1.5rem] border border-gray-100 bg-white/90 p-4 shadow-sm ring-1 ring-white/80 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <div
  className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-lg ${
    storeLogoUrl
      ? 'bg-white shadow-gray-200 ring-1 ring-gray-100'
      : 'text-white shadow-orange-200'
  }`}
  style={storeLogoUrl ? undefined : { background: themeColor }}
>
  {storeLogoUrl ? (
    <img
      src={storeLogoUrl}
      alt={storeName}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : (
    <FiHome size={18} />
  )}
</div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-tight text-[#111827] sm:text-base">
                  Painel do lojista
                </p>

                <p className="mt-0.5 truncate text-xs font-bold text-[#6b7280]">
                  {storeName} · Operação, pedidos e configurações em tempo real.
                </p>
              </div>
            </div>

            {!compact && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                    storeIsOpen
                      ? 'bg-green-50 text-green-700 ring-1 ring-green-100'
                      : 'bg-red-50 text-red-600 ring-1 ring-red-100'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      storeIsOpen ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  {storeIsOpen ? 'Loja aberta' : 'Loja fechada'}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#6b7280] ring-1 ring-gray-100">
                  <FiShield size={12} />
                  Ambiente seguro
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#6b7280] ring-1 ring-gray-100">
                  <FiClock size={12} />
                  Dados em tempo real
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {publicStoreUrl && publicStoreUrl !== PRATOBY_URL && (
              <>
                <DashboardFooterAction
                  href={publicStoreUrl}
                  icon={FiExternalLink}
                  external
                >
                  Ver loja
                </DashboardFooterAction>

                <DashboardFooterAction
                  onClick={handleCopyStoreLink}
                  icon={copied ? FiCheck : FiCopy}
                >
                  {copied ? 'Copiado' : 'Copiar link'}
                </DashboardFooterAction>
              </>
            )}

            <DashboardFooterAction
              href={supportUrl}
              icon={FiMessageCircle}
              external
            >
              Suporte
            </DashboardFooterAction>

            <DashboardFooterAction
              href={PRATOBY_URL}
              icon={FiExternalLink}
              external
            >
              PratoBy
            </DashboardFooterAction>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-[11px] font-bold text-[#9ca3af] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} PratoBy. Todos os direitos reservados.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-gray-100 transition-colors hover:bg-orange-50 hover:ring-orange-200">
              Tecnologia
              <strong className="font-black text-[#111827] transition-colors group-hover:text-[#f97316]">
                Prato<span className="text-[#f97316]">by</span>
              </strong>
            </a>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-gray-100">
              <FiHelpCircle size={12} />
              v0.7
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

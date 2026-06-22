import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { doc, onSnapshot } from 'firebase/firestore'
import {
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiGrid,
  FiLoader,
  FiLock,
  FiPrinter,
  FiX,
  FiCheck,
  FiAlertCircle,
} from 'react-icons/fi'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import DashboardPageHeader from '../../components/layouts/DashboardPageHeader'
import DashboardFooter from '../../components/layouts/DashboardFooter'

// ─── Constants ────────────────────────────────────────────────────────────────

const SELECTED_STORE_KEY = '@PratoBy:selectedStoreId'
const PRATOBY_ORIGIN = 'https://pratoby.com'

function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return PRATOBY_ORIGIN
}

function getStoreSlug(store) {
  return String(store?.storeSlug || store?.slug || store?.id || '').trim()
}

function getStoreName(store) {
  return String(store?.name || store?.storeName || store?.storeSlug || '').trim() || 'Minha Loja'
}

function getStoreLogoUrl(store) {
  return (
    store?.logoURL ||
    store?.logoUrl ||
    store?.logo ||
    store?.branding?.logoURL ||
    store?.branding?.logoUrl ||
    ''
  )
}

function buildPublicUrl(slug) {
  const cleanSlug = normalizeText(slug).replace(/^\/+|\/+$/g, '')
  if (!cleanSlug) return ''
  return `${getOrigin()}/${cleanSlug}`
}

function safeGetLocalStorage(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function toSafeFilename(value, fallback = 'qr-code') {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getErrorMessage(error, fallback) {
  const raw = error?.message || error?.details?.message || error?.code || ''
  const clean = String(raw).replace(/^FirebaseError:\s*/i, '').trim()
  return clean || fallback
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function FloatingToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast || typeof document === 'undefined') return null

  const isSuccess = toast.type === 'success'
  const Icon = isSuccess ? FiCheck : FiAlertCircle

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-4 z-[200] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-gray-300/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
            isSuccess
              ? 'bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-400'
              : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
          )}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111827] dark:text-zinc-100">
            {isSuccess ? 'Tudo certo' : 'Atenção'}
          </p>
          <p className="mt-0.5 text-sm text-[#6b7280] dark:text-zinc-400">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar notificação"
          className="ml-1 text-gray-400 transition hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
        >
          <FiX size={16} />
        </button>
      </div>
    </div>,
    document.body
  )
}

// ─── QR Download Helper ───────────────────────────────────────────────────────

function downloadQrSvg(svgEl, filename) {
  if (!svgEl || typeof document === 'undefined') return false

  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${toSafeFilename(filename)}.svg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return true
}

// ─── Print Helper ─────────────────────────────────────────────────────────────

function printQr({ svgEl, title, subtitle, url }) {
  if (!svgEl || typeof window === 'undefined') return false

  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  const win = window.open('', '_blank', 'width=420,height=640')

  if (!win) return false

  const safeTitle = escapeHtml(title)
  const safeSubtitle = escapeHtml(subtitle)
  const safeUrl = escapeHtml(url)

  win.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${safeTitle}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; min-height: 100vh; padding: 2rem;
          background: #fff; color: #111; text-align: center;
        }
        .title { font-size: 1.55rem; font-weight: 900; margin-bottom: 0.3rem; }
        .subtitle { font-size: 1rem; font-weight: 800; color: #f97316; margin-bottom: 1.35rem; }
        .qr-wrap { padding: 1.25rem; border: 3px solid #f97316; border-radius: 1.25rem; margin-bottom: 1rem; }
        .cta { font-size: 0.9rem; font-weight: 800; color: #374151; margin-bottom: 0.45rem; }
        .url { max-width: 320px; font-size: 0.72rem; color: #6b7280; word-break: break-all; }
        @media print {
          @page { margin: 1cm; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <p class="title">${safeTitle}</p>
      ${safeSubtitle ? `<p class="subtitle">${safeSubtitle}</p>` : ''}
      <div class="qr-wrap">${svgStr}</div>
      <p class="cta">Escaneie para pedir</p>
      <p class="url">${safeUrl}</p>
      <script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 250); }</script>
    </body>
    </html>
  `)
  win.document.close()

  return true
}

// ─── Copy to clipboard ────────────────────────────────────────────────────────

async function copyToClipboard(text) {
  if (!text) throw new Error('Link indisponível.')

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') throw new Error('Área de transferência indisponível.')

  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

// ─── QR Action Buttons ────────────────────────────────────────────────────────

function QrActionBtn({ icon: Icon, label, onClick, variant = 'ghost', id, disabled = false }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400'
  const variants = {
    ghost:
      'text-[#6b7280] hover:bg-gray-100 hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
    primary:
      'bg-[#f97316] text-white hover:bg-orange-600 shadow-sm shadow-orange-200 dark:shadow-orange-900/30',
    danger:
      'text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20',
  }

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(base, variants[variant], disabled && 'cursor-not-allowed opacity-50')}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

// ─── QR Card (cardápio ou mesa) ───────────────────────────────────────────────

function QrCard({ url, title, subtitle, filename, darkMode = false, onToast }) {
  const svgRef = useRef(null)
  const [copied, setCopied] = useState(false)

  const hasUrl = Boolean(url)
  const safeFilename = toSafeFilename(filename)

  async function handleCopy() {
    try {
      await copyToClipboard(url)
      setCopied(true)
      onToast?.('success', 'Link copiado.')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      onToast?.('error', getErrorMessage(error, 'Não foi possível copiar o link.'))
    }
  }

  function handleDownload() {
    const el = svgRef.current?.querySelector('svg')
    const ok = downloadQrSvg(el, safeFilename)
    if (!ok) onToast?.('error', 'Não foi possível baixar este QR Code.')
  }

  function handlePrint() {
    const el = svgRef.current?.querySelector('svg')
    const ok = printQr({ svgEl: el, title, subtitle, url })
    if (!ok) onToast?.('error', 'Não foi possível abrir a impressão.')
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={svgRef}
        className={cn(
          'flex items-center justify-center rounded-2xl p-4',
          darkMode
            ? 'bg-zinc-900'
            : 'bg-white ring-1 ring-gray-100 dark:bg-white dark:ring-zinc-700'
        )}
      >
        {hasUrl ? (
          <div className="rounded-[1.75rem] border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-white/10 dark:bg-white dark:ring-white/10">
            <QRCodeSVG
              value={url}
              size={180}
              bgColor="#ffffff"
              fgColor="#111827"
              level="M"
              includeMargin
              className="h-auto w-full max-w-[220px]"
            />
          </div>
        ) : (
          <div className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700">
            <FiGrid size={28} className="text-gray-300 dark:text-zinc-600" />
            <p className="text-center text-[11px] font-bold text-gray-400 dark:text-zinc-500">
              Slug não configurado
            </p>
          </div>
        )}
      </div>

      {hasUrl && (
        <p className="max-w-[240px] break-all text-center text-[11px] font-bold text-[#6b7280] dark:text-zinc-400">
          {url}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-1">
        <QrActionBtn
          id={`copy-${safeFilename}`}
          icon={copied ? FiCheck : FiCopy}
          label={copied ? 'Copiado!' : 'Copiar link'}
          onClick={handleCopy}
          variant={copied ? 'primary' : 'ghost'}
          disabled={!hasUrl}
        />
        <QrActionBtn
          id={`download-${safeFilename}`}
          icon={FiDownload}
          label="Baixar QR"
          onClick={handleDownload}
          variant="ghost"
          disabled={!hasUrl}
        />
        <QrActionBtn
          id={`print-${safeFilename}`}
          icon={FiPrinter}
          label="Imprimir"
          onClick={handlePrint}
          variant="ghost"
          disabled={!hasUrl}
        />
        {hasUrl && (
          <QrActionBtn
            id={`open-${safeFilename}`}
            icon={FiExternalLink}
            label="Abrir cardápio"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            variant="ghost"
          />
        )}
      </div>
    </div>
  )
}

// ─── Section Card wrapper ──────────────────────────────────────────────────────

function SectionCard({ title, description, children, action }) {
  return (
    <section className="rounded-[1.5rem] border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-black text-[#111827] dark:text-zinc-100">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-[#6b7280] dark:text-zinc-400">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QRCodePage() {
  const { user, userData, storeId: authStoreId } = useAuth()

  // ─ Store resolution ─
  const [storeId, setStoreId] = useState(() => {
    const saved = safeGetLocalStorage(SELECTED_STORE_KEY)
    return saved || userData?.storeId || user?.storeId || ''
  })

  useEffect(() => {
    const saved = safeGetLocalStorage(SELECTED_STORE_KEY)
    const fallback = userData?.storeId || user?.storeId || authStoreId || ''
    const target = saved || fallback
    if (target && target !== storeId) setStoreId(target)
  }, [userData?.storeId, user?.storeId, authStoreId, storeId])

  // ─ Store data (snapshot for slug/name/logo) ─
  const [storeData, setStoreData] = useState(null)
  const [storeLoading, setStoreLoading] = useState(true)

  useEffect(() => {
    if (!storeId) {
      setStoreData(null)
      setStoreLoading(false)
      return
    }

    setStoreLoading(true)

    const unsubscribe = onSnapshot(
      doc(db, 'stores', storeId),
      (snapshot) => {
        if (snapshot.exists()) {
          setStoreData({ ...snapshot.data(), id: snapshot.id })
        } else {
          setStoreData(null)
        }

        setStoreLoading(false)
      },
      (err) => {
        console.error('[QRCodePage] store snapshot error:', err)
        setStoreLoading(false)
      }
    )

    return () => unsubscribe()
  }, [storeId])

  const selectedStore = useMemo(() => {
  if (!storeData) return null

  return {
    id: storeData.id || storeId,
    ...storeData,
  }
}, [storeData, storeId])

  // ─ Computed ─
  const storeSlug = useMemo(() => getStoreSlug(selectedStore), [selectedStore])
    const storeName = useMemo(() => getStoreName(selectedStore), [selectedStore])
    const storeLogoUrl = useMemo(() => getStoreLogoUrl(selectedStore), [selectedStore])
    const publicUrl = useMemo(() => buildPublicUrl(storeSlug), [storeSlug])
  const publicHost = useMemo(() => {
    try {
      return new URL(publicUrl).host
    } catch {
      return 'pratoby.com'
    }
  }, [publicUrl])

  // ─ Toast ─
  const [toast, setToast] = useState(null)
  const showToast = useCallback((type, message) => setToast({ type, message }), [])
  const handleCloseToast = useCallback(() => setToast(null), [])

  // ─ Render ─
  const pageLoading = storeLoading

  return (
    <div className="min-h-screen bg-[#f9fafb] pb-10 dark:bg-zinc-950">
      {/* Toast */}
      <FloatingToast toast={toast} onClose={handleCloseToast} />

      {/* Page header */}
      <DashboardPageHeader
        icon={FiGrid}
        title="QR Codes"
        description="Gere o QR Code do cardápio público da loja."
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        {/* Loading state */}
        {pageLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <FiLoader size={28} className="animate-spin text-[#f97316]" />
              <p className="text-sm font-bold text-[#6b7280] dark:text-zinc-400">
                Carregando dados da loja…
              </p>
            </div>
          </div>
        )}

        {/* No store configured */}
        {!pageLoading && !storeId && (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <FiAlertCircle size={28} className="text-gray-400 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-bold text-[#6b7280] dark:text-zinc-400">
              Nenhuma loja selecionada.
            </p>
          </div>
        )}

        {/* Main content */}
        {!pageLoading && storeId && (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#9ca3af] dark:text-zinc-500">
                  Link principal
                </p>
                <p className="mt-2 text-lg font-black text-[#111827] dark:text-zinc-100">
                  {storeSlug ? 'Disponível' : 'Pendente'}
                </p>
                <p className="mt-1 text-xs font-bold text-[#6b7280] dark:text-zinc-400">
                  QR do cardápio público da loja.
                </p>
              </div>

              <div className="rounded-[1.25rem] border border-gray-100 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#9ca3af] dark:text-zinc-500">
                  Mesas cadastradas
                </p>
                <p className="mt-2 text-lg font-black text-[#111827] dark:text-zinc-100">
                  Em breve
                </p>
                <p className="mt-1 text-xs font-bold text-[#6b7280] dark:text-zinc-400">
                  QR por mesa ainda não está disponível para esta loja.
                </p>
              </div>

              <div className="rounded-[1.25rem] border border-orange-100 bg-orange-50 p-4 shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10">
                <p className="text-[11px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">
                  Em preparação
                </p>
                <p className="mt-2 text-sm font-black text-orange-900 dark:text-orange-100">
                  Checkout por mesa
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-orange-700 dark:text-orange-300">
                  O fluxo de pedido por mesa ainda não está disponível para operação real.
                </p>
              </div>
            </section>

            {/* ── Seção 1: QR do cardápio ── */}
            <SectionCard
              title="QR do cardápio"
              description="Use este QR em balcão, vitrine, panfletos, Instagram e embalagens."
            >
              {storeSlug ? (
                <div className="flex flex-col items-center gap-0 sm:flex-row sm:items-start sm:gap-10">
                  {/* QR visual */}
                  <div className="shrink-0">
                    <QrCard
                      url={publicUrl}
                      title={storeName}
                      subtitle="Cardápio Digital"
                      filename={`qr-cardapio-${storeSlug}`}
                      onToast={showToast}
                    />
                  </div>

                  {/* Store info */}
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="flex items-center gap-3">
                      {storeLogoUrl ? (
                        <img
                          src={storeLogoUrl}
                          alt={storeName}
                          className="h-12 w-12 rounded-xl object-cover ring-1 ring-gray-100 dark:ring-zinc-800"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-sm font-black text-[#f97316] dark:bg-orange-500/10 dark:text-orange-400">
                          {storeName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-black text-[#111827] dark:text-zinc-100">
                          {storeName}
                        </p>
                        <p className="text-xs text-[#6b7280] dark:text-zinc-400">{publicHost}/{storeSlug}</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#f9fafb] px-4 py-3 dark:bg-zinc-800">
                      <p className="text-xs font-black uppercase tracking-wider text-[#6b7280] dark:text-zinc-400">
                        Link do cardápio
                      </p>
                      <p className="mt-1 break-all text-sm font-bold text-[#111827] dark:text-zinc-100">
                        {publicUrl}
                      </p>
                    </div>

                    <div className="rounded-xl bg-orange-50 px-4 py-3 dark:bg-orange-500/10">
                      <p className="text-xs font-bold text-orange-700 dark:text-orange-300">
                        💡 Esse QR aponta diretamente para o cardápio público da sua loja. Clientes escaneiam e já podem fazer pedidos.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-[#f9fafb] p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
                  <FiAlertCircle size={22} className="text-gray-400 dark:text-zinc-600" />
                  <p className="text-sm font-bold text-[#6b7280] dark:text-zinc-400">
                    Slug da loja não configurado.
                  </p>
                  <p className="text-xs text-[#9ca3af] dark:text-zinc-500">
                    Configure o slug em{' '}
                    <a
                      href="/dashboard/settings"
                      className="font-bold text-[#f97316] underline hover:text-orange-600"
                    >
                      Configurações
                    </a>{' '}
                    para gerar o QR.
                  </p>
                </div>
              )}
            </SectionCard>

            {/* ── Seção 2: QR por mesa ── */}
            <SectionCard
              title="QR por mesa"
              description="Em breve. O checkout por mesa ainda não está disponível para uso real."
            >
              <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-500/20 dark:bg-orange-500/10">
                <FiLock size={15} className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400" />
                <p className="text-xs font-bold leading-5 text-orange-800 dark:text-orange-300">
                  <span className="font-black">QR por mesa está em breve.</span>{' '}
                  Use o QR do cardápio público por enquanto. Mesas, download e impressão por mesa serão liberados quando o fluxo de pedido presencial estiver pronto.
                </p>
              </div>
            </SectionCard>

            {/* PrintTips ocultado até checkout por mesa (Fase 2) — ver função PrintTips */}
          </>
        )}
      </div>

      <DashboardFooter store={selectedStore} />
    </div>
  )
}

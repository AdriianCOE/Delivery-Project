import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiGrid,
  FiLoader,
  FiPlus,
  FiPrinter,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiArchive,
  FiToggleLeft,
  FiToggleRight,
} from 'react-icons/fi'
import { db, functions } from '../../services/firebase'
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

function buildTableUrl(slug, token) {
  const baseUrl = buildPublicUrl(slug)
  const cleanToken = normalizeText(token)
  if (!baseUrl || !cleanToken) return ''
  return `${baseUrl}?table=${encodeURIComponent(cleanToken)}`
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

function getTableSortValue(table) {
  const number = Number(table?.number)
  if (Number.isFinite(number)) return number
  return Number.MAX_SAFE_INTEGER
}

function sortTables(a, b) {
  const activeA = a?.isActive !== false
  const activeB = b?.isActive !== false

  if (activeA !== activeB) return activeA ? -1 : 1

  const numberDiff = getTableSortValue(a) - getTableSortValue(b)
  if (numberDiff !== 0) return numberDiff

  return normalizeText(a?.label).localeCompare(normalizeText(b?.label), 'pt-BR')
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
      <script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 250); }<\/script>
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

// ─── Table Card ────────────────────────────────────────────────────────────────

function TableCard({ table, storeSlug, storeName, onArchive, onToggleActive, onToast }) {
  const svgRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [toggling, setToggling] = useState(false)

  const url = buildTableUrl(storeSlug, table.token)
  const filename = `qr-${toSafeFilename(storeName, 'loja')}-${toSafeFilename(table.label, 'mesa')}`

  async function handleCopy() {
    try {
      await copyToClipboard(url)
      setCopied(true)
      onToast?.('success', `Link da ${table.label} copiado.`)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      onToast?.('error', getErrorMessage(error, 'Não foi possível copiar o link da mesa.'))
    }
  }

  function handleDownload() {
    const el = svgRef.current?.querySelector('svg')
    const ok = downloadQrSvg(el, filename)
    if (!ok) onToast?.('error', 'Não foi possível baixar o QR da mesa.')
  }

  function handlePrint() {
    const el = svgRef.current?.querySelector('svg')
    const ok = printQr({ svgEl: el, title: storeName, subtitle: table.label, url })
    if (!ok) onToast?.('error', 'Não foi possível abrir a impressão.')
  }

  async function handleArchive() {
    if (archiving) return
    setArchiving(true)
    try {
      await onArchive(table)
    } finally {
      setArchiving(false)
    }
  }

  async function handleToggleActive() {
    if (toggling) return
    setToggling(true)
    try {
      await onToggleActive(table, !table.isActive)
    } finally {
      setToggling(false)
    }
  }

  const isActive = table.isActive !== false && table.isArchived !== true

  return (
    <article
      className={cn(
        'rounded-2xl border p-4 transition',
        isActive
          ? 'border-gray-100 bg-white dark:border-zinc-800 dark:bg-zinc-900'
          : 'border-dashed border-gray-200 bg-gray-50 opacity-70 dark:border-zinc-700 dark:bg-zinc-950'
      )}
    >
      {/* Header da mesa */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#111827] dark:text-zinc-100">{table.label}</p>
          {table.number && (
            <p className="mt-0.5 text-[11px] font-bold text-[#6b7280] dark:text-zinc-400">
              #{table.number}
            </p>
          )}
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider',
            isActive
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500'
          )}
        >
          {isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* QR */}
      <div
        ref={svgRef}
        className="mb-4 flex items-center justify-center rounded-xl bg-white p-3 ring-1 ring-gray-100 dark:ring-zinc-700"
      >
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
      </div>

      {/* URL resumida */}
      <p className="mb-3 truncate text-center text-[10px] font-bold text-[#6b7280] dark:text-zinc-500">
        {url}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-1">
        <QrActionBtn
          id={`copy-table-${table.id}`}
          icon={copied ? FiCheck : FiCopy}
          label={copied ? 'Copiado!' : 'Copiar'}
          onClick={handleCopy}
          variant={copied ? 'primary' : 'ghost'}
          disabled={!url}
        />
        <QrActionBtn
          id={`download-table-${table.id}`}
          icon={FiDownload}
          label="Baixar"
          onClick={handleDownload}
          variant="ghost"
          disabled={!url}
        />
        <QrActionBtn
          id={`print-table-${table.id}`}
          icon={FiPrinter}
          label="Imprimir"
          onClick={handlePrint}
          variant="ghost"
          disabled={!url}
        />
      </div>

      {/* Secondary actions */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-zinc-800">
        <button
          type="button"
          id={`toggle-table-${table.id}`}
          onClick={handleToggleActive}
          disabled={toggling}
          title={isActive ? 'Desativar mesa' : 'Reativar mesa'}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#6b7280] transition hover:text-[#111827] disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-200"
        >
          {toggling ? (
            <FiLoader size={13} className="animate-spin" />
          ) : isActive ? (
            <FiToggleRight size={16} className="text-emerald-500" />
          ) : (
            <FiToggleLeft size={16} />
          )}
          {isActive ? 'Desativar' : 'Reativar'}
        </button>
        <button
          type="button"
          id={`archive-table-${table.id}`}
          onClick={handleArchive}
          disabled={archiving}
          title="Arquivar mesa"
          className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 transition hover:text-red-600 disabled:opacity-50 dark:text-red-500 dark:hover:text-red-400"
        >
          {archiving ? <FiLoader size={13} className="animate-spin" /> : <FiArchive size={13} />}
          Arquivar
        </button>
      </div>
    </article>
  )
}

// ─── Add Table Modal ──────────────────────────────────────────────────────────

function AddTableModal({ onClose, onConfirm, loading }) {
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      setError('O nome da mesa é obrigatório.')
      return
    }
    if (trimmedLabel.length > 60) {
      setError('Nome muito longo (máximo 60 caracteres).')
      return
    }
    setError('')
    onConfirm({ label: trimmedLabel, number: number.trim() })
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-table-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-zinc-800">
          <h3
            id="add-table-modal-title"
            className="text-base font-black text-[#111827] dark:text-zinc-100"
          >
            Nova mesa
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <FiX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5">
          <div className="mb-4">
            <label
              htmlFor="table-label"
              className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#6b7280] dark:text-zinc-400"
            >
              Nome / identificação <span className="text-red-400">*</span>
            </label>
            <input
              id="table-label"
              type="text"
              maxLength={60}
              placeholder="ex: Mesa 4, Balcão, Área externa 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] placeholder-gray-300 focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-orange-400 dark:focus:ring-orange-900/30"
              autoFocus
            />
          </div>

          <div className="mb-5">
            <label
              htmlFor="table-number"
              className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[#6b7280] dark:text-zinc-400"
            >
              Número (opcional)
            </label>
            <input
              id="table-number"
              type="text"
              maxLength={20}
              placeholder="ex: 4"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] placeholder-gray-300 focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-orange-400 dark:focus:ring-orange-900/30"
            />
            <p className="mt-1.5 text-[11px] text-[#9ca3af] dark:text-zinc-500">
              O QR usa um token seguro. O número é só para exibição.
            </p>
          </div>

          {error && (
            <p className="mb-4 flex items-center gap-1.5 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <FiAlertCircle size={14} />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-bold text-[#6b7280] transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              id="confirm-add-table"
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f97316] py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-70 dark:shadow-orange-900/30"
            >
              {loading ? <FiLoader size={14} className="animate-spin" /> : <FiPlus size={14} />}
              {loading ? 'Criando…' : 'Criar mesa'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ─── Archive Confirm Modal ────────────────────────────────────────────────────

function ArchiveConfirmModal({ table, onClose, onConfirm, loading }) {
  if (!table || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-confirm-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="px-6 py-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20">
            <FiArchive size={22} className="text-red-500" />
          </div>
          <h3
            id="archive-confirm-title"
            className="text-base font-black text-[#111827] dark:text-zinc-100"
          >
            Arquivar mesa?
          </h3>
          <p className="mt-2 text-sm text-[#6b7280] dark:text-zinc-400">
            A mesa{' '}
            <strong className="text-[#111827] dark:text-zinc-100">{table.label}</strong> será
            arquivada e seu QR ficará inacessível. O link pode ser reinserido na loja
            quando necessário.
          </p>
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-bold text-[#6b7280] transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            id="confirm-archive-table"
            type="button"
            disabled={loading}
            onClick={() => onConfirm(table)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-70"
          >
            {loading ? <FiLoader size={14} className="animate-spin" /> : <FiArchive size={14} />}
            {loading ? 'Arquivando…' : 'Arquivar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function TablesEmptyState({ onAdd }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-[#f9fafb] px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] dark:bg-orange-500/10 dark:text-orange-400">
        <FiGrid size={24} />
      </div>
      <h3 className="mt-4 text-base font-black text-[#111827] dark:text-zinc-100">
        Nenhuma mesa cadastrada
      </h3>
      <p className="mt-2 max-w-xs text-sm text-[#6b7280] dark:text-zinc-400">
        Crie QR Codes para identificar pedidos por mesa, balcão ou área externa.
      </p>
      <button
        id="add-first-table"
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 dark:shadow-orange-900/30"
      >
        <FiPlus size={14} />
        Adicionar mesa
      </button>
    </div>
  )
}

// ─── Quick print tips ─────────────────────────────────────────────────────────

function PrintTips() {
  const tips = [
    'Imprima em tamanho A5 ou A6 para uso em mesas pequenas.',
    'Plastifique os QR Codes para maior durabilidade.',
    'Use suportes de acrílico para deixar as mesas mais elegantes.',
    'Cada mesa tem um token único — não reutilize QR Codes antigos.',
  ]

  return (
    <section className="rounded-[1.5rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-black text-[#111827] dark:text-zinc-100">
        💡 Dicas de impressão
      </h2>
      <ul className="space-y-2">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-sm text-[#6b7280] dark:text-zinc-400">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[10px] font-black text-[#f97316] dark:bg-orange-500/10 dark:text-orange-400">
              ✓
            </span>
            {tip}
          </li>
        ))}
      </ul>
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

  // ─ Tables snapshot ─
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(true)

  useEffect(() => {
    if (!storeId) {
      setTables([])
      setTablesLoading(false)
      return
    }

    setTablesLoading(true)
    const tablesRef = collection(db, 'stores', storeId, 'tables')

    const unsubscribe = onSnapshot(
      tablesRef,
      (snapshot) => {
        const docs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((table) => table.isArchived !== true)
          .sort(sortTables)

        setTables(docs)
        setTablesLoading(false)
      },
      (err) => {
        console.error('[QRCodePage] tables snapshot error:', err)
        setTablesLoading(false)
      }
    )
    return () => unsubscribe()
  }, [storeId])

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
  const activeTablesCount = useMemo(
    () => tables.filter((table) => table.isActive !== false).length,
    [tables]
  )

  // ─ Toast ─
  const [toast, setToast] = useState(null)
  const showToast = useCallback((type, message) => setToast({ type, message }), [])
  const handleCloseToast = useCallback(() => setToast(null), [])

  // ─ Add table modal ─
  const [addTableOpen, setAddTableOpen] = useState(false)
  const [addTableLoading, setAddTableLoading] = useState(false)

  async function handleCreateTable({ label, number }) {
    if (!storeId || addTableLoading) return

    setAddTableLoading(true)

    try {
      const fn = httpsCallable(functions, 'createStoreTable')
      await fn({ storeId, label, number })
      setAddTableOpen(false)
      showToast('success', `"${label}" criada com sucesso.`)
    } catch (err) {
      console.error('[QRCodePage] createStoreTable error:', err)
      showToast('error', getErrorMessage(err, 'Erro ao criar mesa. Tente novamente.'))
    } finally {
      setAddTableLoading(false)
    }
  }

  // ─ Archive modal ─
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  async function handleArchive(table) {
    setArchiveTarget(table)
  }

  async function confirmArchive(table) {
    if (!storeId || !table?.id || archiveLoading) return

    setArchiveLoading(true)

    try {
      const fn = httpsCallable(functions, 'archiveStoreTable')
      await fn({ storeId, tableId: table.id })
      setArchiveTarget(null)
      showToast('success', `"${table.label}" arquivada.`)
    } catch (err) {
      console.error('[QRCodePage] archiveStoreTable error:', err)
      showToast('error', getErrorMessage(err, 'Erro ao arquivar mesa. Tente novamente.'))
    } finally {
      setArchiveLoading(false)
    }
  }

  // ─ Toggle active ─
  async function handleToggleActive(table, newActive) {
    if (!storeId || !table?.id) return

    try {
      const fn = httpsCallable(functions, 'updateStoreTable')
      await fn({ storeId, tableId: table.id, isActive: newActive })
      showToast('success', `Mesa ${newActive ? 'reativada' : 'desativada'}.`)
    } catch (err) {
      console.error('[QRCodePage] updateStoreTable error:', err)
      showToast('error', getErrorMessage(err, 'Erro ao atualizar mesa.'))
    }
  }

  // ─ Render ─
  const pageLoading = storeLoading

  return (
    <div className="min-h-screen bg-[#f9fafb] pb-10 dark:bg-zinc-950">
      {/* Toast */}
      <FloatingToast toast={toast} onClose={handleCloseToast} />

      {/* Add table modal */}
      {addTableOpen && (
        <AddTableModal
          onClose={() => setAddTableOpen(false)}
          onConfirm={handleCreateTable}
          loading={addTableLoading}
        />
      )}

      {/* Archive confirm modal */}
      {archiveTarget && (
        <ArchiveConfirmModal
          table={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onConfirm={confirmArchive}
          loading={archiveLoading}
        />
      )}

      {/* Page header */}
      <DashboardPageHeader
        icon={FiGrid}
        title="QR Codes"
        description="Gere QR Codes para o cardápio da loja, mesas e atendimento presencial."
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
                  {tables.length}
                </p>
                <p className="mt-1 text-xs font-bold text-[#6b7280] dark:text-zinc-400">
                  {activeTablesCount} ativas para uso.
                </p>
              </div>

              <div className="rounded-[1.25rem] border border-orange-100 bg-orange-50 p-4 shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10">
                <p className="text-[11px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">
                  Próximo passo
                </p>
                <p className="mt-2 text-sm font-black text-orange-900 dark:text-orange-100">
                  Pedido por mesa
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-orange-700 dark:text-orange-300">
                  Os links já saem com token seguro para ativar o checkout por mesa depois.
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
                      subtitle="Cardápio online"
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
              description="Cada mesa tem um QR e token únicos. Clientes escaneiam e o pedido vem identificado."
              action={
                <button
                  id="open-add-table-modal"
                  type="button"
                  onClick={() => setAddTableOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#f97316] px-4 py-2 text-sm font-bold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 dark:shadow-orange-900/30"
                >
                  <FiPlus size={14} />
                  Adicionar mesa
                </button>
              }
            >
              {tablesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader size={22} className="animate-spin text-[#f97316]" />
                </div>
              ) : tables.length === 0 ? (
                <TablesEmptyState onAdd={() => setAddTableOpen(true)} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tables.map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      storeSlug={storeSlug}
                      storeName={storeName}
                      onArchive={handleArchive}
                      onToggleActive={handleToggleActive}
                      onToast={showToast}
                    />
                  ))}
                </div>
              )}

              {/* preparado para o próximo patch */}
              {tables.length > 0 && (
                <div className="mt-5 rounded-xl bg-[#f9fafb] px-4 py-3 dark:bg-zinc-800">
                  <p className="text-xs font-bold text-[#6b7280] dark:text-zinc-400">
                    🔒 Cada mesa usa um token seguro único (ex:{' '}
                    <code className="rounded bg-gray-100 px-1 font-mono text-[11px] dark:bg-zinc-700">
                      t_3f8ac1b2
                    </code>
                    ). O checkout por mesa estará disponível em breve.
                  </p>
                </div>
              )}
            </SectionCard>

            {/* ── Dicas de impressão ── */}
            <PrintTips />
          </>
        )}
      </div>

      <DashboardFooter store={selectedStore} />
    </div>
  )
}

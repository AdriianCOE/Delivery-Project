import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { FiImage, FiLoader, FiTrash2, FiX } from 'react-icons/fi'

import { db, functions } from '../../services/firebase'
import { getCloudinaryImageUrl } from '../../utils/cloudinaryImages'

function formatDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null)
  if (!date || Number.isNaN(date.getTime())) return 'Sem data'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

function mediaTypeLabel(type) {
  if (type === 'logo') return 'Logo'
  if (type === 'banner') return 'Banner'
  if (type === 'product') return 'Produto'
  return 'Geral'
}

export default function MediaLibraryPicker({
  storeId,
  type = '',
  onSelect,
  onDeleted,
  disabled = false,
  className = '',
  children,
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  const isDisabled = disabled || !storeId

  const filteredItems = useMemo(() => {
    const activeItems = items.filter((item) => !item.deletedAt)

    if (!type) return activeItems

    return activeItems.filter(
      (item) => item.type === type || item.type === 'general'
    )
  }, [items, type])

  const loadMedia = useCallback(async () => {
    if (!storeId) return

    setLoading(true)
    setError('')

    try {
      const mediaQuery = query(
        collection(db, 'stores', storeId, 'media'),
        orderBy('createdAt', 'desc'),
        limit(50)
      )

      const snapshot = await getDocs(mediaQuery)

      setItems(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
      )
    } catch (err) {
      console.error('[MediaLibraryPicker] loadMedia:', err)
      setError('Não foi possível carregar a biblioteca.')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  const handleOpen = useCallback(() => {
    if (isDisabled) return

    setOpen(true)
    loadMedia()
  }, [isDisabled, loadMedia])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const handleSelect = useCallback(
    (item) => {
      onSelect?.(item)
      setOpen(false)
    },
    [onSelect]
  )

  const handleDelete = useCallback(
    async (item) => {
      const confirmed = window.confirm(
        'Antes de excluir, confirme que esta imagem não está sendo usada em produtos, logo ou banner. Esta ação remove a imagem da biblioteca da loja.'
      )

      if (!confirmed) return

      setDeletingId(item.id)
      setError('')

      try {
        const deleteCloudinaryAsset = httpsCallable(
          functions,
          'deleteCloudinaryAsset'
        )

        await deleteCloudinaryAsset({ storeId, mediaId: item.id })

        setItems((current) => current.filter((entry) => entry.id !== item.id))
        onDeleted?.(item)
      } catch (err) {
        console.error('[MediaLibraryPicker] delete:', err)
        setError(err?.message || 'Não foi possível excluir a imagem.')
      } finally {
        setDeletingId('')
      }
    },
    [onDeleted, storeId]
  )

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose, open])

  const defaultTrigger = (
    <button
      type="button"
      onClick={handleOpen}
      disabled={isDisabled}
      className={
        className ||
        'flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-black text-[#111827] transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'
      }
    >
      <FiImage />
      Escolher da biblioteca
    </button>
  )

  const trigger =
    typeof children === 'function'
      ? children({
          openLibrary: handleOpen,
          disabled: isDisabled,
        })
      : children || defaultTrigger

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.8rem] bg-white shadow-2xl ring-1 ring-black/5 sm:rounded-[1.8rem] dark:bg-zinc-950 dark:ring-white/10"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-black text-[#111827] dark:text-zinc-50">
              Biblioteca de imagens
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#6b7280] dark:text-zinc-400">
              Escolha uma imagem já enviada ou envie uma nova.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-50 text-[#6b7280] transition hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Fechar biblioteca"
          >
            <FiX />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 dark:bg-zinc-950">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm font-black text-[#6b7280] dark:text-zinc-400">
              <FiLoader className="animate-spin" />
              Carregando imagens...
            </div>
          ) : filteredItems.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-[1.4rem] border border-gray-100 bg-[#f9fafb] dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="aspect-[4/3] bg-white dark:bg-zinc-950">
                    <img
                      src={getCloudinaryImageUrl(
                        item.url,
                        item.type === 'product'
                          ? 'productCard'
                          : 'storeBannerMobile'
                      )}
                      alt={item.filename || 'Imagem da biblioteca'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="space-y-3 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs font-black text-[#6b7280] dark:text-zinc-400">
                      <span>{mediaTypeLabel(item.type)}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="w-full rounded-2xl bg-[#f97316] px-3 py-2.5 text-sm font-black text-white transition hover:bg-[#ea580c]"
                    >
                      Usar esta imagem
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/35 dark:text-red-300 dark:hover:bg-red-950/60"
                    >
                      {deletingId === item.id ? (
                        <FiLoader className="animate-spin" />
                      ) : (
                        <FiTrash2 />
                      )}
                      Excluir da biblioteca
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-gray-200 bg-[#f9fafb] px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <FiImage
                className="mx-auto text-gray-400 dark:text-zinc-500"
                size={28}
              />

              <p className="mt-3 text-sm font-black text-[#111827] dark:text-zinc-100">
                Nenhuma imagem na biblioteca
              </p>

              <p className="mt-1 text-sm text-[#6b7280] dark:text-zinc-400">
                Novos uploads desta loja aparecerão aqui automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {trigger}
      {open &&
        (typeof document !== 'undefined' && document.body
          ? createPortal(modal, document.body)
          : modal)}
    </>
  )
}

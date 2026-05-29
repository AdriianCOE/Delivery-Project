import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore'
import { FiVolume2, FiShoppingBag, FiX, FiChevronRight } from 'react-icons/fi'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

// --- CONSTANTES ---
const ALERT_PERMISSION_KEY = '@PratoBy:alertsEnabled'
const BELL_AUDIO_PATH = '/bell.mp3'
const NOTIFICATION_ICON = '/icons/favicon.png'
const NEW_ORDER_STATUSES = new Set(['novo', 'pendente', 'pending', 'new'])
const STORE_QUERY_CHUNK_SIZE = 10

// --- FUNÇÕES AUXILIARES ---
function chunkArray(array, size = STORE_QUERY_CHUNK_SIZE) {
  const chunks = []
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }
  return chunks
}

function getStartOfTodayTimestamp() {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return Timestamp.fromDate(startOfToday)
}

function isNewOrderStatus(status) {
  if (!status) return false
  return NEW_ORDER_STATUSES.has(String(status).toLowerCase())
}

// --- COMPONENTE PRINCIPAL ---
export function GlobalOrderAlert() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, storeId, storeIds } = useAuth()
  const storeIdsKey = Array.isArray(storeIds) ? storeIds.filter(Boolean).join('|') : ''
  const alertStoreKeys = useMemo(() => {
    return [
      ...new Set([
        storeId,
        ...storeIdsKey.split('|'),
      ].filter(Boolean)),
    ]
  }, [storeId, storeIdsKey])

  // 1. Estados (Lendo do Cache do Navegador)
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem(ALERT_PERMISSION_KEY) === 'true'
  })
  const [latestOrder, setLatestOrder] = useState(null)

  // 2. Referências
  const audioRef = useRef(null)
  const seenOrderIdsRef = useRef(new Set())
  const orderUnsubscribersRef = useRef([])
  const initialSnapshotsPendingRef = useRef(0)
  const isBootingOrdersRef = useRef(true)
  const latestOrderTimerRef = useRef(null)

  // 3. Efeito de Inicialização Simples
  useEffect(() => {
    audioRef.current = new Audio(BELL_AUDIO_PATH)
    audioRef.current.preload = 'auto'
    audioRef.current.volume = 1

    return () => {
      if (latestOrderTimerRef.current) {
        clearTimeout(latestOrderTimerRef.current)
        latestOrderTimerRef.current = null
      }

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // 4. Lógica de Monitoramento de Novos Pedidos
  useEffect(() => {
    if (!user?.uid) return undefined

    const clearOrderListeners = () => {
      orderUnsubscribersRef.current.forEach((unsubscribe) => unsubscribe())
      orderUnsubscribersRef.current = []
    }

    const notifyNewOrder = async (order) => {
      setLatestOrder(order)

      if (latestOrderTimerRef.current) {
        clearTimeout(latestOrderTimerRef.current)
      }

      latestOrderTimerRef.current = setTimeout(() => {
        setLatestOrder(null)
        latestOrderTimerRef.current = null
      }, 8000)

      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0
          await audioRef.current.play()
        }
      } catch (error) {
        console.info('Áudio bloqueado pelo navegador. Reativando botão manual.', error)
        setEnabled(false) // Se o navegador bloquear, o botão verde volta pra pedir permissão
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200])
      }

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const displayNumber = order?.id?.slice(-4)?.toUpperCase() || 'Novo'
        new Notification('Novo pedido no PratoBy!', {
          body: `Pedido #${displayNumber} acabou de chegar!`,
          icon: NOTIFICATION_ICON,
        })
      }
    }

    // Simplifica a busca para usar apenas o storeId principal (docId).
    // Como novos pedidos exigem validPublicOrderCreate(publicStoreExists),
    // o storeId salvo no pedido sempre será o docId real, tornando a busca por slugs desnecessária e evitando falhas de permissão nas regras.
    const deduplicatedKeys = alertStoreKeys

    if (deduplicatedKeys.length === 0) {
      seenOrderIdsRef.current = new Set()
      isBootingOrdersRef.current = false
      return
    }

    const storeKeyChunks = chunkArray(deduplicatedKeys)
    const cutoffDate = getStartOfTodayTimestamp()

    seenOrderIdsRef.current = new Set()
    isBootingOrdersRef.current = true
    initialSnapshotsPendingRef.current = storeKeyChunks.length

    storeKeyChunks.forEach((storeKeyChunk) => {
      let isFirstChunkSnapshot = true

      const qOrders = query(
        collection(db, 'orders'),
        where('storeId', 'in', storeKeyChunk),
        where('createdAt', '>=', cutoffDate)
      )

      const unsubscribeOrders = onSnapshot(qOrders, (ordersSnapshot) => {
        const pendingOrders = ordersSnapshot.docs
          .map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }))
          .filter((order) => isNewOrderStatus(order.status))

        if (isFirstChunkSnapshot) {
          pendingOrders.forEach((order) => seenOrderIdsRef.current.add(order.id))
          isFirstChunkSnapshot = false
          initialSnapshotsPendingRef.current -= 1
          if (initialSnapshotsPendingRef.current <= 0) {
            isBootingOrdersRef.current = false
          }
          return
        }

        if (isBootingOrdersRef.current) {
          pendingOrders.forEach((order) => seenOrderIdsRef.current.add(order.id))
          return
        }

        pendingOrders.forEach((order) => {
          if (seenOrderIdsRef.current.has(order.id)) return
          seenOrderIdsRef.current.add(order.id)
          notifyNewOrder(order)
        })
      }, (error) => {
        console.error('[GlobalOrderAlert] Erro no listener de orders:', error)
      })

      orderUnsubscribersRef.current.push(unsubscribeOrders)
    })

    return () => {
      clearOrderListeners()
    }
  }, [alertStoreKeys, user?.uid])

  // 5. Função de Ação do Botão Verde
  const handleEnable = async () => {
    setEnabled(true)
    localStorage.setItem(ALERT_PERMISSION_KEY, 'true')

    // Toca o som de verdade para o lojista saber que ativou!
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0
        await audioRef.current.play() 
      } catch (error) {
        console.error('Erro ao tocar áudio inicial', error)
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  // --- REGRAS DE VISIBILIDADE NA TELA ---
  if (location.pathname.includes('/store')) return null
  if (!user?.uid) return null

  return (
    <>
      {!enabled && (
        <div className="fixed bottom-6 left-6 z-[100] animate-bounce-slow">
          <button
            onClick={handleEnable}
            className="flex items-center gap-2 rounded-2xl bg-[#f97316] px-5 py-3.5 font-black text-white shadow-2xl shadow-orange-900/20 ring-4 ring-white transition hover:scale-105 active:scale-95"
          >
            <FiVolume2 size={20} />
            Ativar alertas do painel
          </button>
        </div>
      )}

      {latestOrder && (
        <div className="fixed top-6 right-6 z-[100] w-[320px] animate-[slideInRight_0.3s_ease-out] rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-2xl shadow-orange-900/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
              <FiShoppingBag size={20} />
            </div>

            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-[#f97316]">
                Novo Pedido!
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#111827]">
                #{latestOrder.id.slice(-4).toUpperCase()}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#6b7280]">
                {latestOrder.customerName || 'Cliente'} enviou um pedido.
              </p>
            </div>

            <button 
              onClick={() => setLatestOrder(null)}
              className="text-gray-400 transition hover:text-gray-700"
            >
              <FiX size={18} />
            </button>
          </div>

          <button
            onClick={() => {
              setLatestOrder(null)
              navigate('/dashboard/orders')
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white transition hover:bg-black"
          >
            Ver detalhes
            <FiChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  )
}


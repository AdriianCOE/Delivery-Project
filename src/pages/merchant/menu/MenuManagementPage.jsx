// ─────────────────────────────────────────────────────────────────────────────
// src/pages/merchant/menu/MenuManagementPage.jsx
// Orquestrador principal do Cardápio do lojista.
// Toda a lógica de dados fica em useMenuManagementData.
// Cada seção visual fica em seu próprio componente.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiBox,
  FiCheckCircle,
  FiExternalLink,
  FiGrid,
  FiList,
  FiLoader,
  FiPlus,
  FiTag,
  FiTruck,
} from 'react-icons/fi'

import DashboardPageHeader from '../../../components/layouts/DashboardPageHeader'
import { getStorePublicSlug } from '../../../utils/storeIdentity'

import { useMenuManagementData } from './hooks/useMenuManagementData'
import MenuStatsCards        from './components/MenuStatsCards'
import MenuProductsTab       from './components/MenuProductsTab'
import MenuCategoriesTab     from './components/MenuCategoriesTab'
import MenuCouponsTab        from './components/MenuCouponsTab'
import MenuDeliveryAreasTab  from './components/MenuDeliveryAreasTab'
import ProductEditorDrawer   from './components/ProductEditorDrawer'
import CategoryEditorDrawer  from './components/CategoryEditorDrawer'
import CouponEditorDrawer    from './components/CouponEditorDrawer'
import DeliveryAreaEditorDrawer from './components/DeliveryAreaEditorDrawer'
import { BAIRROS_ARACAJU }   from './utils/deliveryPayloads'
import DashboardFooter from '../../../components/layouts/DashboardFooter'

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null
  const isError = toast.type === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      className={`fixed bottom-24 left-1/2 z-[200] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-2xl shadow-gray-900/10 backdrop-blur-xl lg:bottom-6 ${
        isError ? 'border-red-100 text-red-700' : 'border-orange-100 text-[#111827]'
      }`}
    >
      {isError
        ? <FiAlertCircle className="shrink-0 text-red-500" size={18} />
        : <FiCheckCircle className="shrink-0 text-[#f97316]" size={18} />}
      <span className="text-sm font-bold">{toast.message}</span>
    </motion.div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonProductRow() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
      <div className="h-16 w-16 shrink-0 rounded-2xl bg-gray-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-gray-100" />
        <div className="h-3 w-1/3 rounded bg-gray-100" />
        <div className="h-3 w-1/4 rounded bg-gray-100" />
      </div>
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-8 rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MenuManagementPage() {
  // ── Data via hook ──
  const {
    store, storeId,
    pageLoading, storeError,
    sortedCategories, activeProducts, activeCoupons, stats, productCountByCategory,
    handleToggleProductField,
    handleDuplicateProduct,
    handleDeleteProduct,
    handleDeleteCategory,
    handleToggleCategoryActive,
    handleMoveCategoryOrder,
    handleSaveCoupon,
    handleToggleCoupon,
    handleDeleteCoupon,
    handleSaveDeliveryFees,
  } = useMenuManagementData()

  // ── UI state ──
  const [activeTab,         setActiveTab]         = useState('products')
  const [search,            setSearch]            = useState('')
  const [filterCategoryId,  setFilterCategoryId]  = useState('all')
  const [filterStatus,      setFilterStatus]      = useState('all')

  // ── Drawer state ──
  const [productDrawerOpen,  setProductDrawerOpen]  = useState(false)
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false)
  const [couponDrawerOpen,   setCouponDrawerOpen]   = useState(false)
  const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(false)
  
  const [editingProduct,     setEditingProduct]     = useState(null)
  const [editingCategory,    setEditingCategory]    = useState(null)
  const [editingCoupon,      setEditingCoupon]      = useState(null)
  const [editingArea,        setEditingArea]        = useState(null)

  // ── Toast ──
  const [toast, setToast] = useState(null)
  const showToast = useCallback((t) => setToast(t), [])

  // ── Drawer handlers ──
  const openProductDrawer   = useCallback((product = null) => { setEditingProduct(product);  setProductDrawerOpen(true)  }, [])
  const closeProductDrawer  = useCallback(() => { setProductDrawerOpen(false);  setEditingProduct(null)  }, [])
  const openCategoryDrawer  = useCallback((cat = null)     => { setEditingCategory(cat);     setCategoryDrawerOpen(true) }, [])
  const closeCategoryDrawer = useCallback(() => { setCategoryDrawerOpen(false); setEditingCategory(null) }, [])
  const openCouponDrawer    = useCallback((coupon = null)  => { setEditingCoupon(coupon);    setCouponDrawerOpen(true)   }, [])
  const closeCouponDrawer   = useCallback(() => { setCouponDrawerOpen(false);   setEditingCoupon(null)      }, [])
  const openDeliveryDrawer  = useCallback((area = null)    => { setEditingArea(area);        setDeliveryDrawerOpen(true) }, [])
  const closeDeliveryDrawer = useCallback(() => { setDeliveryDrawerOpen(false);       setEditingArea(null)        }, [])

  // ── Passthrough handlers with toast ──
  const onToggle         = useCallback((id, field, val) => handleToggleProductField(id, field, val, showToast), [handleToggleProductField, showToast])
  const onDuplicate      = useCallback((p)              => handleDuplicateProduct(p, store, showToast),         [handleDuplicateProduct, store, showToast])
  const onDeleteProduct  = useCallback((id)             => handleDeleteProduct(id, showToast),                  [handleDeleteProduct, showToast])
  const onDeleteCategory = useCallback((cat)            => handleDeleteCategory(cat, productCountByCategory, showToast), [handleDeleteCategory, productCountByCategory, showToast])
  const onToggleCat      = useCallback((id, val)        => handleToggleCategoryActive(id, val, showToast),      [handleToggleCategoryActive, showToast])
  const onMoveUp         = useCallback((cat)            => handleMoveCategoryOrder(cat, 'up', sortedCategories, showToast),   [handleMoveCategoryOrder, sortedCategories, showToast])
  const onMoveDown       = useCallback((cat)            => handleMoveCategoryOrder(cat, 'down', sortedCategories, showToast), [handleMoveCategoryOrder, sortedCategories, showToast])
  
  const onToggleCoupon   = useCallback((id, val)        => handleToggleCoupon(id, val, showToast),              [handleToggleCoupon, showToast])
  const onDeleteCoupon   = useCallback((id)             => handleDeleteCoupon(id, showToast),                  [handleDeleteCoupon, showToast])

  const handleSaveDeliveryArea = useCallback(async (originalName, newName, fee) => {
    const currentFees = { ...(store?.deliveryFees || {}) }
    
    if (originalName) {
      if (originalName !== newName) {
        delete currentFees[originalName]
      }
    }
    
    currentFees[newName] = fee
    
    try {
      const ok = await handleSaveDeliveryFees(currentFees)
      if (ok) {
        showToast({ type: 'success', message: originalName ? 'Bairro atualizado!' : 'Bairro adicionado!' })
      } else {
        showToast({ type: 'error', message: 'Erro ao salvar bairro.' })
      }
    } catch (err) {
      console.error(err)
      showToast({ type: 'error', message: 'Erro ao salvar bairro.' })
    }
  }, [store, handleSaveDeliveryFees, showToast])

  // ── Error / loading states ──
  if (pageLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="h-8 w-48 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <SkeletonProductRow key={i} />)}
        </div>
      </div>
    )
  }

  if (storeError === 'no-store') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-[2rem] bg-orange-50 text-[#f97316]">
          <FiBox size={36} />
        </div>
        <h2 className="mt-5 text-2xl font-black text-[#111827]">Sua loja ainda não foi ativada</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-[#6b7280]">
          Complete o processo de configuração inicial para começar a gerenciar seu cardápio.
        </p>
        <Link to="/onboarding"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#ea580c]">
          Configurar minha loja
        </Link>
      </div>
    )
  }

  if (storeError === 'not-found') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-[2rem] bg-red-50 text-red-500">
          <FiAlertTriangle size={36} />
        </div>
        <h2 className="mt-5 text-2xl font-black text-[#111827]">Loja não encontrada</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-[#6b7280]">
          Não foi possível carregar os dados da sua loja. Entre em contato com o suporte.
        </p>
      </div>
    )
  }

  const storeSlugForUrl = getStorePublicSlug(store)

  // ── Main render ──
  return (
    <>
      <DashboardPageHeader
        title="Cardápio"
        description={store?.name || 'Gerencie produtos, categorias e cupons promocionais.'}
        icon={FiGrid}
        badge={
          store
            ? {
                label: store.isOpen ? 'Loja aberta' : 'Loja fechada',
                color: store.isOpen ? 'green' : 'red',
                dot: true,
                pulse: store.isOpen,
              }
            : undefined
        }
        actions={
          <>
            {storeSlugForUrl && (
              <a
                href={`/${storeSlugForUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-xs font-black text-[#6b7280] transition hover:border-orange-200 hover:text-[#f97316] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-orange-500 dark:hover:text-[#f97316]"
              >
                <FiExternalLink size={13} /> Ver loja
              </a>
            )}
            {activeTab === 'coupons' ? (
              <button
                type="button"
                onClick={() => openCouponDrawer()}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#f97316] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#ea580c] active:scale-[0.98]"
              >
                <FiPlus size={15} /> Novo cupom
              </button>
            ) : activeTab === 'delivery' ? (
              <button
                type="button"
                onClick={() => openDeliveryDrawer()}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[#f97316] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#ea580c] active:scale-[0.98]"
              >
                <FiPlus size={15} /> Adicionar bairro
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openCategoryDrawer()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 text-xs font-black text-[#f97316] transition hover:bg-orange-100 dark:bg-orange-950/20 dark:border-orange-900/50 dark:hover:bg-orange-950/40"
                >
                  <FiPlus size={13} /> Categoria
                </button>
                <button
                  type="button"
                  onClick={() => openProductDrawer()}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-[#f97316] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#ea580c] active:scale-[0.98]"
                >
                  <FiPlus size={15} /> Novo produto
                </button>
              </>
            )}
          </>
        }
      />

      <div className="min-h-screen space-y-6 p-4 md:p-8">

        {/* ── STATS ── */}
        <MenuStatsCards
          stats={stats}
          activeTab={activeTab}
          filterStatus={filterStatus}
          setActiveTab={setActiveTab}
          setFilterStatus={setFilterStatus}
        />

        {/* ── TABS ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          {[
            { id: 'products',   label: `Produtos (${stats.total})`,        icon: FiBox },
            { id: 'categories', label: `Categorias (${stats.categories})`, icon: FiList },
            { id: 'coupons',    label: `Cupons (${stats.couponsTotal})`,   icon: FiTag },
            { id: 'delivery',   label: `Entrega (${stats.deliveryActive})`, icon: FiTruck },
          ].map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                activeTab === tab.id
                  ? 'bg-[#f97316] text-white shadow-md shadow-orange-200'
                  : 'bg-white text-[#6b7280] border border-gray-200 hover:border-orange-200 hover:text-[#f97316]'
              }`}>
              <tab.icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.id === 'products'
                  ? 'Produtos'
                  : tab.id === 'categories'
                  ? 'Categorias'
                  : tab.id === 'coupons'
                  ? 'Cupons'
                  : 'Entrega'}
              </span>
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {activeTab === 'products' && (
          <MenuProductsTab
            products={activeProducts}
            categories={sortedCategories}
            search={search}
            setSearch={setSearch}
            filterCategoryId={filterCategoryId}
            setFilterCategoryId={setFilterCategoryId}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            onEdit={openProductDrawer}
            onDuplicate={onDuplicate}
            onDelete={onDeleteProduct}
            onToggle={onToggle}
            onCreateProduct={() => openProductDrawer()}
          />
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeTab === 'categories' && (
          <MenuCategoriesTab
            categories={sortedCategories}
            productCountByCategory={productCountByCategory}
            onEdit={openCategoryDrawer}
            onDelete={onDeleteCategory}
            onToggleActive={onToggleCat}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onCreateCategory={() => openCategoryDrawer()}
          />
        )}

        {/* ── COUPONS TAB ── */}
        {activeTab === 'coupons' && (
          <MenuCouponsTab
            coupons={activeCoupons}
            onEdit={openCouponDrawer}
            onDelete={onDeleteCoupon}
            onToggleActive={onToggleCoupon}
            onCreateCoupon={() => openCouponDrawer()}
          />
        )}

        {/* ── DELIVERY AREAS TAB ── */}
        {activeTab === 'delivery' && (
          <MenuDeliveryAreasTab
            store={store}
            onSaveFees={handleSaveDeliveryFees}
            onEditArea={openDeliveryDrawer}
            onAddArea={() => openDeliveryDrawer()}
            onToast={showToast}
          />
        )}
      </div>

      {/* ── DRAWERS ── */}
      <ProductEditorDrawer
        open={productDrawerOpen}
        onClose={closeProductDrawer}
        editingProduct={editingProduct}
        categories={sortedCategories}
        store={store}
        storeId={storeId}
        onToast={showToast}
      />

      <CategoryEditorDrawer
        open={categoryDrawerOpen}
        onClose={closeCategoryDrawer}
        editingCategory={editingCategory}
        storeId={storeId}
        store={store}
        categories={sortedCategories}
        onToast={showToast}
      />

      <CouponEditorDrawer
        open={couponDrawerOpen}
        onClose={closeCouponDrawer}
        editingCoupon={editingCoupon}
        store={store}
        products={activeProducts}
        onSave={handleSaveCoupon}
        onToast={showToast}
      />

      <DeliveryAreaEditorDrawer
        open={deliveryDrawerOpen}
        onClose={closeDeliveryDrawer}
        editingArea={editingArea}
        allNeighborhoods={[
          ...BAIRROS_ARACAJU,
          ...Object.keys(store?.deliveryFees || {}).filter((b) => !BAIRROS_ARACAJU.includes(b))
        ]}
        onSave={handleSaveDeliveryArea}
        onToast={showToast}
      />

    <Toast toast={toast} onClose={() => setToast(null)} />
    <DashboardFooter store={store} />

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toast && <Toast key="toast" toast={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </>
  )
}

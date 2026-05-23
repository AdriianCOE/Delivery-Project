import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)

const CART_KEY = '@PratoBy:cart'
const LEGACY_CART_KEY = '@DeliveryApp:cart'

function safeJsonParse(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function loadCart() {
  const currentCart = safeJsonParse(localStorage.getItem(CART_KEY), null)
  const legacyCart = safeJsonParse(localStorage.getItem(LEGACY_CART_KEY), null)

  if (Array.isArray(currentCart)) return currentCart
  if (Array.isArray(legacyCart)) return legacyCart

  return []
}

function saveCart(cartItems) {
  localStorage.setItem(CART_KEY, JSON.stringify(cartItems))
  localStorage.setItem(LEGACY_CART_KEY, JSON.stringify(cartItems))
}

function getCartItemKey(item) {
  return item?.cartItemId || item?.key || item?.id
}

function getQuantity(item) {
  return Number(item?.quantity || item?.qty || 1)
}

function normalizeMoney(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null) {
    return Number(centsValue || 0) / 100
  }

  const numericValue = Number(value || 0)

  if (numericValue > 999) return numericValue / 100

  return numericValue
}

function getItemBasePrice(item) {
  return normalizeMoney(
    item?.basePrice ?? item?.price,
    item?.basePriceCents ?? item?.priceCents
  )
}

function getItemExtras(item) {
  if (Array.isArray(item?.extras)) return item.extras
  if (Array.isArray(item?.addons)) return item.addons

  return []
}

function getItemExtrasTotal(item) {
  return getItemExtras(item).reduce((acc, extra) => {
    return acc + normalizeMoney(extra?.price, extra?.priceCents)
  }, 0)
}

function getItemTotal(item) {
  const quantity = getQuantity(item)
  const unitTotal = getItemBasePrice(item) + getItemExtrasTotal(item)

  return unitTotal * quantity
}

export function CartProvider({ children }) {
  const [storeKeyInfo, setStoreKeyInfo] = useState({ id: '', slug: '' })
  const [cartItems, setCartItems] = useState([])

  const setStoreKey = useCallback((keyOrObj) => {
    if (typeof keyOrObj === 'object' && keyOrObj !== null) {
      setStoreKeyInfo((prev) => {
        if (prev.id === keyOrObj.id && prev.slug === keyOrObj.slug) return prev
        return {
          id: keyOrObj.id || prev.id,
          slug: keyOrObj.slug || prev.slug,
        }
      })
    } else if (typeof keyOrObj === 'string' && keyOrObj) {
      const isId = keyOrObj.length === 20 && /^[a-zA-Z0-9]+$/.test(keyOrObj)
      setStoreKeyInfo((prev) => {
        if (isId && prev.id === keyOrObj) return prev
        if (!isId && prev.slug === keyOrObj) return prev
        return {
          id: isId ? keyOrObj : prev.id,
          slug: !isId ? keyOrObj : prev.slug,
        }
      })
    }
  }, [])

  // Load cart when storeKeyInfo changes
  useEffect(() => {
    const { id, slug } = storeKeyInfo
    const active = id || slug
    if (!active) {
      setCartItems([])
      return
    }

    const idKey = id ? `@PratoBy:cart:${id}` : null
    const slugKey = slug ? `@PratoBy:cart:${slug}` : null
    const legacyKey = '@PratoBy:cart'

    let loadedItems = null

    // 1. Try loading from preferred ID key
    if (idKey) {
      const stored = localStorage.getItem(idKey)
      if (stored !== null) {
        loadedItems = safeJsonParse(stored, [])
      }
    }

    // 2. Try loading from fallback slug key
    if (loadedItems === null && slugKey) {
      const stored = localStorage.getItem(slugKey)
      if (stored !== null) {
        loadedItems = safeJsonParse(stored, [])
        // If we have an ID now, migrate slug cart to ID cart
        if (idKey) {
          localStorage.setItem(idKey, JSON.stringify(loadedItems))
          localStorage.removeItem(slugKey)
        }
      }
    }

    // 3. Try loading from legacy key
    if (loadedItems === null) {
      const stored = localStorage.getItem(legacyKey) || localStorage.getItem('@DeliveryApp:cart')
      if (stored !== null) {
        const legacyItems = safeJsonParse(stored, [])
        let isCompatible = true

        if (Array.isArray(legacyItems) && legacyItems.length > 0) {
          for (const item of legacyItems) {
            const itemStoreId = item?.storeId || item?.store?.id || item?.storeDocId
            const itemStoreSlug = item?.storeSlug || item?.store?.slug

            if (itemStoreId && id && itemStoreId !== id) {
              isCompatible = false
              break
            }
            if (itemStoreSlug && slug && itemStoreSlug !== slug) {
              isCompatible = false
              break
            }
          }
        }

        if (isCompatible) {
          loadedItems = legacyItems
          const targetKey = idKey || slugKey
          if (targetKey) {
            localStorage.setItem(targetKey, JSON.stringify(loadedItems))
          }
        }

        localStorage.removeItem(legacyKey)
        localStorage.removeItem('@DeliveryApp:cart')
      }
    }

    setCartItems(loadedItems || [])
  }, [storeKeyInfo])

  const persistCart = (newItems, currentKeyInfo = storeKeyInfo) => {
    const { id, slug } = currentKeyInfo
    const active = id || slug
    if (!active) return

    const targetKey = id ? `@PratoBy:cart:${id}` : `@PratoBy:cart:${slug}`
    localStorage.setItem(targetKey, JSON.stringify(newItems))
  }

  const addToCart = (product) => {
    if (!product?.id && !product?.cartItemId) return

    setCartItems((currentItems) => {
      const productQuantity = Number(product.quantity || 1)
      const itemKey = getCartItemKey(product)

      const existingItem = currentItems.find(
        (item) => getCartItemKey(item) === itemKey
      )

      let nextItems
      if (existingItem) {
        nextItems = currentItems.map((item) => {
          if (getCartItemKey(item) !== itemKey) return item

          return {
            ...item,
            quantity: getQuantity(item) + productQuantity,
          }
        })
      } else {
        nextItems = [
          ...currentItems,
          {
            ...product,
            cartItemId: itemKey,
            quantity: productQuantity,
          },
        ]
      }

      persistCart(nextItems)
      return nextItems
    })
  }

  const updateCartItem = (itemKey, patch) => {
    setCartItems((currentItems) => {
      const nextItems = currentItems.map((item) => {
        if (getCartItemKey(item) !== itemKey) return item

        return {
          ...item,
          ...patch,
        }
      })
      persistCart(nextItems)
      return nextItems
    })
  }

  const updateQuantity = (itemKey, quantity) => {
    const nextQuantity = Number(quantity)

    setCartItems((currentItems) => {
      let nextItems
      if (nextQuantity <= 0) {
        nextItems = currentItems.filter((item) => getCartItemKey(item) !== itemKey)
      } else {
        nextItems = currentItems.map((item) => {
          if (getCartItemKey(item) !== itemKey) return item

          return {
            ...item,
            quantity: nextQuantity,
          }
        })
      }
      persistCart(nextItems)
      return nextItems
    })
  }

  const removeFromCart = (itemKey) => {
    setCartItems((currentItems) => {
      const nextItems = currentItems.filter((item) => getCartItemKey(item) !== itemKey)
      persistCart(nextItems)
      return nextItems
    })
  }

  const clearCart = () => {
    setCartItems([])
    const { id, slug } = storeKeyInfo
    if (id) localStorage.removeItem(`@PratoBy:cart:${id}`)
    if (slug) localStorage.removeItem(`@PratoBy:cart:${slug}`)
    localStorage.removeItem(CART_KEY)
    localStorage.removeItem(LEGACY_CART_KEY)
  }

  const cartTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + getItemTotal(item), 0)
  }, [cartItems])

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + getQuantity(item), 0)
  }, [cartItems])

  const value = {
    cartItems,
    addToCart,
    updateCartItem,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    cartCount,
    getCartItemKey,
    getItemTotal,
    setStoreKey,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart precisa ser usado dentro de CartProvider')
  }

  return context
}


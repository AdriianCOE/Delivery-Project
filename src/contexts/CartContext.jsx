import { createContext, useContext, useEffect, useMemo, useState } from 'react'

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
  const updateCartItem = (itemKey, patch) => {
  setCartItems((currentItems) =>
    currentItems.map((item) => {
      if (getCartItemKey(item) !== itemKey) return item

      return {
        ...item,
        ...patch,
      }
    })
  )
}
  const [cartItems, setCartItems] = useState(loadCart)

  useEffect(() => {
    saveCart(cartItems)
  }, [cartItems])

  const addToCart = (product) => {
    if (!product?.id && !product?.cartItemId) return

    setCartItems((currentItems) => {
      const productQuantity = Number(product.quantity || 1)
      const itemKey = getCartItemKey(product)

      const existingItem = currentItems.find(
        (item) => getCartItemKey(item) === itemKey
      )

      if (existingItem) {
        return currentItems.map((item) => {
          if (getCartItemKey(item) !== itemKey) return item

          return {
            ...item,
            quantity: getQuantity(item) + productQuantity,
          }
        })
      }

      return [
        ...currentItems,
        {
          ...product,
          cartItemId: itemKey,
          quantity: productQuantity,
        },
      ]
    })
  }

  const updateQuantity = (itemKey, quantity) => {
    const nextQuantity = Number(quantity)

    setCartItems((currentItems) => {
      if (nextQuantity <= 0) {
        return currentItems.filter((item) => getCartItemKey(item) !== itemKey)
      }

      return currentItems.map((item) => {
        if (getCartItemKey(item) !== itemKey) return item

        return {
          ...item,
          quantity: nextQuantity,
        }
      })
    })
  }

  const removeFromCart = (itemKey) => {
    setCartItems((currentItems) =>
      currentItems.filter((item) => getCartItemKey(item) !== itemKey)
    )
  }

  const clearCart = () => {
    setCartItems([])
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


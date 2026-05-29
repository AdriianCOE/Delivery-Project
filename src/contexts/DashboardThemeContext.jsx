import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const DashboardThemeContext = createContext(null)

export function DashboardThemeProvider({ children }) {
  const location = useLocation()
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('pratoby:dashboard-theme') || 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    const isDashboard = location.pathname.startsWith('/dashboard')

    if (!isDashboard) {
      root.classList.remove('dark')
      return
    }

    const applyTheme = (targetTheme) => {
      if (targetTheme === 'dark') {
        root.classList.add('dark')
      } else if (targetTheme === 'light') {
        root.classList.remove('dark')
      } else {
        // System preference
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        if (mediaQuery.matches) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
    }

    applyTheme(theme)

    // Listen to changes in system preferences if theme === 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = (e) => {
        // double check we are still on a dashboard route before applying
        const currentIsDashboard = window.location.pathname.startsWith('/dashboard')
        if (currentIsDashboard) {
          if (e.matches) {
            root.classList.add('dark')
          } else {
            root.classList.remove('dark')
          }
        }
      }
      mediaQuery.addEventListener('change', listener)
      return () => mediaQuery.removeEventListener('change', listener)
    }
  }, [theme, location.pathname])

  const changeTheme = (newTheme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('pratoby:dashboard-theme', newTheme)
    } catch (e) {
      console.warn('LocalStorage indisponível ao salvar tema', e)
    }
  }

  return (
    <DashboardThemeContext.Provider value={{ theme, setTheme: changeTheme }}>
      {children}
    </DashboardThemeContext.Provider>
  )
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext)
  if (!context) {
    throw new Error('useDashboardTheme deve ser usado dentro de DashboardThemeProvider')
  }
  return context
}

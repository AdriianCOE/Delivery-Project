import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'

function deferSentryInit() {
  if (typeof window === 'undefined') return

  const loadSentry = () => {
    import('./services/sentry')
      .then((module) => module.initSentry())
      .catch(() => {})
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadSentry, { timeout: 4000 })
    return
  }

  window.setTimeout(loadSentry, 2500)
}

deferSentryInit()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
)

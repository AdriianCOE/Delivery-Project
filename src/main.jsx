import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initSentry, Sentry } from './services/sentry'
import App from './App'
import './index.css'

initSentry()

function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] p-6">
      <div className="max-w-md rounded-[2rem] bg-white p-8 text-center shadow-xl">
        <h1 className="text-2xl font-black text-[#111827]">
          Algo deu errado
        </h1>

        <p className="mt-3 text-sm leading-6 text-[#6b7280]">
          Tivemos um problema inesperado. Atualize a página ou tente novamente em alguns instantes.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-2xl bg-[#f97316] px-5 py-3 text-sm font-black text-white"
        >
          Recarregar página
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
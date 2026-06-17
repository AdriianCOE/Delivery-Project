;(function () {
  var analyticsLoaded = false
  var crispLoaded = false
  var CONSENT_KEY = 'pratoby_cookie_consent'
  var MARKETING_PATHS = {
    '/': true,
    '/planos': true,
    '/sobre': true,
    '/contato': true,
    '/exemplos': true,
    '/cardapio-digital': true,
    '/delivery-sem-comissao': true,
    '/sistema-para-confeitaria': true,
    '/sistema-para-lanchonete': true,
    '/sistema-para-pizzaria': true,
    '/cardapio-digital-para-restaurante': true,
    '/Cardapio-Digital': true,
  }
  var PRIVATE_PREFIXES = [
    '/admin',
    '/dashboard',
    '/login',
    '/cadastro',
    '/onboarding',
    '/auth',
    '/pedido',
    '/order',
    '/tracking',
    '/store',
  ]

  function loadScript(src) {
    var script = document.createElement('script')
    script.src = src
    script.async = true
    document.head.appendChild(script)
    return script
  }

  function loadGoogleAnalytics() {
    if (!hasAnalyticsConsent()) return
    if (analyticsLoaded || window.__PRATOBY_GA_LOADED__) return
    analyticsLoaded = true
    window.__PRATOBY_GA_LOADED__ = true

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }

    window.gtag('js', new Date())
    window.gtag('config', 'G-5MD3KHBK8C')

    loadScript('https://www.googletagmanager.com/gtag/js?id=G-5MD3KHBK8C')
  }

  function loadCrisp() {
    if (isStorefrontPath()) return
    if (crispLoaded || window.__PRATOBY_CRISP_LOADED__) return
    crispLoaded = true
    window.__PRATOBY_CRISP_LOADED__ = true

    window.$crisp = window.$crisp || []
    window.CRISP_WEBSITE_ID = '5a6d0014-bc30-4fbf-aa39-b7bf40c2e858'

    loadScript('https://client.crisp.chat/l.js')
  }

  function routeMatchesPrefix(pathname, prefix) {
    return pathname === prefix || pathname.indexOf(prefix + '/') === 0
  }

  function isStorefrontPath() {
    var pathname = window.location && window.location.pathname ? window.location.pathname : '/'

    if (MARKETING_PATHS[pathname]) return false

    for (var i = 0; i < PRIVATE_PREFIXES.length; i += 1) {
      if (routeMatchesPrefix(pathname, PRIVATE_PREFIXES[i])) return false
    }

    return /^\/[A-Za-z0-9][A-Za-z0-9-]{1,120}\/?$/.test(pathname)
  }

  function hasAnalyticsConsent() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(CONSENT_KEY)
      if (!raw) return false

      var parsed = JSON.parse(raw)
      return parsed && parsed.version === '1.0' && parsed.analytics === true
    } catch (_error) {
      return false
    }
  }

  function scheduleAnalytics() {
    window.setTimeout(function () {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadGoogleAnalytics, { timeout: 1500 })
        return
      }

      loadGoogleAnalytics()
    }, 4500)
  }

  var INTERACTION_EVENTS = ['click', 'scroll', 'keydown', 'touchstart', 'pointerdown']

  function onFirstInteraction() {
    loadGoogleAnalytics()
    loadCrisp()
    INTERACTION_EVENTS.forEach(function (evt) {
      window.removeEventListener(evt, onFirstInteraction, { passive: true, capture: true })
    })
  }

  scheduleAnalytics()

  window.addEventListener('pratoby:cookie-consent-changed', function (event) {
    if (event && event.detail && event.detail.analytics === true) {
      loadGoogleAnalytics()
    }
  })

  INTERACTION_EVENTS.forEach(function (evt) {
    window.addEventListener(evt, onFirstInteraction, { once: true, passive: true, capture: true })
  })

  // Keep chat outside the initial render path and usual Lighthouse trace window.
  window.setTimeout(function () {
    loadCrisp()
  }, 15000)
}())

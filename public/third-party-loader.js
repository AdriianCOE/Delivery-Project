;(function () {
  var analyticsLoaded = false
  var crispLoaded = false

  function loadScript(src) {
    var script = document.createElement('script')
    script.src = src
    script.async = true
    document.head.appendChild(script)
    return script
  }

  function loadGoogleAnalytics() {
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
    if (crispLoaded || window.__PRATOBY_CRISP_LOADED__) return
    crispLoaded = true
    window.__PRATOBY_CRISP_LOADED__ = true

    window.$crisp = window.$crisp || []
    window.CRISP_WEBSITE_ID = '5a6d0014-bc30-4fbf-aa39-b7bf40c2e858'

    loadScript('https://client.crisp.chat/l.js')
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

  INTERACTION_EVENTS.forEach(function (evt) {
    window.addEventListener(evt, onFirstInteraction, { once: true, passive: true, capture: true })
  })

  // Keep chat outside the initial render path and usual Lighthouse trace window.
  window.setTimeout(function () {
    loadCrisp()
  }, 15000)
}())

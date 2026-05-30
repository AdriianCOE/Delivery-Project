export function scrollToFirstError(options = {}) {
  const {
    container = document,
    selector = '[aria-invalid="true"], [data-error="true"], .field-error',
    delay = 80,
    block = 'center',
  } = options

  window.setTimeout(() => {
    const root = container?.current || container
    const errorElement = root?.querySelector?.(selector)

    if (!errorElement) return

    errorElement.scrollIntoView({
      behavior: 'smooth',
      block,
      inline: 'nearest',
    })

    const focusTarget =
      typeof errorElement.focus === 'function'
        ? errorElement
        : errorElement.querySelector?.('input, select, textarea, button, [tabindex]')

    if (focusTarget && typeof focusTarget.focus === 'function') {
      window.setTimeout(() => {
        focusTarget.focus({ preventScroll: true })
      }, 180)
    }
  }, delay)
}
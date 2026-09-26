import '@testing-library/jest-dom'

/**
 * jsdom implements neither `matchMedia` nor `Element.scrollTo`, both of which
 * real components here rely on for theme detection and autoscroll. Polyfilled
 * once here so any component test can render the real page rather than a
 * hand-rolled stand-in that drifts from it.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function scrollTo() {}
}

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

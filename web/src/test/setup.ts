import '@testing-library/jest-dom/vitest'

// jsdom does no layout, so hit-testing doesn't exist; report "nothing under the point" like an empty area would.
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null
}

// Also missing from jsdom, and used by the panel (height reporting) and by Radix/cmdk for positioning.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

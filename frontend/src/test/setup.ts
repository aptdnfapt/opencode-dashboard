// frontend/src/test/setup.ts
import 'jsdom'

const dom = new (require('jsdom').JSDOM)('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173',
  pretendToBeVisual: true,
})

global.document = dom.window.document
global.window = dom.window
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.requestAnimationFrame = (cb) => setTimeout(cb, 16)
global.cancelAnimationFrame = (id) => clearTimeout(id)

import '@testing-library/jest-dom'
import type { TrackedMutation, MutationKind, UndoData } from '../types'

let mutationCounter = 0
function uid(): string { return `m_${++mutationCounter}_${Date.now()}` }

/**
 * Generate a unique CSS selector for an element.
 */
function getSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`
  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${testId}"]`

  const path: string[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    let seg = current.tagName.toLowerCase()
    if (current.id) { path.unshift(`#${CSS.escape(current.id)}`); break }
    const classes = Array.from(current.classList).filter(c => c.length > 2 && !/^[a-z]{1,3}-[a-zA-Z0-9_-]{5,}$/.test(c)).slice(0, 2)
    if (classes.length) seg += '.' + classes.map(c => CSS.escape(c)).join('.')
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current!.tagName)
      if (siblings.length > 1) seg += `:nth-child(${siblings.indexOf(current) + 1})`
    }
    path.unshift(seg)
    current = current.parentElement
  }
  return path.join(' > ')
}

function getShortSelector(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (el.id) return `${tag}#${el.id}`
  const classes = Array.from(el.classList).filter(c => c.length > 2).slice(0, 2)
  if (classes.length) return `${tag}.${classes.join('.')}`
  return tag
}

function getBounds(el: Element): { x: number; y: number; w: number; h: number } | null {
  try {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  } catch { return null }
}

function summarizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim()
    return text ? `text("${text.slice(0, 40)}${text.length > 40 ? '...' : ''}")` : 'text(empty)'
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    return `<${getShortSelector(el)}>`
  }
  return 'node'
}

export type MutationCallback = (mutation: TrackedMutation) => void

export class DOMObserver {
  private observer: MutationObserver | null = null
  private callback: MutationCallback
  private ignoreSelectors: string[]
  private active = false

  constructor(callback: MutationCallback, ignoreSelectors: string[] = []) {
    this.callback = callback
    this.ignoreSelectors = ignoreSelectors
  }

  start(): void {
    if (this.active) return
    this.active = true

    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        const mutations = this.processRecord(record)
        for (const m of mutations) this.callback(m)
      }
    })

    this.observer.observe(document.body, {
      attributes: true,
      attributeOldValue: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true,
    })
  }

  stop(): void {
    this.active = false
    this.observer?.disconnect()
    this.observer = null
  }

  isActive(): boolean { return this.active }

  private processRecord(record: MutationRecord): TrackedMutation[] {
    const target = record.target

    // Skip our own UI
    if (target instanceof Element || target.parentElement) {
      const el = target instanceof Element ? target : target.parentElement!
      for (const sel of this.ignoreSelectors) {
        if (el.matches(sel) || el.closest(sel)) return []
      }
    }

    // Skip invisible/irrelevant
    if (target instanceof Element) {
      if (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'META') return []
    }

    const mutations: TrackedMutation[] = []

    if (record.type === 'attributes' && target instanceof Element) {
      const attrName = record.attributeName || ''
      const oldVal = record.oldValue
      const newVal = target.getAttribute(attrName)

      // Skip if no real change
      if (oldVal === newVal) return []

      const isStyle = attrName === 'style'
      const kind: MutationKind = isStyle ? 'style' : 'attribute'

      mutations.push({
        id: uid(),
        kind,
        timestamp: Date.now(),
        selector: getSelector(target),
        shortSelector: getShortSelector(target),
        tag: target.tagName.toLowerCase(),
        attributeName: attrName,
        before: oldVal,
        after: newVal,
        addedNodes: [],
        removedNodes: [],
        bounds: getBounds(target),
        status: 'pending',
        reverted: false,
        element: new WeakRef(target),
        undoData: {
          kind,
          selector: getSelector(target),
          attributeName: attrName,
          oldValue: oldVal,
          removedHTML: [],
          addedSelectors: [],
        },
      })
    }

    if (record.type === 'childList') {
      const parent = target instanceof Element ? target : target.parentElement
      if (!parent) return []

      const addedSummaries: string[] = []
      const removedSummaries: string[] = []
      const removedHTML: string[] = []
      const addedSelectors: string[] = []

      record.addedNodes.forEach(node => {
        addedSummaries.push(summarizeNode(node))
        if (node instanceof Element) addedSelectors.push(getSelector(node))
      })
      record.removedNodes.forEach(node => {
        removedSummaries.push(summarizeNode(node))
        if (node instanceof Element) removedHTML.push(node.outerHTML)
        else if (node.nodeType === Node.TEXT_NODE) removedHTML.push(node.textContent || '')
      })

      if (addedSummaries.length || removedSummaries.length) {
        mutations.push({
          id: uid(),
          kind: 'childList',
          timestamp: Date.now(),
          selector: getSelector(parent),
          shortSelector: getShortSelector(parent),
          tag: parent.tagName.toLowerCase(),
          attributeName: null,
          before: removedSummaries.length ? removedSummaries.join(', ') : null,
          after: addedSummaries.length ? addedSummaries.join(', ') : null,
          addedNodes: addedSummaries,
          removedNodes: removedSummaries,
          bounds: getBounds(parent),
          status: 'pending',
          reverted: false,
          element: new WeakRef(parent),
          undoData: {
            kind: 'childList',
            selector: getSelector(parent),
            attributeName: null,
            oldValue: null,
            removedHTML,
            addedSelectors,
          },
        })
      }
    }

    if (record.type === 'characterData') {
      const el = target.parentElement
      if (!el) return []

      const oldVal = record.oldValue
      const newVal = target.textContent

      if (oldVal === newVal) return []

      mutations.push({
        id: uid(),
        kind: 'text',
        timestamp: Date.now(),
        selector: getSelector(el),
        shortSelector: getShortSelector(el),
        tag: el.tagName.toLowerCase(),
        attributeName: null,
        before: oldVal,
        after: newVal,
        addedNodes: [],
        removedNodes: [],
        bounds: getBounds(el),
        status: 'pending',
        reverted: false,
        element: new WeakRef(el),
        undoData: {
          kind: 'text',
          selector: getSelector(el),
          attributeName: null,
          oldValue: oldVal,
          removedHTML: [],
          addedSelectors: [],
        },
      })
    }

    return mutations
  }
}

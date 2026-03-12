// ═══════════════════════════════════════════
// REWINDUI v1 — Observer
// ═══════════════════════════════════════════

import type { TrackedMutation, MutationType, UndoData } from '../types'

let mutationCounter = 0
function uid(): string { return `m_${++mutationCounter}_${Date.now()}` }

export class Observer {
  private observer: MutationObserver | null = null
  private buffer: TrackedMutation[] = []
  private ignoreSelectors: string[]
  private flushCallback: ((mutations: TrackedMutation[]) => void) | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private commitWindow: number

  constructor(ignoreSelectors: string[] = ['[data-rewind-ui]'], commitWindow = 500) {
    this.ignoreSelectors = ignoreSelectors
    this.commitWindow = commitWindow
  }

  start(target: Node, onFlush: (mutations: TrackedMutation[]) => void): void {
    if (this.observer) return
    this.flushCallback = onFlush

    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        const mutations = this.processMutationRecord(record)
        this.buffer.push(...mutations)
      }
      this.scheduleFlush()
    })

    this.observer.observe(target, {
      attributes: true, attributeOldValue: true,
      childList: true,
      characterData: true, characterDataOldValue: true,
      subtree: true,
    })
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
    if (this.buffer.length > 0) this.flush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), this.commitWindow)
  }

  private flush(): void {
    if (this.buffer.length === 0) return
    const batch = [...this.buffer]
    this.buffer = []
    this.flushCallback?.(batch)
  }

  private processMutationRecord(record: MutationRecord): TrackedMutation[] {
    const results: TrackedMutation[] = []
    const target = record.target as Element

    // Skip ignored elements
    if (this.shouldIgnore(target)) return results

    if (record.type === 'attributes') {
      const el = target as Element
      const attr = record.attributeName || ''
      if (attr === 'data-rewind-ui' || attr.startsWith('data-rewind')) return results

      const type: MutationType = attr === 'style' ? 'style' : 'attribute'
      const newValue = el.getAttribute(attr)

      results.push({
        id: uid(), type, selector: getSelector(el), shortSelector: getShortSelector(el),
        tag: el.tagName.toLowerCase(), attributeName: attr,
        oldValue: record.oldValue, newValue,
        timestamp: Date.now(), bounds: getBounds(el),
        status: 'pending', impact: computeImpact(el),
        undoData: { type: 'attribute', selector: getSelector(el), attributeName: attr, oldValue: record.oldValue },
      })
    }

    if (record.type === 'characterData') {
      const el = target.parentElement
      if (!el || this.shouldIgnore(el)) return results

      results.push({
        id: uid(), type: 'text', selector: getSelector(el), shortSelector: getShortSelector(el),
        tag: el.tagName.toLowerCase(), attributeName: null,
        oldValue: record.oldValue, newValue: target.textContent,
        timestamp: Date.now(), bounds: getBounds(el),
        status: 'pending', impact: computeImpact(el),
        undoData: { type: 'text', selector: getSelector(el), oldValue: record.oldValue },
      })
    }

    if (record.type === 'childList') {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue
        const el = node as Element
        if (this.shouldIgnore(el)) continue
        if (el.tagName === 'SCRIPT' || el.tagName === 'LINK' || el.tagName === 'META') continue

        results.push({
          id: uid(), type: 'dom-add', selector: getSelector(el), shortSelector: getShortSelector(el),
          tag: el.tagName.toLowerCase(), attributeName: null,
          oldValue: null, newValue: el.outerHTML.slice(0, 200),
          timestamp: Date.now(), bounds: getBounds(el),
          status: 'pending', impact: computeImpact(el),
          undoData: { type: 'add', selector: getSelector(el), addedSelector: getSelector(el) },
        })
      }

      for (const node of record.removedNodes) {
        if (node.nodeType !== 1) continue
        const el = node as Element

        const parentEl = record.target as Element
        results.push({
          id: uid(), type: 'dom-remove', selector: getShortSelector(el), shortSelector: getShortSelector(el),
          tag: el.tagName.toLowerCase(), attributeName: null,
          oldValue: el.outerHTML.slice(0, 500), newValue: null,
          timestamp: Date.now(), bounds: null,
          status: 'pending', impact: 0.3,
          undoData: { type: 'remove', selector: getShortSelector(el), removedHTML: el.outerHTML, parentSelector: getSelector(parentEl) },
        })
      }
    }

    return results
  }

  private shouldIgnore(el: Element | null): boolean {
    if (!el || !el.closest) return true
    for (const sel of this.ignoreSelectors) {
      try { if (el.closest(sel)) return true } catch { /* invalid selector */ }
    }
    return false
  }
}

// ─── Selectors ───

export function getSelector(el: Element): string {
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
      if (siblings.length > 1) seg += `:nth-child(${Array.from(parent.children).indexOf(current) + 1})`
    }
    path.unshift(seg)
    current = current.parentElement
  }
  return path.join(' > ')
}

export function getShortSelector(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (el.id) return `${tag}#${el.id}`
  const classes = Array.from(el.classList).filter(c => c.length > 2 && !/^[a-z]{1,3}-[a-zA-Z0-9_-]{5,}$/.test(c)).slice(0, 2)
  if (classes.length) return `${tag}.${classes.join('.')}`
  const role = el.getAttribute('role')
  if (role) return `${tag}[role="${role}"]`
  return tag
}

function getBounds(el: Element): { x: number; y: number; w: number; h: number } | null {
  try {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  } catch { return null }
}

function computeImpact(el: Element): number {
  try {
    const r = el.getBoundingClientRect()
    const viewport = window.innerWidth * window.innerHeight
    if (viewport === 0) return 0
    return Math.min(1, Math.round(((r.width * r.height) / viewport) * 100) / 100)
  } catch { return 0 }
}

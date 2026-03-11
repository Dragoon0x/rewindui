import type { TrackedMutation, Commit, TimelineState } from '../types'

type Listener = () => void
let commitCounter = 0

export class TimelineStore {
  private commits: Commit[] = []
  private listeners = new Set<Listener>()
  private version = 0
  private commitWindow: number
  private maxCommits: number
  private pendingMutations: TrackedMutation[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(commitWindow = 500, maxCommits = 200) {
    this.commitWindow = commitWindow
    this.maxCommits = maxCommits
  }

  getSnapshot = (): number => this.version
  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.version++
    this.listeners.forEach(l => l())
  }

  /**
   * Add a mutation. Mutations within the commit window are grouped.
   */
  addMutation(mutation: TrackedMutation): void {
    this.pendingMutations.push(mutation)

    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flushCommit(), this.commitWindow)
  }

  private flushCommit(): void {
    if (this.pendingMutations.length === 0) return

    const mutations = [...this.pendingMutations]
    this.pendingMutations = []

    const commit: Commit = {
      id: `c_${++commitCounter}_${Date.now()}`,
      timestamp: mutations[0].timestamp,
      label: this.generateLabel(mutations),
      mutations,
      summary: this.generateSummary(mutations),
      status: 'pending',
    }

    this.commits.push(commit)

    // Trim old commits
    if (this.commits.length > this.maxCommits) {
      this.commits = this.commits.slice(-this.maxCommits)
    }

    this.notify()
  }

  /** Force flush any pending mutations into a commit */
  flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushCommit()
  }

  getCommits(): Commit[] { return this.commits }

  getState(): TimelineState {
    let total = 0, pending = 0, accepted = 0, rejected = 0
    for (const c of this.commits) {
      for (const m of c.mutations) {
        total++
        if (m.status === 'pending') pending++
        else if (m.status === 'accepted') accepted++
        else if (m.status === 'rejected') rejected++
      }
    }

    return {
      commits: this.commits,
      recording: false, // Set by component
      selectedCommitId: null,
      selectedMutationId: null,
      stats: { total, pending, accepted, rejected },
    }
  }

  /**
   * Accept an entire commit.
   */
  acceptCommit(commitId: string): void {
    const commit = this.commits.find(c => c.id === commitId)
    if (!commit) return
    commit.status = 'accepted'
    for (const m of commit.mutations) m.status = 'accepted'
    this.notify()
  }

  /**
   * Reject an entire commit and attempt to revert changes.
   */
  rejectCommit(commitId: string): void {
    const commit = this.commits.find(c => c.id === commitId)
    if (!commit) return
    commit.status = 'rejected'

    // Revert in reverse order
    for (let i = commit.mutations.length - 1; i >= 0; i--) {
      this.revertMutation(commit.mutations[i])
    }
    this.notify()
  }

  /**
   * Accept a single mutation.
   */
  acceptMutation(mutationId: string): void {
    for (const c of this.commits) {
      const m = c.mutations.find(m => m.id === mutationId)
      if (m) {
        m.status = 'accepted'
        this.updateCommitStatus(c)
        this.notify()
        return
      }
    }
  }

  /**
   * Reject and revert a single mutation.
   */
  rejectMutation(mutationId: string): void {
    for (const c of this.commits) {
      const m = c.mutations.find(m => m.id === mutationId)
      if (m) {
        this.revertMutation(m)
        this.updateCommitStatus(c)
        this.notify()
        return
      }
    }
  }

  private revertMutation(m: TrackedMutation): void {
    if (m.reverted || m.status === 'accepted') return
    m.status = 'rejected'

    if (!m.undoData) { m.reverted = true; return }

    const el = m.element?.deref()
    if (!el) {
      // Try to find by selector
      try {
        const found = document.querySelector(m.undoData.selector)
        if (found) {
          this.applyUndo(found, m)
          return
        }
      } catch { /* ignore */ }
      m.reverted = true
      return
    }

    this.applyUndo(el, m)
  }

  private applyUndo(el: Element, m: TrackedMutation): void {
    const undo = m.undoData!

    try {
      if (undo.kind === 'attribute' || undo.kind === 'style') {
        if (undo.attributeName) {
          if (undo.oldValue === null) {
            el.removeAttribute(undo.attributeName)
          } else {
            el.setAttribute(undo.attributeName, undo.oldValue)
          }
        }
      } else if (undo.kind === 'text') {
        if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
          el.firstChild.textContent = undo.oldValue
        }
      } else if (undo.kind === 'childList') {
        // Remove added nodes
        for (const sel of undo.addedSelectors) {
          try {
            const added = el.querySelector(sel) || document.querySelector(sel)
            added?.remove()
          } catch { /* ignore */ }
        }
        // Re-add removed nodes
        for (const html of undo.removedHTML) {
          const temp = document.createElement('div')
          temp.innerHTML = html
          while (temp.firstChild) el.appendChild(temp.firstChild)
        }
      }
    } catch { /* best effort */ }

    m.reverted = true
  }

  private updateCommitStatus(commit: Commit): void {
    const statuses = new Set(commit.mutations.map(m => m.status))
    if (statuses.size === 1) {
      commit.status = statuses.values().next().value!
    } else {
      commit.status = 'partial'
    }
  }

  /**
   * Accept all pending.
   */
  acceptAll(): void {
    for (const c of this.commits) {
      if (c.status === 'pending' || c.status === 'partial') {
        c.status = 'accepted'
        for (const m of c.mutations) {
          if (m.status === 'pending') m.status = 'accepted'
        }
      }
    }
    this.notify()
  }

  /**
   * Clear all commits.
   */
  clear(): void {
    this.commits = []
    this.pendingMutations = []
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.notify()
  }

  /**
   * Export changelog as structured markdown.
   */
  exportMarkdown(): string {
    const lines: string[] = ['# Visual Changelog', '', `**URL:** ${window.location.href}`, `**Recorded:** ${new Date().toISOString()}`, '']

    const stats = this.getState().stats
    lines.push(`**Changes:** ${stats.total} total, ${stats.accepted} accepted, ${stats.rejected} rejected, ${stats.pending} pending`, '')

    for (const commit of this.commits) {
      const time = new Date(commit.timestamp).toLocaleTimeString()
      const icon = commit.status === 'accepted' ? '✓' : commit.status === 'rejected' ? '✗' : '○'
      lines.push(`## ${icon} ${commit.label} (${time})`)
      lines.push('')

      for (const m of commit.mutations) {
        const mIcon = m.status === 'accepted' ? '✓' : m.status === 'rejected' ? '✗' : '○'
        lines.push(`### ${mIcon} \`${m.shortSelector}\` — ${m.kind}`)
        if (m.before !== null) lines.push(`- **Before:** \`${m.before?.slice(0, 200)}\``)
        if (m.after !== null) lines.push(`- **After:** \`${m.after?.slice(0, 200)}\``)
        if (m.addedNodes.length) lines.push(`- **Added:** ${m.addedNodes.join(', ')}`)
        if (m.removedNodes.length) lines.push(`- **Removed:** ${m.removedNodes.join(', ')}`)
        lines.push(`- **Selector:** \`${m.selector}\``)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  /**
   * Export as JSON.
   */
  exportJSON(): string {
    return JSON.stringify({
      url: window.location.href,
      timestamp: new Date().toISOString(),
      stats: this.getState().stats,
      commits: this.commits.map(c => ({
        id: c.id,
        timestamp: c.timestamp,
        label: c.label,
        status: c.status,
        summary: c.summary,
        mutations: c.mutations.map(m => ({
          id: m.id,
          kind: m.kind,
          selector: m.selector,
          shortSelector: m.shortSelector,
          tag: m.tag,
          attributeName: m.attributeName,
          before: m.before,
          after: m.after,
          addedNodes: m.addedNodes,
          removedNodes: m.removedNodes,
          bounds: m.bounds,
          status: m.status,
        })),
      })),
    }, null, 2)
  }

  // ─── Label / Summary Generation ────────────────────────────

  private generateLabel(mutations: TrackedMutation[]): string {
    if (mutations.length === 1) {
      const m = mutations[0]
      if (m.kind === 'style') return `Style: ${m.shortSelector}`
      if (m.kind === 'attribute') return `Attr: ${m.shortSelector}.${m.attributeName}`
      if (m.kind === 'text') return `Text: ${m.shortSelector}`
      if (m.kind === 'childList') {
        if (m.addedNodes.length && !m.removedNodes.length) return `Added to ${m.shortSelector}`
        if (m.removedNodes.length && !m.addedNodes.length) return `Removed from ${m.shortSelector}`
        return `Children: ${m.shortSelector}`
      }
    }

    const kinds = new Set(mutations.map(m => m.kind))
    const selectors = new Set(mutations.map(m => m.shortSelector))

    if (selectors.size === 1) return `${mutations.length} changes to ${selectors.values().next().value}`
    if (kinds.size === 1) return `${mutations.length} ${kinds.values().next().value} changes`
    return `${mutations.length} mutations`
  }

  private generateSummary(mutations: TrackedMutation[]): string {
    const parts: string[] = []
    const styles = mutations.filter(m => m.kind === 'style').length
    const attrs = mutations.filter(m => m.kind === 'attribute').length
    const text = mutations.filter(m => m.kind === 'text').length
    const children = mutations.filter(m => m.kind === 'childList').length

    if (styles) parts.push(`${styles} style`)
    if (attrs) parts.push(`${attrs} attribute`)
    if (text) parts.push(`${text} text`)
    if (children) parts.push(`${children} DOM`)

    return parts.join(', ') + ' change' + (mutations.length > 1 ? 's' : '')
  }
}

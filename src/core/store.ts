// ═══════════════════════════════════════════
// REWINDUI v1 — Store
// ═══════════════════════════════════════════

import type { Commit, TrackedMutation, CommitStatus, TimelineState, TimelineStats, Snapshot } from '../types'
import { Observer } from './observer'

type Listener = () => void
let commitCounter = 0

export class TimelineStore {
  private state: TimelineState = { commits: [], snapshots: [], recording: false, cursor: -1 }
  private listeners = new Set<Listener>()
  private version = 0
  private observer: Observer
  private maxCommits: number
  private startTime = 0
  private persistKey: string | null = null

  constructor(opts?: { ignoreSelectors?: string[]; commitWindow?: number; maxCommits?: number; persistKey?: string }) {
    this.observer = new Observer(opts?.ignoreSelectors || ['[data-rewind-ui]'], opts?.commitWindow || 500)
    this.maxCommits = opts?.maxCommits || 200
    this.persistKey = opts?.persistKey || null
    if (this.persistKey) this.loadFromStorage()
  }

  // ─── Recording ───

  startRecording(): void {
    if (this.state.recording || typeof document === 'undefined') return
    this.state.recording = true
    this.startTime = Date.now()
    this.observer.start(document.body, (mutations) => this.onMutations(mutations))
    this.notify()
  }

  stopRecording(): void {
    if (!this.state.recording) return
    this.observer.stop()
    this.state.recording = false
    this.notify()
  }

  isRecording(): boolean { return this.state.recording }

  // ─── State Access ───

  getState(): TimelineState { return this.state }
  getCommits(): Commit[] { return this.state.commits }
  getCommit(id: string): Commit | undefined { return this.state.commits.find(c => c.id === id) }

  getStats(): TimelineStats {
    const commits = this.state.commits
    let pending = 0, accepted = 0, rejected = 0
    let style = 0, text = 0, attr = 0, dom = 0, totalImpact = 0

    for (const c of commits) {
      if (c.status === 'pending') pending++
      else if (c.status === 'accepted') accepted++
      else if (c.status === 'rejected') rejected++
      totalImpact += c.impact
      for (const m of c.mutations) {
        if (m.type === 'style') style++
        else if (m.type === 'text') text++
        else if (m.type === 'attribute') attr++
        else dom++
      }
    }

    return {
      total: commits.length, pending, accepted, rejected,
      styleChanges: style, textChanges: text, attributeChanges: attr, domChanges: dom,
      totalImpact: Math.round(totalImpact * 100) / 100,
      duration: this.startTime > 0 ? Date.now() - this.startTime : 0,
    }
  }

  // ─── Actions ───

  acceptCommit(commitId: string): void {
    const commit = this.getCommit(commitId)
    if (!commit) return
    commit.status = 'accepted'
    commit.mutations.forEach(m => { m.status = 'accepted' })
    this.notify()
    this.persist()
  }

  rejectCommit(commitId: string): void {
    const commit = this.getCommit(commitId)
    if (!commit) return
    commit.status = 'rejected'

    // Undo mutations in reverse order
    for (let i = commit.mutations.length - 1; i >= 0; i--) {
      const m = commit.mutations[i]
      m.status = 'rejected'
      this.undoMutation(m)
    }

    this.notify()
    this.persist()
  }

  acceptMutation(commitId: string, mutationId: string): void {
    const commit = this.getCommit(commitId)
    if (!commit) return
    const m = commit.mutations.find(x => x.id === mutationId)
    if (m) m.status = 'accepted'
    this.updateCommitStatus(commit)
    this.notify()
    this.persist()
  }

  rejectMutation(commitId: string, mutationId: string): void {
    const commit = this.getCommit(commitId)
    if (!commit) return
    const m = commit.mutations.find(x => x.id === mutationId)
    if (m) { m.status = 'rejected'; this.undoMutation(m) }
    this.updateCommitStatus(commit)
    this.notify()
    this.persist()
  }

  acceptAll(): void {
    for (const c of this.state.commits) {
      if (c.status === 'pending') {
        c.status = 'accepted'
        c.mutations.forEach(m => { m.status = 'accepted' })
      }
    }
    this.notify()
    this.persist()
  }

  rejectAll(): void {
    for (const c of [...this.state.commits].reverse()) {
      if (c.status === 'pending') this.rejectCommit(c.id)
    }
  }

  annotate(commitId: string, text: string): void {
    const commit = this.getCommit(commitId)
    if (commit) { commit.annotation = text; this.notify(); this.persist() }
  }

  // ─── Snapshots ───

  takeSnapshot(label?: string): string {
    const id = `snap_${Date.now()}`
    const html = typeof document !== 'undefined' ? document.body.innerHTML : ''
    this.state.snapshots.push({ id, timestamp: Date.now(), label: label || `Snapshot ${this.state.snapshots.length + 1}`, html })
    this.notify()
    return id
  }

  getSnapshots(): Snapshot[] { return this.state.snapshots }

  // ─── Filter & Search ───

  filterByType(type: string): Commit[] {
    return this.state.commits.filter(c => c.mutations.some(m => m.type === type))
  }

  filterByStatus(status: CommitStatus): Commit[] {
    return this.state.commits.filter(c => c.status === status)
  }

  search(query: string): Commit[] {
    const q = query.toLowerCase()
    return this.state.commits.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.annotation && c.annotation.toLowerCase().includes(q)) ||
      c.mutations.some(m => (m.selector + ' ' + (m.oldValue || '') + ' ' + (m.newValue || '')).toLowerCase().includes(q))
    )
  }

  // ─── Batch Operations ───

  acceptByType(type: string): number {
    let count = 0
    for (const c of this.state.commits) {
      if (c.status !== 'pending') continue
      const matching = c.mutations.filter(m => m.type === type && m.status === 'pending')
      if (matching.length > 0) {
        matching.forEach(m => { m.status = 'accepted' })
        this.updateCommitStatus(c)
        count += matching.length
      }
    }
    this.notify()
    this.persist()
    return count
  }

  rejectByType(type: string): number {
    let count = 0
    for (const c of this.state.commits) {
      if (c.status !== 'pending') continue
      const matching = c.mutations.filter(m => m.type === type && m.status === 'pending')
      for (const m of matching) { m.status = 'rejected'; this.undoMutation(m); count++ }
      this.updateCommitStatus(c)
    }
    this.notify()
    this.persist()
    return count
  }

  // ─── Export ───

  exportMarkdown(): string {
    const stats = this.getStats()
    const lines: string[] = []
    lines.push(`# Rewind Session`)
    lines.push(``)
    lines.push(`${stats.total} commits. ${stats.accepted} accepted, ${stats.rejected} rejected, ${stats.pending} pending.`)
    lines.push(``)

    for (const c of this.state.commits) {
      const icon = c.status === 'accepted' ? '✓' : c.status === 'rejected' ? '✗' : '○'
      const time = new Date(c.timestamp).toLocaleTimeString()
      lines.push(`## ${icon} ${c.label} (${time})`)
      if (c.annotation) lines.push(`> ${c.annotation}`)
      lines.push(``)

      for (const m of c.mutations) {
        const mi = m.status === 'accepted' ? '✓' : m.status === 'rejected' ? '✗' : '○'
        lines.push(`### ${mi} \`${m.shortSelector}\` — ${m.type}`)
        if (m.oldValue) lines.push(`- **Before:** \`${m.oldValue.slice(0, 120)}\``)
        if (m.newValue) lines.push(`- **After:** \`${m.newValue.slice(0, 120)}\``)
        lines.push(`- **Selector:** \`${m.selector}\``)
        lines.push(`- **Impact:** ${Math.round(m.impact * 100)}%`)
        lines.push(``)
      }
    }

    return lines.join('\n')
  }

  exportJSON(): string {
    return JSON.stringify({ commits: this.state.commits, stats: this.getStats() }, null, 2)
  }

  exportAgentBlock(): string {
    const stats = this.getStats()
    const lines: string[] = []
    lines.push(`<dom_changes>`)
    lines.push(`<!-- ${stats.total} changes, ${stats.accepted} accepted, ${stats.rejected} rejected -->`)
    lines.push(``)

    const accepted = this.state.commits.filter(c => c.status === 'accepted')
    const rejected = this.state.commits.filter(c => c.status === 'rejected')

    if (accepted.length > 0) {
      lines.push(`## Approved changes (${accepted.length})`)
      for (const c of accepted) {
        for (const m of c.mutations) {
          lines.push(`- **${m.shortSelector}**: ${m.type} change approved`)
          if (m.newValue) lines.push(`  (new: \`${m.newValue.slice(0, 80)}\`)`)
        }
      }
      lines.push(``)
    }

    if (rejected.length > 0) {
      lines.push(`## Rejected changes — revert these (${rejected.length})`)
      for (const c of rejected) {
        for (const m of c.mutations) {
          lines.push(`- **${m.shortSelector}**: ${m.type} change rejected`)
          if (m.oldValue) lines.push(`  (restore to: \`${m.oldValue.slice(0, 80)}\`)`)
        }
      }
      lines.push(``)
    }

    lines.push(`</dom_changes>`)
    return lines.join('\n')
  }

  // ─── Clear ───

  clear(): void {
    this.state.commits = []
    this.state.snapshots = []
    this.state.cursor = -1
    this.notify()
    this.persist()
  }

  // ─── Subscriptions ───

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): number { return this.version }

  private notify(): void {
    this.version++
    this.listeners.forEach(l => l())
  }

  // ─── Internal ───

  private onMutations(mutations: TrackedMutation[]): void {
    if (mutations.length === 0) return

    const commit: Commit = {
      id: `c_${++commitCounter}_${Date.now()}`,
      mutations,
      timestamp: Date.now(),
      status: 'pending',
      label: generateLabel(mutations),
      annotation: null,
      impact: mutations.reduce((sum, m) => sum + m.impact, 0),
    }

    this.state.commits.push(commit)
    if (this.state.commits.length > this.maxCommits) {
      this.state.commits = this.state.commits.slice(-this.maxCommits)
    }

    this.notify()
    this.persist()
  }

  private undoMutation(m: TrackedMutation): void {
    if (!m.undoData || typeof document === 'undefined') return
    try {
      const ud = m.undoData
      if (ud.type === 'attribute' && ud.attributeName) {
        const el = document.querySelector(ud.selector)
        if (el) {
          if (ud.oldValue === null || ud.oldValue === undefined) el.removeAttribute(ud.attributeName)
          else el.setAttribute(ud.attributeName, ud.oldValue as string)
        }
      }
      if (ud.type === 'text') {
        const el = document.querySelector(ud.selector)
        if (el && el.firstChild) el.firstChild.textContent = ud.oldValue || ''
      }
      if (ud.type === 'add' && ud.addedSelector) {
        const el = document.querySelector(ud.addedSelector)
        if (el) el.remove()
      }
      if (ud.type === 'remove' && ud.removedHTML && ud.parentSelector) {
        const parent = document.querySelector(ud.parentSelector)
        if (parent) {
          const temp = document.createElement('div')
          temp.innerHTML = ud.removedHTML
          while (temp.firstChild) parent.appendChild(temp.firstChild)
        }
      }
    } catch { /* best effort undo */ }
  }

  private updateCommitStatus(commit: Commit): void {
    const statuses = commit.mutations.map(m => m.status)
    if (statuses.every(s => s === 'accepted')) commit.status = 'accepted'
    else if (statuses.every(s => s === 'rejected')) commit.status = 'rejected'
    else commit.status = 'pending'
  }

  private persist(): void {
    if (!this.persistKey || typeof localStorage === 'undefined') return
    try {
      const data = { commits: this.state.commits.map(c => ({ ...c, mutations: c.mutations.map(m => ({ ...m, undoData: null })) })) }
      localStorage.setItem(this.persistKey, JSON.stringify(data))
    } catch { /* full or unavailable */ }
  }

  private loadFromStorage(): void {
    if (!this.persistKey || typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(this.persistKey)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.commits && Array.isArray(data.commits)) {
          this.state.commits = data.commits
        }
      }
    } catch { /* ignore */ }
  }
}

// ─── Smart Labels ───

function generateLabel(mutations: TrackedMutation[]): string {
  if (mutations.length === 0) return 'Empty commit'
  if (mutations.length === 1) return singleLabel(mutations[0])

  const types = new Set(mutations.map(m => m.type))
  const selectors = [...new Set(mutations.map(m => m.shortSelector))]
  const target = selectors.length === 1 ? selectors[0] : `${selectors.length} elements`

  if (types.size === 1) {
    const type = mutations[0].type
    if (type === 'style') return `Restyled ${target}`
    if (type === 'text') return `Edited text in ${target}`
    if (type === 'attribute') return `Updated ${target}`
    if (type === 'dom-add') return `Added ${mutations.length} elements`
    if (type === 'dom-remove') return `Removed ${mutations.length} elements`
  }

  return `Updated ${target} (${mutations.length} changes)`
}

function singleLabel(m: TrackedMutation): string {
  const target = m.shortSelector

  if (m.type === 'style') {
    if (m.newValue && m.oldValue) {
      // Try to identify what changed
      if (m.newValue.includes('color') || m.newValue.includes('background')) return `Color change on ${target}`
      if (m.newValue.includes('padding') || m.newValue.includes('margin')) return `Spacing change on ${target}`
      if (m.newValue.includes('font') || m.newValue.includes('text')) return `Typography change on ${target}`
    }
    return `Style: ${target}`
  }

  if (m.type === 'text') {
    const oldLen = m.oldValue?.length || 0
    const newLen = m.newValue?.length || 0
    if (newLen > oldLen * 1.5) return `Expanded text in ${target}`
    if (newLen < oldLen * 0.5) return `Trimmed text in ${target}`
    return `Edited text in ${target}`
  }

  if (m.type === 'attribute') {
    if (m.attributeName === 'class') return `Class change on ${target}`
    if (m.attributeName === 'src') return `Updated source on ${target}`
    if (m.attributeName === 'href') return `Updated link on ${target}`
    return `${m.attributeName} change on ${target}`
  }

  if (m.type === 'dom-add') return `Added ${target}`
  if (m.type === 'dom-remove') return `Removed ${target}`

  return `Change on ${target}`
}

// Global singleton
let globalStore: TimelineStore | null = null

export function getStore(opts?: ConstructorParameters<typeof TimelineStore>[0]): TimelineStore {
  if (!globalStore) globalStore = new TimelineStore(opts)
  return globalStore
}

export function resetStore(): void {
  globalStore?.stopRecording()
  globalStore = null
}

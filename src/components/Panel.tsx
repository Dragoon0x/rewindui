import React, { useState, useRef, useEffect } from 'react'
import type { Commit, TrackedMutation, TimelineState } from '../types'
import { REWIND_COLORS as C } from '../types'
import type { TimelineStore } from '../core/timeline'

interface PanelProps {
  store: TimelineStore
  state: TimelineState
  recording: boolean
  position: 'bottom' | 'right' | 'left'
  panelSize: number
  zIndex: number
  onToggleRecording: () => void
  onClose: () => void
  onCommitAction?: (commit: Commit, action: 'accept' | 'reject') => void
}

export function TimelinePanel({
  store, state, recording, position, panelSize, zIndex,
  onToggleRecording, onClose, onCommitAction,
}: PanelProps) {
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [expandedMutation, setExpandedMutation] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCommitCount = useRef(0)

  // Auto-scroll on new commits
  useEffect(() => {
    if (state.commits.length > prevCommitCount.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
    prevCommitCount.current = state.commits.length
  }, [state.commits.length])

  const posStyles: React.CSSProperties = position === 'right'
    ? { right: 0, top: 0, bottom: 0, width: panelSize }
    : position === 'left'
    ? { left: 0, top: 0, bottom: 0, width: panelSize }
    : { left: 0, right: 0, bottom: 0, height: panelSize }

  const isHorizontal = position === 'bottom'
  const activeCommit = state.commits.find(c => c.id === selectedCommit)

  const handleCopy = (format: 'markdown' | 'json') => {
    const text = format === 'markdown' ? store.exportMarkdown() : store.exportJSON()
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div data-rewind-ui style={{
      position: 'fixed', ...posStyles, zIndex,
      background: C.bg,
      borderTop: position === 'bottom' ? `1px solid ${C.border}` : 'none',
      borderLeft: position === 'right' ? `1px solid ${C.border}` : 'none',
      borderRight: position === 'left' ? `1px solid ${C.border}` : 'none',
      display: 'flex',
      flexDirection: isHorizontal ? 'column' : 'column',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      fontSize: 11,
      color: C.text,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: `1px solid ${C.border}`,
        background: 'rgba(0,0,0,.2)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.bright }}>REWIND</span>
          <RecBtn recording={recording} onClick={onToggleRecording} />
          <span style={{ color: C.dim, fontSize: 9 }}>
            {state.stats.total} changes
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatBadge label="pending" count={state.stats.pending} color={C.pending} />
          <StatBadge label="accepted" count={state.stats.accepted} color={C.added} />
          <StatBadge label="rejected" count={state.stats.rejected} color={C.removed} />
          <Sep />
          <SmallBtn label={copied ? 'Copied!' : 'Export'} onClick={() => handleCopy('markdown')} active={copied} />
          <SmallBtn label="Accept all" onClick={() => store.acceptAll()} />
          <SmallBtn label="Clear" onClick={() => { store.clear(); setSelectedCommit(null) }} />
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.dim,
            cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1,
          }}>×</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isHorizontal ? 'row' : 'column', overflow: 'hidden' }}>
        {/* Timeline strip */}
        <div ref={scrollRef} style={{
          display: 'flex', gap: 4, padding: '8px 12px',
          flexShrink: 0,
          borderBottom: isHorizontal ? 'none' : `1px solid ${C.border}`,
          borderRight: isHorizontal ? `1px solid ${C.border}` : 'none',
          minWidth: isHorizontal ? 0 : undefined,
          maxWidth: isHorizontal ? '45%' : undefined,
          flexDirection: isHorizontal ? 'column' : 'row',
          overflowY: isHorizontal ? 'auto' : 'hidden',
          overflowX: isHorizontal ? 'hidden' : 'auto',
        }}>
          {state.commits.length === 0 ? (
            <div style={{ color: C.dim, padding: 12, fontSize: 10, whiteSpace: 'nowrap' }}>
              {recording ? '● Watching for DOM changes...' : 'Press record to start tracking'}
            </div>
          ) : (
            state.commits.map(commit => (
              <CommitChip
                key={commit.id}
                commit={commit}
                selected={selectedCommit === commit.id}
                onClick={() => setSelectedCommit(selectedCommit === commit.id ? null : commit.id)}
                isHorizontal={isHorizontal}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {!activeCommit ? (
            <div style={{ color: C.dim, textAlign: 'center', paddingTop: 24, fontSize: 10 }}>
              {state.commits.length > 0 ? 'Select a commit to inspect' : ''}
            </div>
          ) : (
            <CommitDetail
              commit={activeCommit}
              expandedMutation={expandedMutation}
              onToggleMutation={(id) => setExpandedMutation(expandedMutation === id ? null : id)}
              onAcceptCommit={() => { store.acceptCommit(activeCommit.id); onCommitAction?.(activeCommit, 'accept') }}
              onRejectCommit={() => { store.rejectCommit(activeCommit.id); onCommitAction?.(activeCommit, 'reject') }}
              onAcceptMutation={(id) => store.acceptMutation(id)}
              onRejectMutation={(id) => store.rejectMutation(id)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function RecBtn({ recording, onClick }: { recording: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 18, height: 18, borderRadius: '50%',
      background: recording ? 'rgba(248,113,113,.15)' : C.card,
      border: `1px solid ${recording ? C.removed : C.border}`,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all .2s',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: recording ? C.removed : C.dim,
        boxShadow: recording ? `0 0 6px ${C.removed}` : 'none',
        animation: recording ? 'rewind-pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      <style>{`@keyframes rewind-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </button>
  )
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 3,
      fontSize: 8, color, textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, opacity: .5 }} />
      {count}
    </span>
  )
}

function Sep() {
  return <span style={{ width: 1, height: 14, background: C.border, flexShrink: 0 }} />
}

function SmallBtn({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 8px', background: active ? 'rgba(74,222,128,.08)' : 'transparent',
      border: `1px solid ${active ? C.added : C.border}`,
      borderRadius: 4, color: active ? C.added : C.dim,
      fontSize: 8, fontFamily: 'inherit', cursor: 'pointer',
      textTransform: 'uppercase', letterSpacing: '.04em', transition: 'all .15s',
    }}>{label}</button>
  )
}

function CommitChip({ commit, selected, onClick, isHorizontal }: {
  commit: Commit; selected: boolean; onClick: () => void; isHorizontal: boolean
}) {
  const statusColor = commit.status === 'accepted' ? C.added
    : commit.status === 'rejected' ? C.removed
    : commit.status === 'partial' ? C.changed : C.pending

  return (
    <button onClick={onClick} style={{
      padding: '6px 10px',
      background: selected ? `${statusColor}10` : C.card,
      border: `1px solid ${selected ? statusColor : C.border}`,
      borderRadius: 6, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 2,
      minWidth: isHorizontal ? undefined : 120,
      textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{
          fontSize: 9, color: selected ? C.bright : C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140,
        }}>{commit.label}</span>
      </div>
      <div style={{ fontSize: 8, color: C.dim, paddingLeft: 9 }}>
        {new Date(commit.timestamp).toLocaleTimeString()} · {commit.mutations.length} mutation{commit.mutations.length > 1 ? 's' : ''}
      </div>
    </button>
  )
}

function CommitDetail({ commit, expandedMutation, onToggleMutation, onAcceptCommit, onRejectCommit, onAcceptMutation, onRejectMutation }: {
  commit: Commit
  expandedMutation: string | null
  onToggleMutation: (id: string) => void
  onAcceptCommit: () => void
  onRejectCommit: () => void
  onAcceptMutation: (id: string) => void
  onRejectMutation: (id: string) => void
}) {
  const statusColor = commit.status === 'accepted' ? C.added
    : commit.status === 'rejected' ? C.removed
    : commit.status === 'partial' ? C.changed : C.pending

  return (
    <>
      {/* Commit header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
          <span style={{ color: C.bright, fontSize: 11, fontWeight: 500 }}>{commit.label}</span>
          <span style={{ color: C.dim, fontSize: 8 }}>{commit.summary}</span>
        </div>
        {commit.status === 'pending' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <ActionBtn label="✓ Accept all" color={C.added} onClick={onAcceptCommit} />
            <ActionBtn label="✗ Reject all" color={C.removed} onClick={onRejectCommit} />
          </div>
        )}
      </div>

      {/* Mutations */}
      {commit.mutations.map(m => (
        <MutationRow
          key={m.id}
          mutation={m}
          expanded={expandedMutation === m.id}
          onToggle={() => onToggleMutation(m.id)}
          onAccept={() => onAcceptMutation(m.id)}
          onReject={() => onRejectMutation(m.id)}
        />
      ))}
    </>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 8px', background: `${color}10`,
      border: `1px solid ${color}30`, borderRadius: 4,
      color, fontSize: 8, fontFamily: 'inherit',
      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.04em',
    }}>{label}</button>
  )
}

function MutationRow({ mutation: m, expanded, onToggle, onAccept, onReject }: {
  mutation: TrackedMutation; expanded: boolean
  onToggle: () => void; onAccept: () => void; onReject: () => void
}) {
  const kindColor = m.kind === 'style' ? C.changed
    : m.kind === 'attribute' ? C.accent
    : m.kind === 'text' ? C.added
    : C.pending

  const statusIcon = m.status === 'accepted' ? '✓'
    : m.status === 'rejected' ? '✗' : '○'

  const statusColor = m.status === 'accepted' ? C.added
    : m.status === 'rejected' ? C.removed : C.dim

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${expanded ? C.border2 : C.border}`,
      borderRadius: 6, marginBottom: 4, overflow: 'hidden',
    }}>
      {/* Row header */}
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px', cursor: 'pointer',
      }}>
        <span style={{ color: statusColor, fontSize: 9, flexShrink: 0 }}>{statusIcon}</span>
        <span style={{
          background: `${kindColor}18`, color: kindColor,
          padding: '1px 5px', borderRadius: 3,
          fontSize: 7, textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0,
        }}>{m.kind}</span>
        <span style={{ color: C.bright, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.shortSelector}
        </span>
        {m.attributeName && <span style={{ color: C.dim, fontSize: 9 }}>.{m.attributeName}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, flexShrink: 0 }}>
          {m.status === 'pending' && (
            <>
              <MicroBtn label="✓" color={C.added} onClick={(e) => { e.stopPropagation(); onAccept() }} />
              <MicroBtn label="✗" color={C.removed} onClick={(e) => { e.stopPropagation(); onReject() }} />
            </>
          )}
        </div>
      </div>

      {/* Expanded diff */}
      {expanded && (
        <div style={{ padding: '0 8px 8px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 6, marginBottom: 4 }}>
            {m.selector}
          </div>

          {m.before !== null && (
            <DiffLine prefix="−" text={m.before} color={C.removed} bg={C.removedBg} />
          )}
          {m.after !== null && (
            <DiffLine prefix="+" text={m.after} color={C.added} bg={C.addedBg} />
          )}

          {m.addedNodes.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 8, color: C.dim }}>Added:</span>
              {m.addedNodes.map((n, i) => (
                <DiffLine key={i} prefix="+" text={n} color={C.added} bg={C.addedBg} />
              ))}
            </div>
          )}
          {m.removedNodes.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 8, color: C.dim }}>Removed:</span>
              {m.removedNodes.map((n, i) => (
                <DiffLine key={i} prefix="−" text={n} color={C.removed} bg={C.removedBg} />
              ))}
            </div>
          )}

          {m.bounds && (
            <div style={{ fontSize: 8, color: C.dim, marginTop: 6 }}>
              {m.bounds.w}×{m.bounds.h} at ({m.bounds.x}, {m.bounds.y})
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DiffLine({ prefix, text, color, bg }: { prefix: string; text: string; color: string; bg: string }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '2px 6px', marginTop: 2,
      background: bg, borderRadius: 3, fontSize: 9, lineHeight: 1.5,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{ color, fontWeight: 600, flexShrink: 0 }}>{prefix}</span>
      <span style={{ color, wordBreak: 'break-all' }}>{text?.slice(0, 300)}</span>
    </div>
  )
}

function MicroBtn({ label, color, onClick }: { label: string; color: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} style={{
      width: 18, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 3,
      color, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  )
}

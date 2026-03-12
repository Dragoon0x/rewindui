import React, { useEffect, useState } from 'react'
import type { RewindProps } from '../types'
import { REWIND_COLORS as C } from '../types'
import { getStore } from '../core/store'
import { useRewind } from '../hooks/useRewind'

const FONT = "'SF Mono','Cascadia Code','Consolas',monospace"

export function Rewind({
  recording = true,
  position = 'bottom',
  panelSize = 280,
  shortcut = 'Alt+R',
  commitWindow = 500,
  maxCommits = 200,
  ignoreSelectors = ['[data-rewind-ui]'],
  showOverlays = true,
  zIndex = 99999,
  persist = false,
  storageKey = 'rewind-session',
  onCommitAction,
  onRecordingChange,
}: RewindProps) {
  const [visible, setVisible] = useState(false)
  const rw = useRewind({
    ignoreSelectors, commitWindow, maxCommits,
    persistKey: persist ? storageKey : undefined,
  })

  // Auto-start recording
  useEffect(() => {
    if (recording) rw.startRecording()
    return () => rw.stopRecording()
  }, [recording])

  // Keyboard shortcut
  useEffect(() => {
    const parts = shortcut.split('+').map(s => s.trim().toLowerCase())
    const key = parts[parts.length - 1]
    const alt = parts.includes('alt')
    const ctrl = parts.includes('ctrl')

    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key && e.altKey === alt && e.ctrlKey === ctrl) {
        e.preventDefault()
        setVisible(v => !v)
      }
      if (e.key === 'Escape' && visible) setVisible(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcut, visible])

  if (!visible) {
    return (
      <div data-rewind-ui style={{ position: 'fixed', bottom: 16, right: 16, zIndex }}>
        <button
          onClick={() => setVisible(true)}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.border2}`,
            background: C.bg, color: rw.isRecording ? C.red : C.accent,
            fontFamily: FONT, fontSize: 10, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,.4)',
          }}
          title={`Toggle Rewind (${shortcut})`}
          aria-label="Toggle Rewind panel"
        >
          {rw.isRecording ? '⏺' : '⟲'}
        </button>
      </div>
    )
  }

  const stats = rw.stats
  const isBottom = position === 'bottom'

  return (
    <div data-rewind-ui style={{
      position: 'fixed', zIndex,
      [isBottom ? 'bottom' : 'top']: 0,
      [isBottom ? 'left' : (position === 'left' ? 'left' : 'right')]: 0,
      [isBottom ? 'right' : 'top']: isBottom ? 0 : undefined,
      [isBottom ? 'height' : 'width']: panelSize,
      [isBottom ? 'width' : 'height']: isBottom ? '100%' : '100%',
      background: C.bg, borderTop: isBottom ? `1px solid ${C.border}` : undefined,
      borderLeft: position === 'right' ? `1px solid ${C.border}` : undefined,
      borderRight: position === 'left' ? `1px solid ${C.border}` : undefined,
      fontFamily: FONT, fontSize: 11, color: C.text,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${C.border}`, gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: C.bright, fontSize: 10, letterSpacing: '.08em' }}>REWIND</span>
        <span style={{ fontSize: 8, color: rw.isRecording ? C.red : C.dim }}>{rw.isRecording ? '● REC' : '○ PAUSED'}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: C.dim }}>{stats.total} commits</span>
        <span style={{ fontSize: 9, color: C.green }}>{stats.accepted}✓</span>
        <span style={{ fontSize: 9, color: C.red }}>{stats.rejected}✗</span>
        <span style={{ fontSize: 9, color: C.yellow }}>{stats.pending}○</span>
        <button onClick={() => rw.acceptAll()} style={btnStyle(C.green)} title="Accept all">✓ all</button>
        <button onClick={() => { navigator.clipboard.writeText(rw.exportMarkdown()) }} style={btnStyle(C.accent)} title="Copy markdown">copy</button>
        <button onClick={() => setVisible(false)} style={btnStyle(C.dim)} title="Close">✕</button>
      </div>

      {/* Commits */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {rw.commits.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: C.dim, fontSize: 10 }}>
            {rw.isRecording ? 'Watching for DOM changes...' : 'Press record to start'}
          </div>
        )}
        {[...rw.commits].reverse().map(commit => (
          <div key={commit.id} style={{
            padding: '8px 10px', marginBottom: 4, borderRadius: 6,
            background: commit.status === 'accepted' ? C.greenBg : commit.status === 'rejected' ? C.redBg : C.card,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: commit.status === 'accepted' ? C.green : commit.status === 'rejected' ? C.red : C.bright,
              }}>
                {commit.status === 'accepted' ? '✓' : commit.status === 'rejected' ? '✗' : '○'}
              </span>
              <span style={{ fontSize: 10, color: C.bright, flex: 1 }}>{commit.label}</span>
              <span style={{ fontSize: 8, color: C.dim }}>{new Date(commit.timestamp).toLocaleTimeString()}</span>
              {commit.status === 'pending' && (
                <>
                  <button onClick={() => { rw.acceptCommit(commit.id); onCommitAction?.(commit.id, 'accept') }} style={btnStyle(C.green)} title="Accept">✓</button>
                  <button onClick={() => { rw.rejectCommit(commit.id); onCommitAction?.(commit.id, 'reject') }} style={btnStyle(C.red)} title="Reject">✗</button>
                </>
              )}
            </div>
            {commit.annotation && (
              <div style={{ fontSize: 9, color: C.yellow, marginTop: 4, fontStyle: 'italic' }}>💬 {commit.annotation}</div>
            )}
            {commit.mutations.length > 1 && (
              <div style={{ fontSize: 8, color: C.dim, marginTop: 3 }}>{commit.mutations.length} mutations · impact {Math.round(commit.impact * 100)}%</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '2px 6px', border: `1px solid ${color}40`, borderRadius: 3,
    background: 'transparent', color, fontSize: 8, fontFamily: "'SF Mono',monospace",
    cursor: 'pointer', letterSpacing: '.04em',
  }
}

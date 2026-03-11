import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import type { RewindProps } from '../types'
import { DOMObserver } from '../core/observer'
import { TimelineStore } from '../core/timeline'
import { TimelinePanel } from './Panel'

// Font injection
let fontInjected = false
function injectFont() {
  if (fontInjected || typeof document === 'undefined') return
  fontInjected = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap'
  document.head.appendChild(link)
}

// Shared instances
let globalStore: TimelineStore | null = null
let globalObserver: DOMObserver | null = null

export function getRewindStore(): TimelineStore | null { return globalStore }

/**
 * <Rewind />
 *
 * Visual changelog for AI agent edits.
 * Tracks every DOM mutation in real-time.
 * Timeline scrubber, before/after diffs, accept/reject.
 *
 * ```jsx
 * <Rewind />
 * ```
 */
export function Rewind({
  recording: initialRecording = true,
  position = 'bottom',
  panelSize = 280,
  shortcut = 'Alt+R',
  commitWindow = 500,
  maxCommits = 200,
  ignoreSelectors = ['[data-rewind-ui]'],
  zIndex = 99999,
  onCommitAction,
  onRecordingChange,
}: RewindProps) {
  const [visible, setVisible] = useState(true)
  const [recording, setRecording] = useState(initialRecording)
  const storeRef = useRef<TimelineStore | null>(null)
  const observerRef = useRef<DOMObserver | null>(null)

  // Initialize store and observer
  if (!storeRef.current) {
    storeRef.current = new TimelineStore(commitWindow, maxCommits)
    globalStore = storeRef.current
  }

  const store = storeRef.current!

  // Subscribe to store updates
  const version = useSyncExternalStore(store.subscribe, store.getSnapshot)

  useEffect(() => { injectFont() }, [])

  // Observer lifecycle
  useEffect(() => {
    const obs = new DOMObserver(
      (mutation) => store.addMutation(mutation),
      ignoreSelectors
    )
    observerRef.current = obs
    globalObserver = obs

    if (recording) obs.start()

    return () => {
      obs.stop()
      globalObserver = null
    }
  }, []) // eslint-disable-line

  // Toggle recording
  const toggleRecording = useCallback(() => {
    setRecording(prev => {
      const next = !prev
      if (next) {
        observerRef.current?.start()
      } else {
        observerRef.current?.stop()
        store.flush()
      }
      onRecordingChange?.(next)
      return next
    })
  }, [store, onRecordingChange])

  // Keyboard shortcut
  useEffect(() => {
    const parts = shortcut.split('+').map(s => s.trim().toLowerCase())
    const key = parts[parts.length - 1]
    const alt = parts.includes('alt')
    const ctrl = parts.includes('ctrl') || parts.includes('control')
    const shift = parts.includes('shift')
    const meta = parts.includes('meta') || parts.includes('cmd')

    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === key &&
        e.altKey === alt &&
        e.ctrlKey === ctrl &&
        e.shiftKey === shift &&
        e.metaKey === meta
      ) {
        e.preventDefault()
        setVisible(prev => !prev)
      }
      if (e.key === 'Escape' && visible) {
        setVisible(false)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [shortcut, visible])

  // Version is used to trigger re-render
  void version

  if (!visible) {
    return (
      <div data-rewind-ui style={{ position: 'fixed', bottom: 16, left: 16, zIndex }}>
        <button
          onClick={() => setVisible(true)}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#0a0a0e', border: `1px solid #1c1c24`,
            color: recording ? '#f87171' : '#505060',
            fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,.4)', transition: 'all .2s',
            fontFamily: "'JetBrains Mono', monospace",
          }}
          title={`Toggle Rewind (${shortcut})`}
        >
          {recording ? '●' : '◀'}
        </button>
      </div>
    )
  }

  return (
    <TimelinePanel
      store={store}
      state={store.getState()}
      recording={recording}
      position={position}
      panelSize={panelSize}
      zIndex={zIndex}
      onToggleRecording={toggleRecording}
      onClose={() => setVisible(false)}
      onCommitAction={onCommitAction}
    />
  )
}

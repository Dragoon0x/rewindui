// ═══════════════════════════════════════════
// REWINDUI v1 — Types
// ═══════════════════════════════════════════

export type MutationType = 'style' | 'attribute' | 'text' | 'dom-add' | 'dom-remove'
export type CommitStatus = 'pending' | 'accepted' | 'rejected'

export interface TrackedMutation {
  id: string
  type: MutationType
  selector: string
  shortSelector: string
  tag: string
  attributeName: string | null
  oldValue: string | null
  newValue: string | null
  timestamp: number
  bounds: { x: number; y: number; w: number; h: number } | null
  status: CommitStatus
  undoData: UndoData | null
  /** Impact score 0-1: how much viewport area was affected */
  impact: number
}

export interface UndoData {
  type: 'attribute' | 'text' | 'add' | 'remove'
  selector: string
  attributeName?: string
  oldValue?: string | null
  removedHTML?: string
  addedSelector?: string
  parentSelector?: string
}

export interface Commit {
  id: string
  mutations: TrackedMutation[]
  timestamp: number
  status: CommitStatus
  /** Auto-generated human-readable label */
  label: string
  /** User annotation */
  annotation: string | null
  /** Impact score: aggregate of mutation impacts */
  impact: number
}

export interface Snapshot {
  id: string
  timestamp: number
  label: string
  /** Serialized HTML of the observed root */
  html: string
}

export interface TimelineState {
  commits: Commit[]
  snapshots: Snapshot[]
  recording: boolean
  /** Index of the currently viewed commit (-1 = latest) */
  cursor: number
}

export interface TimelineStats {
  total: number
  pending: number
  accepted: number
  rejected: number
  styleChanges: number
  textChanges: number
  attributeChanges: number
  domChanges: number
  totalImpact: number
  duration: number
}

export interface RewindProps {
  /** Start recording on mount. Default: true */
  recording?: boolean
  /** Panel position. Default: 'bottom' */
  position?: 'bottom' | 'right' | 'left'
  /** Panel height/width. Default: 280 */
  panelSize?: number
  /** Keyboard toggle. Default: 'Alt+R' */
  shortcut?: string
  /** Group mutations within this ms. Default: 500 */
  commitWindow?: number
  /** Max commits. Default: 200 */
  maxCommits?: number
  /** Selectors to ignore. Default: ['[data-rewind-ui]'] */
  ignoreSelectors?: string[]
  /** Show visual overlays on changed elements. Default: true */
  showOverlays?: boolean
  /** Z-index. Default: 99999 */
  zIndex?: number
  /** Persist session in localStorage. Default: false */
  persist?: boolean
  /** Storage key. Default: 'rewind-session' */
  storageKey?: string
  /** Callback on commit action */
  onCommitAction?: (commitId: string, action: 'accept' | 'reject') => void
  /** Callback on recording toggle */
  onRecordingChange?: (recording: boolean) => void
}

// ─── Colors ───

export const REWIND_COLORS = {
  bg: '#0a0a0e',
  card: '#111116',
  card2: '#161620',
  border: '#1c1c24',
  border2: '#252530',
  dim: '#505060',
  text: '#909098',
  bright: '#e0e0e8',
  white: '#f0f0f8',
  accent: '#818cf8',
  accentBg: 'rgba(129, 140, 248, 0.08)',
  green: '#4ade80',
  greenBg: 'rgba(74, 222, 128, 0.06)',
  red: '#f87171',
  redBg: 'rgba(248, 113, 113, 0.06)',
  yellow: '#fbbf24',
  yellowBg: 'rgba(251, 191, 36, 0.06)',
  blue: '#60a5fa',
  blueBg: 'rgba(96, 165, 250, 0.06)',
} as const

// ─── Mutation Record ─────────────────────────────────────────

export type MutationKind = 'attribute' | 'childList' | 'text' | 'style'

export interface TrackedMutation {
  id: string
  kind: MutationKind
  timestamp: number
  /** CSS selector for the changed element */
  selector: string
  /** Short readable selector */
  shortSelector: string
  /** Element tag name */
  tag: string
  /** What attribute changed (for attribute mutations) */
  attributeName: string | null
  /** Value before the change */
  before: string | null
  /** Value after the change */
  after: string | null
  /** For childList: added node summaries */
  addedNodes: string[]
  /** For childList: removed node summaries */
  removedNodes: string[]
  /** Bounding rect at time of mutation */
  bounds: { x: number; y: number; w: number; h: number } | null
  /** Whether this mutation has been accepted, rejected, or is pending */
  status: 'pending' | 'accepted' | 'rejected'
  /** Whether the reject/undo was applied */
  reverted: boolean
  /** Reference to the actual element (may be null if removed) */
  element: WeakRef<Element> | null
  /** Serialized undo data */
  undoData: UndoData | null
}

export interface UndoData {
  kind: MutationKind
  selector: string
  attributeName: string | null
  oldValue: string | null
  /** For childList: HTML of removed nodes to re-add */
  removedHTML: string[]
  /** For childList: selectors of added nodes to remove */
  addedSelectors: string[]
}

// ─── Commit (grouped mutations) ──────────────────────────────

export interface Commit {
  id: string
  timestamp: number
  /** Human-readable label */
  label: string
  /** All mutations in this commit */
  mutations: TrackedMutation[]
  /** Auto-generated summary */
  summary: string
  /** Status */
  status: 'pending' | 'accepted' | 'rejected' | 'partial'
}

// ─── Timeline State ──────────────────────────────────────────

export interface TimelineState {
  commits: Commit[]
  recording: boolean
  selectedCommitId: string | null
  selectedMutationId: string | null
  stats: {
    total: number
    pending: number
    accepted: number
    rejected: number
  }
}

// ─── Component Props ─────────────────────────────────────────

export interface RewindProps {
  /** Start recording on mount. Default: true */
  recording?: boolean
  /** Panel position. Default: 'bottom' */
  position?: 'bottom' | 'right' | 'left'
  /** Panel height (for bottom) or width (for sides). Default: 280 */
  panelSize?: number
  /** Keyboard shortcut to toggle. Default: 'Alt+R' */
  shortcut?: string
  /** Group mutations within this ms window into one commit. Default: 500 */
  commitWindow?: number
  /** Max commits to keep. Default: 200 */
  maxCommits?: number
  /** Ignore mutations inside elements matching these selectors. Default: ['[data-rewind-ui]'] */
  ignoreSelectors?: string[]
  /** Z-index. Default: 99999 */
  zIndex?: number
  /** Callback when commit is accepted/rejected */
  onCommitAction?: (commit: Commit, action: 'accept' | 'reject') => void
  /** Callback when recording state changes */
  onRecordingChange?: (recording: boolean) => void
}

// ─── Colors ──────────────────────────────────────────────────

export const REWIND_COLORS = {
  bg: '#0a0a0e',
  card: '#111116',
  border: '#1c1c24',
  border2: '#252530',
  dim: '#505060',
  text: '#909098',
  bright: '#e0e0e8',
  added: '#4ade80',
  addedBg: 'rgba(74, 222, 128, 0.08)',
  removed: '#f87171',
  removedBg: 'rgba(248, 113, 113, 0.08)',
  changed: '#60a5fa',
  changedBg: 'rgba(96, 165, 250, 0.08)',
  pending: '#fbbf24',
  accent: '#818cf8',
} as const

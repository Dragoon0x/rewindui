import { useSyncExternalStore, useCallback } from 'react'
import { getRewindStore } from '../components/Rewind'
import type { TimelineState, Commit } from '../types'

/**
 * useRewind
 *
 * Programmatic access to the rewind timeline.
 *
 * ```tsx
 * const { state, acceptCommit, rejectCommit, exportMarkdown } = useRewind()
 * ```
 */
export function useRewind() {
  const store = getRewindStore()

  const version = useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    store?.getSnapshot ?? (() => 0)
  )

  // Force usage of version to keep subscription alive
  void version

  const state: TimelineState = store?.getState() ?? {
    commits: [],
    recording: false,
    selectedCommitId: null,
    selectedMutationId: null,
    stats: { total: 0, pending: 0, accepted: 0, rejected: 0 },
  }

  const acceptCommit = useCallback((commitId: string) => {
    store?.acceptCommit(commitId)
  }, [store])

  const rejectCommit = useCallback((commitId: string) => {
    store?.rejectCommit(commitId)
  }, [store])

  const acceptMutation = useCallback((mutationId: string) => {
    store?.acceptMutation(mutationId)
  }, [store])

  const rejectMutation = useCallback((mutationId: string) => {
    store?.rejectMutation(mutationId)
  }, [store])

  const acceptAll = useCallback(() => {
    store?.acceptAll()
  }, [store])

  const clear = useCallback(() => {
    store?.clear()
  }, [store])

  const exportMarkdown = useCallback((): string => {
    return store?.exportMarkdown() ?? ''
  }, [store])

  const exportJSON = useCallback((): string => {
    return store?.exportJSON() ?? ''
  }, [store])

  return {
    state,
    commits: state.commits,
    stats: state.stats,
    acceptCommit,
    rejectCommit,
    acceptMutation,
    rejectMutation,
    acceptAll,
    clear,
    exportMarkdown,
    exportJSON,
  }
}

import { useState, useEffect, useSyncExternalStore } from 'react'
import { getStore } from '../core/store'
import type { TimelineState, TimelineStats, Commit } from '../types'

export function useRewind(opts?: { ignoreSelectors?: string[]; commitWindow?: number; maxCommits?: number; persistKey?: string }) {
  const store = getStore(opts)
  const version = useSyncExternalStore(store.subscribe.bind(store), store.getSnapshot.bind(store))
  void version

  return {
    state: store.getState(),
    commits: store.getCommits(),
    stats: store.getStats(),
    isRecording: store.isRecording(),
    startRecording: () => store.startRecording(),
    stopRecording: () => store.stopRecording(),
    acceptCommit: (id: string) => store.acceptCommit(id),
    rejectCommit: (id: string) => store.rejectCommit(id),
    acceptMutation: (cId: string, mId: string) => store.acceptMutation(cId, mId),
    rejectMutation: (cId: string, mId: string) => store.rejectMutation(cId, mId),
    acceptAll: () => store.acceptAll(),
    rejectAll: () => store.rejectAll(),
    acceptByType: (type: string) => store.acceptByType(type),
    rejectByType: (type: string) => store.rejectByType(type),
    annotate: (id: string, text: string) => store.annotate(id, text),
    takeSnapshot: (label?: string) => store.takeSnapshot(label),
    filterByType: (type: string) => store.filterByType(type),
    filterByStatus: (status: any) => store.filterByStatus(status),
    search: (query: string) => store.search(query),
    exportMarkdown: () => store.exportMarkdown(),
    exportJSON: () => store.exportJSON(),
    exportAgentBlock: () => store.exportAgentBlock(),
    clear: () => store.clear(),
  }
}

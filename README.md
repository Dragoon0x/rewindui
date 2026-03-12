# rewindui

> Experimental software. DYOR. Use at your own risk.

Visual changelog for AI agent edits. Git blame for the visual layer.

```
npm install userewindui
```

Your AI agent just rewrote half a component. What actually changed? What broke? Rewind watches every DOM mutation in real-time, groups them into smart commits, shows before/after diffs, and lets you accept or reject each change. Reject reverts the DOM. Accept marks it done. Export as markdown, JSON, or agent instructions.

## Quick start

```jsx
import { Rewind } from 'userewindui'

function App() {
  return (
    <>
      <YourApp />
      <Rewind />
    </>
  )
}
```

Press `Alt+R` to toggle the panel.

## What's new in v1

**Smart commit labels.** Rewind auto-generates human-readable descriptions. "Color change on div.hero", "Expanded text in h1", "Updated source on img" instead of raw mutation data.

**Impact scoring.** Every mutation gets a 0-1 impact score based on viewport area affected. Commits that change large elements rank higher.

**Annotations.** Add notes to any commit explaining why you accepted or rejected it. Notes are included in exports.

**Batch operations.** Accept all style changes at once. Reject all text changes. Filter by type, status, or search.

**Session persistence.** Opt-in localStorage persistence. Resume your review after a page refresh.

**DOM snapshots.** Capture the full page state at any point. Compare between snapshots.

**Agent export format.** New `<dom_changes>` export block groups approved and rejected changes for your AI agent.

**Search.** Find changes by selector, value, label, or annotation text.

## What gets tracked

**Style** changes to inline styles. Colors, spacing, layout, transforms.

**Attribute** changes. Classes, data attributes, ARIA states, src, href.

**Text** changes. Content edits to headings, paragraphs, button labels.

**DOM** changes. Added and removed elements. Full HTML captured for undo.

## Smart grouping

Mutations within a 500ms window become one commit. Style change + class change + text edit = one logical unit. Each commit gets an auto-generated label.

## Accept and reject

Every mutation has accept/reject buttons. Reject attempts to revert the change in the live DOM by restoring the old attribute value, old text content, or re-adding removed nodes. Accept marks the change as approved. You can act on entire commits or individual mutations. Partial accepts are supported.

Undo is best-effort. If the element has been removed from the DOM since the mutation was recorded, Rewind tries to find it by selector. If the element can't be found, the mutation is marked as rejected but not reverted.

## Export

One click exports the full session as structured markdown or JSON. The output includes every commit, every mutation with selectors, before/after values, and accept/reject status.

```
## ✓ Style: button.primary (2:14:32 PM)

### ✓ `button.primary` — style
- **Before:** `background-color: #3b82f6; padding: 8px 16px`
- **After:** `background-color: #6366f1; padding: 12px 24px`
- **Selector:** `.hero > .cta-row > button.primary`
```

Paste the export into your agent to explain what was approved and what needs to be redone.

## Programmatic API

```jsx
import { useRewind } from 'userewindui'

const {
  state, commits, stats, isRecording,
  startRecording, stopRecording,
  acceptCommit, rejectCommit,
  acceptMutation, rejectMutation,
  acceptAll, rejectAll,
  acceptByType, rejectByType,
  annotate, takeSnapshot,
  filterByType, filterByStatus, search,
  exportMarkdown, exportJSON, exportAgentBlock,
  clear,
} = useRewind()
```

## Props

| Prop | Default | Description |
| --- | --- | --- |
| `recording` | `true` | Start recording on mount |
| `position` | `'bottom'` | Panel: bottom, right, or left |
| `panelSize` | `280` | Panel height/width in px |
| `shortcut` | `'Alt+R'` | Keyboard toggle |
| `commitWindow` | `500` | Group mutations within this ms |
| `maxCommits` | `200` | Max commits |
| `ignoreSelectors` | `['[data-rewind-ui]']` | Selectors to ignore |
| `showOverlays` | `true` | Visual overlays on changed elements |
| `zIndex` | `99999` | Z-index |
| `persist` | `false` | Save session to localStorage |
| `storageKey` | `'rewind-session'` | Storage key |
| `onCommitAction` | - | Callback on accept/reject |
| `onRecordingChange` | - | Callback on toggle |

## Disclaimer

Experimental, open-source software provided as-is. No warranties, no guarantees. Use at your own risk. DYOR. The author assumes no liability for any issues arising from the use of this software.

## License

MIT. Built by [0xDragoon](https://github.com/dragoon0x).

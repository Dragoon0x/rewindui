# rewindui

> Experimental software. DYOR. Use at your own risk.

Visual changelog for AI agent edits. Git blame for the visual layer.

```
npm install rewindui
```

Your AI agent just rewrote half a component. What actually changed? What broke? Rewind watches every DOM mutation in real-time, groups them into commits, shows before/after diffs, and lets you accept or reject each change individually. Reject reverts the DOM. Accept marks it done. Export the full changelog as markdown for your agent.

## Quick start

```jsx
import { Rewind } from 'rewindui'

function App() {
  return (
    <>
      <YourApp />
      <Rewind />
    </>
  )
}
```

Rewind starts recording immediately. A timeline panel docks to the bottom of your viewport. Every DOM mutation appears as a commit with before/after diffs and accept/reject controls.

Press `Alt+R` to toggle the panel.

## What gets tracked

Four mutation types cover everything:

**Style** changes to inline styles. Colors, spacing, layout, transforms, opacity. Before and after values are captured as the full style string.

**Attribute** changes. Class additions/removals, data attributes, aria states, src, href, any HTML attribute. The old and new values are stored.

**Text** changes. Content edits to headings, paragraphs, button labels, any text node. Shows the exact string diff.

**DOM** changes. Added and removed elements. New sections, deleted components, restructured trees. Captures the selector of added nodes and the HTML of removed nodes for undo.

## Smart grouping

Mutations within a 500ms window are automatically grouped into a single commit. When an agent updates a component, the style change, class change, and text edit all appear as one logical unit. Each commit gets an auto-generated label based on what changed and where.

## Accept and reject

Every mutation has accept/reject buttons. Reject attempts to revert the change in the live DOM by restoring the old attribute value, old text content, or re-adding removed nodes. Accept marks the change as approved. You can act on entire commits or individual mutations. Partial accepts are supported.

Undo is best-effort. If the element has been removed from the DOM since the mutation was recorded, Rewind tries to find it by selector. If the element can't be found, the mutation is marked as rejected but not reverted.

## Export

One click exports the full session as structured markdown or JSON. The output includes every commit, every mutation with selectors, before/after values, and accept/reject status.

```markdown
## ✓ Style: button.primary (2:14:32 PM)

### ✓ `button.primary` — style
- **Before:** `background-color: #3b82f6; padding: 8px 16px`
- **After:** `background-color: #6366f1; padding: 12px 24px`
- **Selector:** `.hero > .cta-row > button.primary`
```

Paste the export into your agent to explain what was approved and what needs to be redone.

## Programmatic API

```jsx
import { useRewind } from 'rewindui'

const {
  state,        // Full timeline state
  commits,      // Array of commits
  stats,        // { total, pending, accepted, rejected }
  acceptCommit, // (commitId) => void
  rejectCommit, // (commitId) => void — also reverts DOM
  acceptAll,    // () => void
  clear,        // () => void
  exportMarkdown,
  exportJSON,
} = useRewind()
```

## Props

| Prop | Default | Description |
|------|---------|-------------|
| `recording` | `true` | Start recording on mount |
| `position` | `'bottom'` | Panel: bottom, right, or left |
| `panelSize` | `280` | Panel height/width in px |
| `shortcut` | `'Alt+R'` | Keyboard toggle |
| `commitWindow` | `500` | Group mutations within this ms |
| `maxCommits` | `200` | Max commits to keep |
| `ignoreSelectors` | `['[data-rewind-ui]']` | Selectors to ignore |
| `zIndex` | `99999` | Z-index for panel |
| `onCommitAction` | - | Callback on accept/reject |
| `onRecordingChange` | - | Callback on recording toggle |

## How it works

Rewind uses a MutationObserver on `document.body` with full configuration: attributes (with old value), childList, characterData (with old value), and subtree. Every mutation record is processed into a TrackedMutation with a unique CSS selector, before/after values, bounding box, and undo data.

Mutations are buffered and flushed into commits after the commit window (500ms default). The store notifies subscribers via useSyncExternalStore for zero-lag React updates.

Undo data varies by mutation type. For attributes, it stores the old value. For text, the old text content. For childList, it stores the HTML of removed nodes and the selectors of added nodes. On reject, the store walks the undo data in reverse order and attempts to restore the previous state.

The observer ignores its own UI via the `[data-rewind-ui]` selector, and skips script/link/meta elements.

Zero runtime dependencies. Works with React 18+.

## Disclaimer

Experimental, open-source software provided as-is. No warranties, no guarantees. Use at your own risk. DYOR. The author assumes no liability for any issues arising from the use of this software.

## License

MIT. Built by 0xDragoon.

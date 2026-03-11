// ═══════════════════════════════════════════
// REWIND — Tests
// ═══════════════════════════════════════════

const {
  TimelineStore,
  REWIND_COLORS,
} = require('../dist/index.js')

let passed = 0
let failed = 0

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

function assertEq(a, b, msg) {
  assert(a === b, `${msg} (got: ${JSON.stringify(a)}, expected: ${JSON.stringify(b)})`)
}

function makeMutation(overrides = {}) {
  return {
    id: `m_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    kind: 'style',
    timestamp: Date.now(),
    selector: 'div.test',
    shortSelector: 'div.test',
    tag: 'div',
    attributeName: 'style',
    before: 'color: red',
    after: 'color: blue',
    addedNodes: [],
    removedNodes: [],
    bounds: { x: 10, y: 20, w: 100, h: 50 },
    status: 'pending',
    reverted: false,
    element: null,
    undoData: null,
    ...overrides,
  }
}

// ─── TimelineStore: Basic ────────────────

console.log('\n  TimelineStore: Basic')

const store1 = new TimelineStore(50, 100) // 50ms commit window
const state1 = store1.getState()
assertEq(state1.commits.length, 0, 'Starts with 0 commits')
assertEq(state1.stats.total, 0, 'Starts with 0 total mutations')

// ─── TimelineStore: Add Mutations ────────

console.log('\n  TimelineStore: Add Mutations')

const store2 = new TimelineStore(50, 100)
store2.addMutation(makeMutation({ id: 'm1', before: 'color: red', after: 'color: blue' }))
store2.addMutation(makeMutation({ id: 'm2', before: 'padding: 8px', after: 'padding: 16px' }))

// Mutations should be pending until commit window passes
store2.flush()
const state2 = store2.getState()
assertEq(state2.commits.length, 1, 'Mutations grouped into 1 commit after flush')
assertEq(state2.commits[0].mutations.length, 2, 'Commit has 2 mutations')
assertEq(state2.stats.total, 2, 'Stats show 2 total')
assertEq(state2.stats.pending, 2, 'Stats show 2 pending')
assertEq(state2.commits[0].status, 'pending', 'Commit status is pending')

// ─── TimelineStore: Separate Commits ─────

console.log('\n  TimelineStore: Separate Commits')

const store3 = new TimelineStore(10, 100) // very short window
store3.addMutation(makeMutation({ id: 'm3' }))
store3.flush()
store3.addMutation(makeMutation({ id: 'm4' }))
store3.flush()

const state3 = store3.getState()
assertEq(state3.commits.length, 2, 'Two flushes create 2 commits')

// ─── TimelineStore: Accept Commit ────────

console.log('\n  TimelineStore: Accept Commit')

const store4 = new TimelineStore(10, 100)
store4.addMutation(makeMutation({ id: 'ma1' }))
store4.addMutation(makeMutation({ id: 'ma2' }))
store4.flush()

const commitId4 = store4.getCommits()[0].id
store4.acceptCommit(commitId4)

const state4 = store4.getState()
assertEq(state4.commits[0].status, 'accepted', 'Commit status is accepted')
assertEq(state4.commits[0].mutations[0].status, 'accepted', 'First mutation accepted')
assertEq(state4.commits[0].mutations[1].status, 'accepted', 'Second mutation accepted')
assertEq(state4.stats.accepted, 2, 'Stats show 2 accepted')
assertEq(state4.stats.pending, 0, 'Stats show 0 pending')

// ─── TimelineStore: Reject Commit ────────

console.log('\n  TimelineStore: Reject Commit')

const store5 = new TimelineStore(10, 100)
store5.addMutation(makeMutation({ id: 'mr1' }))
store5.flush()

const commitId5 = store5.getCommits()[0].id
store5.rejectCommit(commitId5)

const state5 = store5.getState()
assertEq(state5.commits[0].status, 'rejected', 'Commit status is rejected')
assertEq(state5.commits[0].mutations[0].status, 'rejected', 'Mutation status is rejected')
assertEq(state5.stats.rejected, 1, 'Stats show 1 rejected')
assert(state5.commits[0].mutations[0].reverted === true, 'Mutation marked as reverted')

// ─── TimelineStore: Accept Single Mutation ───

console.log('\n  TimelineStore: Accept/Reject Single Mutation')

const store6 = new TimelineStore(10, 100)
store6.addMutation(makeMutation({ id: 'ms1' }))
store6.addMutation(makeMutation({ id: 'ms2' }))
store6.flush()

store6.acceptMutation('ms1')
const state6a = store6.getState()
assertEq(state6a.commits[0].mutations[0].status, 'accepted', 'First mutation accepted individually')
assertEq(state6a.commits[0].mutations[1].status, 'pending', 'Second mutation still pending')
assertEq(state6a.commits[0].status, 'partial', 'Commit status is partial')

store6.rejectMutation('ms2')
const state6b = store6.getState()
assertEq(state6b.commits[0].mutations[1].status, 'rejected', 'Second mutation rejected')

// ─── TimelineStore: Accept All ───────────

console.log('\n  TimelineStore: Accept All')

const store7 = new TimelineStore(10, 100)
store7.addMutation(makeMutation({ id: 'aa1' }))
store7.flush()
store7.addMutation(makeMutation({ id: 'aa2' }))
store7.flush()

store7.acceptAll()
const state7 = store7.getState()
assertEq(state7.stats.pending, 0, 'No pending after acceptAll')
assertEq(state7.stats.accepted, 2, 'All accepted')

// ─── TimelineStore: Clear ────────────────

console.log('\n  TimelineStore: Clear')

const store8 = new TimelineStore(10, 100)
store8.addMutation(makeMutation({ id: 'cl1' }))
store8.flush()
store8.clear()

const state8 = store8.getState()
assertEq(state8.commits.length, 0, 'Clear removes all commits')
assertEq(state8.stats.total, 0, 'Clear resets stats')

// ─── TimelineStore: Max Commits ──────────

console.log('\n  TimelineStore: Max Commits')

const store9 = new TimelineStore(10, 3) // max 3 commits
for (let i = 0; i < 5; i++) {
  store9.addMutation(makeMutation({ id: `max_${i}` }))
  store9.flush()
}

const state9 = store9.getState()
assert(state9.commits.length <= 3, `Max commits enforced (got ${state9.commits.length})`)

// ─── TimelineStore: Labels ───────────────

console.log('\n  TimelineStore: Label Generation')

const store10 = new TimelineStore(10, 100)

// Single style mutation
store10.addMutation(makeMutation({ id: 'lb1', kind: 'style', shortSelector: 'button.cta' }))
store10.flush()
assert(store10.getCommits()[0].label.includes('button.cta'), 'Single mutation label includes selector')

// Single text mutation
store10.addMutation(makeMutation({ id: 'lb2', kind: 'text', shortSelector: 'h1.title' }))
store10.flush()
assert(store10.getCommits()[1].label.includes('h1.title'), 'Text mutation label includes selector')

// Multiple mutations to same element
store10.addMutation(makeMutation({ id: 'lb3', kind: 'style', shortSelector: 'div.card' }))
store10.addMutation(makeMutation({ id: 'lb4', kind: 'style', shortSelector: 'div.card' }))
store10.flush()
assert(store10.getCommits()[2].label.includes('div.card'), 'Multi-mutation label includes shared selector')

// ─── TimelineStore: Summary ──────────────

console.log('\n  TimelineStore: Summary Generation')

const store11 = new TimelineStore(10, 100)
store11.addMutation(makeMutation({ id: 'sm1', kind: 'style' }))
store11.addMutation(makeMutation({ id: 'sm2', kind: 'text' }))
store11.flush()

const summary = store11.getCommits()[0].summary
assert(summary.includes('style'), 'Summary mentions style changes')
assert(summary.includes('text'), 'Summary mentions text changes')

// ─── TimelineStore: Subscription ─────────

console.log('\n  TimelineStore: Subscription')

const store12 = new TimelineStore(10, 100)
let notified = 0
const unsub = store12.subscribe(() => notified++)
store12.addMutation(makeMutation({ id: 'sub1' }))
store12.flush()
assert(notified > 0, 'Subscriber notified on flush')

const before = notified
unsub()
store12.addMutation(makeMutation({ id: 'sub2' }))
store12.flush()
assertEq(notified, before, 'Unsubscribed listener not called')

// ─── TimelineStore: Markdown Export ──────

console.log('\n  Markdown Export')

const store13 = new TimelineStore(10, 100)
store13.addMutation(makeMutation({ id: 'exp1', kind: 'style', shortSelector: 'div.hero', before: 'padding: 8px', after: 'padding: 24px' }))
store13.flush()
store13.acceptCommit(store13.getCommits()[0].id)

// Mock window.location for export
globalThis.window = { location: { href: 'https://example.com' } }

const md = store13.exportMarkdown()
assert(md.includes('# Visual Changelog'), 'Markdown has title')
assert(md.includes('https://example.com'), 'Markdown has URL')
assert(md.includes('div.hero'), 'Markdown has selector')
assert(md.includes('padding: 8px'), 'Markdown has before value')
assert(md.includes('padding: 24px'), 'Markdown has after value')
assert(md.includes('✓'), 'Markdown has accepted icon')

// ─── TimelineStore: JSON Export ──────────

console.log('\n  JSON Export')

const jsonStr = store13.exportJSON()
const json = JSON.parse(jsonStr)
assert(typeof json === 'object', 'JSON parses correctly')
assertEq(json.url, 'https://example.com', 'JSON has URL')
assert(Array.isArray(json.commits), 'JSON has commits array')
assert(json.commits[0].mutations.length > 0, 'JSON commits have mutations')
assertEq(json.commits[0].mutations[0].kind, 'style', 'JSON mutation has kind')
assert(json.stats.accepted > 0, 'JSON stats reflect accepts')

// ─── Types and Constants ─────────────────

console.log('\n  Types and Constants')

assert(typeof REWIND_COLORS === 'object', 'REWIND_COLORS exported')
assertEq(REWIND_COLORS.added, '#4ade80', 'Added color correct')
assertEq(REWIND_COLORS.removed, '#f87171', 'Removed color correct')
assertEq(REWIND_COLORS.changed, '#60a5fa', 'Changed color correct')
assertEq(REWIND_COLORS.pending, '#fbbf24', 'Pending color correct')

// ─── Edge Cases ──────────────────────────

console.log('\n  Edge Cases')

const storeE = new TimelineStore(10, 100)

// Accept non-existent commit
storeE.acceptCommit('nonexistent')
assertEq(storeE.getState().commits.length, 0, 'Accepting nonexistent commit is a no-op')

// Reject non-existent mutation
storeE.rejectMutation('nonexistent')
assertEq(storeE.getState().commits.length, 0, 'Rejecting nonexistent mutation is a no-op')

// Empty export
const emptyMd = storeE.exportMarkdown()
assert(emptyMd.includes('# Visual Changelog'), 'Empty export still has header')

// Double accept
storeE.addMutation(makeMutation({ id: 'dbl1' }))
storeE.flush()
const dblId = storeE.getCommits()[0].id
storeE.acceptCommit(dblId)
storeE.acceptCommit(dblId) // Second accept should be harmless
assertEq(storeE.getState().commits[0].status, 'accepted', 'Double accept is idempotent')

// Reject after accept should not revert (accepted mutations skip revert)
storeE.addMutation(makeMutation({ id: 'ra1' }))
storeE.flush()
const raId = storeE.getCommits()[1].id
storeE.acceptCommit(raId)
storeE.rejectCommit(raId)
// Status will say rejected but mutation was already accepted so revert skips
assert(storeE.getCommits()[1].mutations[0].reverted === false || storeE.getCommits()[1].mutations[0].status === 'accepted', 'Accepted mutations skip revert')

// ─── Mutation Kinds ──────────────────────

console.log('\n  Mutation Kinds')

const storeK = new TimelineStore(10, 100)
const kinds = ['style', 'attribute', 'text', 'childList']
for (const kind of kinds) {
  storeK.addMutation(makeMutation({ id: `k_${kind}`, kind }))
}
storeK.flush()
const stateK = storeK.getState()
assertEq(stateK.commits[0].mutations.length, 4, 'All 4 mutation kinds added')

const kindSet = new Set(stateK.commits[0].mutations.map(m => m.kind))
assert(kindSet.has('style'), 'Has style mutation')
assert(kindSet.has('attribute'), 'Has attribute mutation')
assert(kindSet.has('text'), 'Has text mutation')
assert(kindSet.has('childList'), 'Has childList mutation')

// ─── Summary ─────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)

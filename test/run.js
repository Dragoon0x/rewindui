// ═══════════════════════════════════════════
// REWINDUI v1 — Tests
// ═══════════════════════════════════════════

var r = require('../dist/index.js')

var passed = 0, failed = 0
function assert(c, m) { if (c) { passed++; console.log('  ✓ ' + m) } else { failed++; console.error('  ✗ ' + m) } }
function assertEq(a, b, m) { assert(a === b, m + ' (got: ' + JSON.stringify(a) + ', expected: ' + JSON.stringify(b) + ')') }

// Mock localStorage
global.localStorage = { _d: {}, getItem: function(k) { return this._d[k] || null }, setItem: function(k,v) { this._d[k] = v }, removeItem: function(k) { delete this._d[k] } }

// ─── TimelineStore: Basic ───

console.log('\n  TimelineStore: Basic')

r.resetStore()
var store = r.getStore()
assert(store !== null, 'Store created')
assertEq(store.isRecording(), false, 'Starts not recording')
assertEq(store.getCommits().length, 0, 'No commits initially')

var stats = store.getStats()
assertEq(stats.total, 0, 'Stats: 0 total')
assertEq(stats.pending, 0, 'Stats: 0 pending')
assertEq(stats.accepted, 0, 'Stats: 0 accepted')
assertEq(stats.rejected, 0, 'Stats: 0 rejected')

// ─── TimelineStore: State ───

console.log('\n  TimelineStore: State')

var state = store.getState()
assert(Array.isArray(state.commits), 'State has commits array')
assert(Array.isArray(state.snapshots), 'State has snapshots array')
assertEq(state.recording, false, 'State recording is false')
assertEq(state.cursor, -1, 'State cursor is -1')

// ─── TimelineStore: Subscription ───

console.log('\n  TimelineStore: Subscription')

r.resetStore()
var store2 = r.getStore()
var notified = 0
var unsub = store2.subscribe(function() { notified++ })
store2.clear() // triggers notify
assert(notified > 0, 'Subscriber notified')

var before = notified
unsub()
store2.clear()
assertEq(notified, before, 'Unsubscribed not called')

// ─── TimelineStore: Filter & Search ───

console.log('\n  TimelineStore: Filter & Search')

r.resetStore()
var store3 = r.getStore()

// Manually add commits for testing
var testCommits = store3.getState().commits
testCommits.push({
  id: 'c1', mutations: [
    { id: 'm1', type: 'style', selector: '.hero', shortSelector: 'div.hero', tag: 'div', attributeName: 'style', oldValue: 'color: red', newValue: 'color: blue', timestamp: Date.now(), bounds: null, status: 'pending', undoData: null, impact: 0.5 }
  ], timestamp: Date.now(), status: 'pending', label: 'Style: div.hero', annotation: null, impact: 0.5
})
testCommits.push({
  id: 'c2', mutations: [
    { id: 'm2', type: 'text', selector: 'h1', shortSelector: 'h1', tag: 'h1', attributeName: null, oldValue: 'Hello', newValue: 'World', timestamp: Date.now(), bounds: null, status: 'pending', undoData: null, impact: 0.3 }
  ], timestamp: Date.now(), status: 'pending', label: 'Edited text in h1', annotation: null, impact: 0.3
})
testCommits.push({
  id: 'c3', mutations: [
    { id: 'm3', type: 'attribute', selector: 'img', shortSelector: 'img', tag: 'img', attributeName: 'src', oldValue: 'a.jpg', newValue: 'b.jpg', timestamp: Date.now(), bounds: null, status: 'accepted', undoData: null, impact: 0.2 }
  ], timestamp: Date.now(), status: 'accepted', label: 'Updated source on img', annotation: 'Approved new image', impact: 0.2
})

assertEq(store3.getCommits().length, 3, 'Has 3 commits')

var styleCommits = store3.filterByType('style')
assertEq(styleCommits.length, 1, 'Filter by style: 1')

var textCommits = store3.filterByType('text')
assertEq(textCommits.length, 1, 'Filter by text: 1')

var pendingCommits = store3.filterByStatus('pending')
assertEq(pendingCommits.length, 2, 'Filter by pending: 2')

var acceptedCommits = store3.filterByStatus('accepted')
assertEq(acceptedCommits.length, 1, 'Filter by accepted: 1')

var searchResults = store3.search('hero')
assertEq(searchResults.length, 1, 'Search "hero": 1 result')

var searchResults2 = store3.search('image')
assertEq(searchResults2.length, 1, 'Search "image" in annotation: 1 result')

var searchResults3 = store3.search('nonexistent')
assertEq(searchResults3.length, 0, 'Search nonexistent: 0')

// ─── TimelineStore: Accept/Reject ───

console.log('\n  TimelineStore: Accept/Reject')

store3.acceptCommit('c1')
assertEq(store3.getCommit('c1').status, 'accepted', 'c1 accepted')
assertEq(store3.getCommit('c1').mutations[0].status, 'accepted', 'c1 mutation accepted')

store3.rejectCommit('c2')
assertEq(store3.getCommit('c2').status, 'rejected', 'c2 rejected')

var stats3 = store3.getStats()
assertEq(stats3.accepted, 2, 'Stats: 2 accepted')
assertEq(stats3.rejected, 1, 'Stats: 1 rejected')

// ─── TimelineStore: Annotate ───

console.log('\n  TimelineStore: Annotate')

store3.annotate('c1', 'Good change, keeping this')
assertEq(store3.getCommit('c1').annotation, 'Good change, keeping this', 'Annotation set')

store3.annotate('nonexistent', 'test')
assert(true, 'Annotating nonexistent is no-op')

// ─── TimelineStore: Accept All ───

console.log('\n  TimelineStore: Accept All')

r.resetStore()
var store4 = r.getStore()
store4.getState().commits.push(
  { id: 'a1', mutations: [{ id: 'x1', type: 'style', selector: '.a', shortSelector: '.a', tag: 'div', attributeName: 'style', oldValue: '', newValue: '', timestamp: Date.now(), bounds: null, status: 'pending', undoData: null, impact: 0.1 }], timestamp: Date.now(), status: 'pending', label: 'Test 1', annotation: null, impact: 0.1 },
  { id: 'a2', mutations: [{ id: 'x2', type: 'text', selector: '.b', shortSelector: '.b', tag: 'p', attributeName: null, oldValue: '', newValue: '', timestamp: Date.now(), bounds: null, status: 'pending', undoData: null, impact: 0.1 }], timestamp: Date.now(), status: 'pending', label: 'Test 2', annotation: null, impact: 0.1 }
)
store4.acceptAll()
assertEq(store4.getCommit('a1').status, 'accepted', 'a1 accepted')
assertEq(store4.getCommit('a2').status, 'accepted', 'a2 accepted')

// ─── TimelineStore: Batch by Type ───

console.log('\n  TimelineStore: Batch by Type')

r.resetStore()
var store5 = r.getStore()
store5.getState().commits.push(
  { id: 'b1', mutations: [{ id: 'y1', type: 'style', selector: '.x', shortSelector: '.x', tag: 'div', attributeName: 'style', oldValue: '', newValue: '', timestamp: Date.now(), bounds: null, status: 'pending', undoData: null, impact: 0.1 }], timestamp: Date.now(), status: 'pending', label: 'Style', annotation: null, impact: 0.1 },
  { id: 'b2', mutations: [{ id: 'y2', type: 'text', selector: '.y', shortSelector: '.y', tag: 'p', attributeName: null, oldValue: '', newValue: '', timestamp: Date.now(), bounds: null, status: 'pending', undoData: null, impact: 0.1 }], timestamp: Date.now(), status: 'pending', label: 'Text', annotation: null, impact: 0.1 },
  { id: 'b3', mutations: [{ id: 'y3', type: 'style', selector: '.z', shortSelector: '.z', tag: 'span', attributeName: 'style', oldValue: '', newValue: '', timestamp: Date.now(), bounds: null, status: 'pending', undoData: null, impact: 0.1 }], timestamp: Date.now(), status: 'pending', label: 'Style 2', annotation: null, impact: 0.1 }
)
var accepted = store5.acceptByType('style')
assertEq(accepted, 2, 'Accepted 2 style mutations')
assertEq(store5.getCommit('b1').mutations[0].status, 'accepted', 'b1 style accepted')
assertEq(store5.getCommit('b2').mutations[0].status, 'pending', 'b2 text still pending')
assertEq(store5.getCommit('b3').mutations[0].status, 'accepted', 'b3 style accepted')

// ─── TimelineStore: Export ───

console.log('\n  TimelineStore: Export')

r.resetStore()
var store6 = r.getStore()
store6.getState().commits.push(
  { id: 'e1', mutations: [{ id: 'z1', type: 'style', selector: '.hero', shortSelector: 'div.hero', tag: 'div', attributeName: 'style', oldValue: 'color: red', newValue: 'color: blue', timestamp: Date.now(), bounds: null, status: 'accepted', undoData: null, impact: 0.5 }], timestamp: Date.now(), status: 'accepted', label: 'Style: div.hero', annotation: 'Approved', impact: 0.5 }
)

var md = store6.exportMarkdown()
assert(md.includes('Rewind Session'), 'Markdown has title')
assert(md.includes('div.hero'), 'Markdown has selector')
assert(md.includes('color: red'), 'Markdown has old value')
assert(md.includes('color: blue'), 'Markdown has new value')
assert(md.includes('Approved'), 'Markdown has annotation')

var json = store6.exportJSON()
var parsed = JSON.parse(json)
assert(parsed.commits.length === 1, 'JSON has 1 commit')
assert(parsed.stats.total === 1, 'JSON stats has total')

var agent = store6.exportAgentBlock()
assert(agent.includes('<dom_changes>'), 'Agent block has opening tag')
assert(agent.includes('</dom_changes>'), 'Agent block has closing tag')
assert(agent.includes('Approved changes'), 'Agent block has approved section')

// ─── TimelineStore: Clear ───

console.log('\n  TimelineStore: Clear')

store6.clear()
assertEq(store6.getCommits().length, 0, 'Clear removes all commits')

// ─── Observer ───

console.log('\n  Observer')

assert(typeof r.Observer === 'function', 'Observer class exported')
var obs = new r.Observer()
assert(obs !== null, 'Observer instantiates')

// ─── Selectors ───

console.log('\n  Selectors')

assert(typeof r.getSelector === 'function', 'getSelector exported')
assert(typeof r.getShortSelector === 'function', 'getShortSelector exported')

// ─── Component Exports ───

console.log('\n  Exports')

assert(typeof r.Rewind === 'function', 'Rewind component exported')
assert(typeof r.useRewind === 'function', 'useRewind hook exported')
assert(typeof r.TimelineStore === 'function', 'TimelineStore class exported')
assert(typeof r.getStore === 'function', 'getStore exported')
assert(typeof r.resetStore === 'function', 'resetStore exported')
assert(typeof r.REWIND_COLORS === 'object', 'REWIND_COLORS exported')
assertEq(r.REWIND_COLORS.accent, '#818cf8', 'Accent color')

// ─── Summary ───

console.log('\n  ' + passed + ' passed, ' + failed + ' failed\n')
process.exit(failed > 0 ? 1 : 0)

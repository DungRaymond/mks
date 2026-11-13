import assert from 'node:assert/strict'
import { test } from 'node:test'
import { belongsToCollection, filterItems, splitSections, taskCollectionPatch, type Item } from '../lib/items.ts'

const now = Date.parse('2026-11-13T09:00:00Z')
const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'task-1', type: 'task', title: 'Ôn tập Đại số', description: 'Nộp đề cương',
  subjects: ['Toán'], is_archived: false, priority: 'normal',
  due_at: '2026-11-14T09:00:00Z', is_done: false, updated_at: '2026-11-13T08:00:00Z',
  ...overrides,
})

test('completed tasks and homework do not appear in actionable sections', () => {
  for (const type of ['task', 'homework'] as const) {
    const result = splitSections([
      makeItem({ type, is_done: true }),
      makeItem({ id: 'past', type, is_done: true, due_at: '2026-11-12T09:00:00Z' }),
    ], now)
    assert.equal(result.dueSoon.length, 0)
    assert.equal(result.overdue.length, 0)
    assert.equal(result.recent.length, 0)
  }
})

test('archived content is excluded from every section and search', () => {
  const items = [makeItem({ is_archived: true }), makeItem({ id: 'notice', type: 'notice', is_archived: true })]
  assert.deepEqual(splitSections(items, now), { dueSoon: [], overdue: [], notices: [], recent: [] })
  assert.deepEqual(filterItems(items, '', 'all'), [])
})

test('completed tasks disappear from main search and move to done collection', () => {
  const done = makeItem({ is_done: true })
  assert.deepEqual(filterItems([done], '', 'all'), [])
  assert.deepEqual(filterItems([done], '', 'all', 'done'), [done])
  assert.deepEqual(filterItems([done], '', 'all', 'archived'), [])
})

test('archived completed tasks belong exclusively to archive', () => {
  const item = makeItem({ is_done: true, is_archived: true })
  assert.equal(belongsToCollection(item, 'active'), false)
  assert.equal(belongsToCollection(item, 'done'), false)
  assert.equal(belongsToCollection(item, 'archived'), true)
})

test('moving tasks produces flags that hide them from main and support restoring', () => {
  for (const destination of ['done', 'archived', 'active'] as const) {
    const item = { ...makeItem({ is_done: true, is_archived: true }), ...taskCollectionPatch(destination) }
    assert.equal(belongsToCollection(item, destination), true)
    assert.equal(filterItems([item], '', 'all').length, destination === 'active' ? 1 : 0)
  }
})

test('notices and announcements can move between done, archive and main collections', () => {
  for (const type of ['notice', 'announcement'] as const) {
    const original = makeItem({ type, due_at: null })
    const done = { ...original, ...taskCollectionPatch('done') }
    const archived = { ...done, ...taskCollectionPatch('archived') }
    const restored = { ...archived, ...taskCollectionPatch('active') }
    assert.deepEqual(splitSections([done, archived], now).notices, [])
    assert.deepEqual(filterItems([done], '', type, 'done'), [done])
    assert.deepEqual(filterItems([archived], '', type, 'archived'), [archived])
    assert.deepEqual(splitSections([restored], now).notices, [restored])
  }
})

test('deadline boundary belongs to upcoming, not overdue', () => {
  const result = splitSections([makeItem({ due_at: new Date(now).toISOString() })], now)
  assert.equal(result.dueSoon.length, 1)
  assert.equal(result.overdue.length, 0)
})

test('priority and then earliest deadline determine upcoming ordering', () => {
  const result = splitSections([
    makeItem({ id: 'normal' }),
    makeItem({ id: 'urgent-later', priority: 'urgent', due_at: '2026-11-16T09:00:00Z' }),
    makeItem({ id: 'urgent-first', priority: 'urgent' }),
  ], now)
  assert.deepEqual(result.dueSoon.map((item) => item.id), ['urgent-first', 'urgent-later', 'normal'])
})

test('undated tasks remain discoverable through recent and filters', () => {
  const item = makeItem({ due_at: null })
  const result = splitSections([item], now)
  assert.equal(result.dueSoon.length, 0)
  assert.equal(result.overdue.length, 0)
  assert.deepEqual(result.recent, [item])
  assert.deepEqual(filterItems([item], '', 'task'), [item])
})

test('Vietnamese search matches without accents, case or surrounding spaces', () => {
  const item = makeItem()
  for (const query of ['  ON TAP  ', 'dai so', 'DE CUONG', 'toan']) {
    assert.deepEqual(filterItems([item], query, 'all'), [item])
  }
  assert.deepEqual(filterItems([item], 'khong ton tai', 'all'), [])
  assert.deepEqual(filterItems([item], 'toan', 'homework'), [])
})

test('sections cap previews without mutating the input order', () => {
  const items = Array.from({ length: 12 }, (_, index) => makeItem({ id: String(index) }))
  const original = [...items]
  const result = splitSections(items, now)
  assert.equal(result.dueSoon.length, 5)
  assert.equal(result.recent.length, 8)
  assert.deepEqual(items, original)
  assert.equal(filterItems(items, '', 'all').length, 12)
})

test('notices do not become overdue tasks and newest updates come first', () => {
  const result = splitSections([
    makeItem({ id: 'older', type: 'notice', due_at: '2026-11-10T09:00:00Z' }),
    makeItem({ id: 'newer', type: 'announcement', updated_at: '2026-11-13T09:00:00Z' }),
  ], now)
  assert.equal(result.overdue.length, 0)
  assert.equal(result.dueSoon.length, 0)
  assert.deepEqual(result.notices.map((item) => item.id), ['newer', 'older'])
})

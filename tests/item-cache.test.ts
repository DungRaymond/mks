import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cacheUpdatedItem, getCachedItems, loadItemImages, syncItems } from '../lib/item-cache.ts'
import type { Item } from '../lib/items.ts'

const makeItem = (id: string, updated_at = '2026-11-13T09:00:00Z'): Item => ({
  id, updated_at, type: 'task', title: id, description: null, subjects: [],
  priority: 'normal', is_done: false, is_archived: false, due_at: null,
})

test('shared cache only writes content when ids or modification timestamps change', async (t) => {
  const originalFetch = globalThis.fetch
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const stored = new Map<string, string>([['class-hub-items-v2', JSON.stringify({ items: [makeItem('a'), makeItem('b')] })]])
  const writes: string[] = []
  const calls: string[] = []
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value); writes.push(key) },
  } })
  let remote = [makeItem('a'), makeItem('b')]
  let fail = false
  let failDetails = false
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (fail) throw new Error('offline')
    if (url.includes('/images')) return Response.json({ updated_at: remote[0].updated_at, images: [] })
    const ids = new URL(url, 'http://localhost').searchParams.get('ids')?.split(',')
    if (ids && failDetails) return Response.json({ error: 'failed' }, { status: 502 })
    return Response.json({ items: ids ? remote.filter((item) => ids.includes(item.id)) : remote.map(({ id, updated_at }) => ({ id, updated_at })) })
  }) as typeof fetch

  try {
    await t.test('cached data is available before any network request', () => {
      assert.equal(getCachedItems()?.length, 2)
      assert.equal(calls.length, 0)
      assert.equal(writes.length, 0)
    })
    await t.test('unchanged metadata does not fetch details, write storage or replace item references', async () => {
      const before = getCachedItems()
      await syncItems()
      assert.equal(getCachedItems(), before)
      assert.deepEqual(calls, ['/api/items'])
      assert.equal(writes.length, 0)
    })
    await t.test('only the item with a newer modification date is fetched and replaced', async () => {
      calls.length = 0
      const unchanged = getCachedItems()![1]
      remote = [{ ...makeItem('a', '2026-11-13T10:00:00Z'), title: 'Updated A' }, makeItem('b')]
      await syncItems()
      assert.deepEqual(calls, ['/api/items', '/api/items?ids=a'])
      assert.equal(getCachedItems()![0].title, 'Updated A')
      assert.equal(getCachedItems()![1], unchanged)
      assert.deepEqual(writes, ['class-hub-items-v2'])
      const before = getCachedItems()
      await syncItems()
      assert.equal(getCachedItems(), before)
      assert.equal(writes.length, 1)
    })
    await t.test('deleted items are removed and newly added items fetched once', async () => {
      calls.length = 0
      remote = [remote[0], makeItem('c')]
      await syncItems()
      assert.deepEqual(calls, ['/api/items', '/api/items?ids=c'])
      assert.deepEqual(getCachedItems()!.map((item) => item.id), ['a', 'c'])
      assert.equal(writes.length, 2)
    })
    await t.test('offline and failed detail updates preserve existing cache', async () => {
      const before = getCachedItems()
      const writeCount = writes.length
      fail = true
      await syncItems()
      fail = false
      assert.equal(getCachedItems(), before)
      remote = [{ ...remote[0], updated_at: '2026-11-13T11:00:00Z' }, remote[1]]
      failDetails = true
      await syncItems()
      failDetails = false
      assert.equal(getCachedItems(), before)
      assert.equal(writes.length, writeCount)
      await syncItems()
      assert.equal(writes.length, writeCount + 1)
    })
    await t.test('image metadata is cached per item modification date', async () => {
      calls.length = 0
      await loadItemImages('a', remote[0].updated_at)
      await loadItemImages('a', remote[0].updated_at)
      assert.deepEqual(calls, ['/api/items/a/images'])
      assert.equal(writes.filter((key) => key === 'class-hub-images-v1').length, 1)
    })
    await t.test('an old background response cannot overwrite a newer successful move', async () => {
      let release!: (value: Response) => void
      const response = new Promise<Response>((resolve) => { release = resolve })
      globalThis.fetch = (() => response) as typeof fetch
      const pending = syncItems()
      const moved = { ...remote[0], is_done: true, updated_at: '2026-11-13T12:00:00Z' }
      cacheUpdatedItem(moved)
      const writesAfterMove = writes.length
      release(Response.json({ items: remote.map(({ id, updated_at }) => ({ id, updated_at })) }))
      await pending
      assert.equal(getCachedItems()!.find((item) => item.id === 'a'), moved)
      assert.equal(writes.length, writesAfterMove)
    })
  } finally {
    globalThis.fetch = originalFetch
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findItemByRoute, itemHref, itemSlug, parseItemRoute } from '../lib/item-slugs.ts'

const id = 'a1404b61-9c38-43a1-bad8-36da8e732ba4'

test('Vietnamese title becomes a short readable ASCII slug', () => {
  const slug = itemSlug({ id, title: 'Đề cương: Ôn tập Toán & Hóa học!' })
  assert.equal(slug, 'de-cuong-on-tap-toan-hoa-a1404b61')
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.ok(slug.length <= 35)
})

test('long titles are summarized by complete words, not copied into the URL', () => {
  const item = { id, title: 'Tìm hiểu phương pháp để xác định và các ứng dụng trong lĩnh vực dược phẩm' }
  assert.equal(itemSlug(item), 'tim-hieu-phuong-phap-xac-a1404b61')
  assert.ok(itemHref(item).startsWith('/items/'))
  assert.ok(!itemHref(item).includes(id))
})

test('empty, punctuation-only and non-Latin titles have a safe fallback', () => {
  for (const title of ['', '!!!', '📚✨', '中文']) assert.equal(itemSlug({ id, title }), 'noi-dung-a1404b61')
  assert.ok(itemSlug({ id, title: 'x'.repeat(240) }).length <= 35)
})

test('duplicate titles get different links without changing database IDs', () => {
  const first = { id, title: 'Bài tập Canvas' }
  const second = { id: 'b2404b61-9c38-43a1-bad8-36da8e732ba4', title: first.title }
  assert.notEqual(itemHref(first), itemHref(second))
  assert.equal(findItemByRoute([first, second], itemSlug(first)), first)
  assert.equal(findItemByRoute([first, second], itemSlug(second)), second)
})

test('existing UUID links and an earlier title both resolve to the same item', () => {
  const old = { id, title: 'Bài tập cũ' }
  const current = { id, title: 'Bài tập mới' }
  assert.equal(findItemByRoute([current], id), current)
  assert.equal(findItemByRoute([current], id.toUpperCase()), current)
  assert.equal(findItemByRoute([current], itemSlug(old)), current)
  assert.equal(findItemByRoute([current], itemSlug(current)), current)
})

test('route parsing produces indexed UUID bounds instead of scanning all titles', () => {
  assert.deepEqual(parseItemRoute('bai-tap-a1404b61'), {
    kind: 'slug', prefix: 'a1404b61',
    lower: 'a1404b61-0000-0000-0000-000000000000',
    upper: 'a1404b61-ffff-ffff-ffff-ffffffffffff',
  })
  for (const route of ['../admin', '<script>', 'invalid', 'bai-tap-not-an-id', 'a'.repeat(201)]) {
    assert.equal(parseItemRoute(route), null)
    assert.equal(findItemByRoute([{ id, title: 'Title' }], route), null)
  }
})

test('ambiguous short IDs never silently open the wrong item', () => {
  const first = { id, title: 'Bài tập' }
  const second = { id: 'a1404b61-0000-4000-8000-000000000000', title: 'Bài tập' }
  assert.equal(findItemByRoute([first, second], itemSlug(first)), null)
  assert.equal(findItemByRoute([first, second], first.id), first)
})

type NamedItem = { id: string; title: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fillerWords = new Set(['và', 'của', 'các', 'những', 'cho', 'trong', 'với', 'về', 'theo', 'tại', 'để', 'là', 'một'])

export function itemSlug(item: NamedItem) {
  const words = (item.title.toLocaleLowerCase('vi').normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => !fillerWords.has(word))
    .map((word) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
  const summary: string[] = []
  for (const word of words) {
    if (summary.length === 6 || [...summary, word].join('-').length > 26) break
    summary.push(word)
  }
  const stem = summary.join('-') || words[0]?.slice(0, 26) || 'noi-dung'
  return `${stem}-${item.id.slice(0, 8).toLowerCase()}`
}

export function itemHref(item: NamedItem) { return `/items/${itemSlug(item)}` }

export function parseItemRoute(value: string) {
  if (UUID.test(value)) return { kind: 'uuid' as const, id: value.toLowerCase() }
  if (value.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$/.test(value)) return null
  const prefix = value.slice(-8)
  return {
    kind: 'slug' as const,
    prefix,
    lower: `${prefix}-0000-0000-0000-000000000000`,
    upper: `${prefix}-ffff-ffff-ffff-ffffffffffff`,
  }
}

// Resolve both old UUID links and title-based links from the same cached data.
// A previous title still resolves when its short ID identifies exactly one item.
export function findItemByRoute<T extends NamedItem>(items: T[], route: string): T | null {
  const parsed = parseItemRoute(route)
  if (!parsed) return null
  if (parsed.kind === 'uuid') return items.find((item) => item.id.toLowerCase() === parsed.id) ?? null
  const candidates = items.filter((item) => item.id.toLowerCase().startsWith(parsed.prefix))
  const exact = candidates.filter((item) => itemSlug(item) === route)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null // Never open another item on an ambiguous short ID.
  return candidates.length === 1 ? candidates[0] : null
}

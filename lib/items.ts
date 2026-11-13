export type Item = {
  id: string
  type: 'task' | 'homework' | 'notice' | 'announcement'
  title: string
  description: string | null
  subjects: string[]
  is_archived: boolean
  priority: 'normal' | 'high' | 'urgent'
  due_at: string | null
  is_done: boolean
  updated_at: string
}

export const ITEM_FIELDS = 'id, type, title, description, subjects, is_archived, priority, due_at, is_done, updated_at'

const priorityRank = { normal: 0, high: 1, urgent: 2 }

export type ItemCollection = 'active' | 'done' | 'archived'

export function belongsToCollection(item: Item, collection: ItemCollection) {
  if (collection === 'archived') return item.is_archived
  if (collection === 'done') return !item.is_archived && item.is_done
  return !item.is_archived && !item.is_done
}

export function taskCollectionPatch(collection: ItemCollection) {
  if (collection === 'archived') return { is_archived: true }
  return { is_done: collection === 'done', is_archived: false }
}

export function filterItems(items: Item[], query: string, type: Item['type'] | 'all', collection: ItemCollection = 'active') {
  const normalize = (value: string) => value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  const search = normalize(query.trim())
  return items.filter((item) => belongsToCollection(item, collection)
    && (type === 'all' || item.type === type)
    && (!search || normalize([item.title, item.description, ...item.subjects].join(' ')).includes(search)))
}

export function splitSections(items: Item[], now: number) {
  const visible = items.filter((item) => belongsToCollection(item, 'active'))
  const tasks = visible.filter((item) => !item.is_done && (item.type === 'task' || item.type === 'homework'))
  const dueSoon = tasks
    .filter((item) => item.due_at !== null && Date.parse(item.due_at) >= now)
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || Date.parse(a.due_at!) - Date.parse(b.due_at!))
    .slice(0, 5)
  const overdue = tasks
    .filter((item) => !item.is_done && item.due_at !== null && Date.parse(item.due_at) < now)
    .sort((a, b) => Date.parse(b.due_at!) - Date.parse(a.due_at!))
    .slice(0, 5)
  const byUpdated = (a: Item, b: Item) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
  const notices = visible
    .filter((item) => item.type === 'notice' || item.type === 'announcement')
    .sort(byUpdated)
  const recent = [...visible].sort(byUpdated).slice(0, 8)
  return { dueSoon, overdue, notices, recent }
}

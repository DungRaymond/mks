export type Item = {
  id: string
  type: 'task' | 'homework' | 'notice' | 'announcement'
  title: string
  description: string | null
  subject: string | null
  priority: 'normal' | 'high' | 'urgent'
  due_at: string | null
  is_done: boolean
  updated_at: string
}

export const ITEM_FIELDS = 'id, type, title, description, subject, priority, due_at, is_done, updated_at'

const priorityRank = { normal: 0, high: 1, urgent: 2 }

export function splitSections(items: Item[], now: number) {
  const tasks = items.filter((item) => item.type === 'task' || item.type === 'homework')
  const dueSoon = tasks
    .filter((item) => item.due_at !== null && Date.parse(item.due_at) >= now)
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || Date.parse(a.due_at!) - Date.parse(b.due_at!))
    .slice(0, 5)
  const overdue = tasks
    .filter((item) => !item.is_done && item.due_at !== null && Date.parse(item.due_at) < now)
    .sort((a, b) => Date.parse(b.due_at!) - Date.parse(a.due_at!))
    .slice(0, 5)
  const byUpdated = (a: Item, b: Item) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
  const notices = items
    .filter((item) => item.type === 'notice' || item.type === 'announcement')
    .sort(byUpdated)
  const recent = [...items].sort(byUpdated).slice(0, 8)
  return { dueSoon, overdue, notices, recent }
}
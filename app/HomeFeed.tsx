'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { splitSections, type Item } from '@/lib/items'

const CACHE_KEY = 'class-hub-items-v1'
const REVALIDATE_MS = 60_000

const priorityLabel = { urgent: 'Khẩn cấp', high: 'Ưu tiên cao', normal: 'Bình thường' }
const typeLabel = { task: 'Task lớp', homework: 'Bài tập', notice: 'Lưu ý', announcement: 'Thông báo' }
const typeChip = 'border border-oak/30 bg-white/70 text-ink/75'
const subjectColors: Record<string, string> = {
  'Lý - dược': 'border-blue-500 bg-blue-100 text-blue-950',
  'Toán': 'border-blue-500 bg-blue-100 text-blue-950',
  'Hóa': 'border-yellow-500 bg-yellow-100 text-yellow-950',
  'Hóa vô cơ - dược': 'border-yellow-500 bg-yellow-100 text-yellow-950',
  'Modul Y sinh': 'border-cyan-500 bg-cyan-100 text-cyan-950',
  'Y sinh': 'border-cyan-500 bg-cyan-100 text-cyan-950',
  'Sinh': 'border-cyan-500 bg-cyan-100 text-cyan-950',
}

let snapshot: Item[] | null = null
let snapshotLoaded = false
const listeners = new Set<() => void>()

function readStored(): Item[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { items?: Item[] }
    if (!Array.isArray(parsed.items)) return null
    return parsed.items.filter((item) => item && typeof item.id === 'string' && typeof item.updated_at === 'string')
  } catch {
    return null
  }
}

function getSnapshot(): Item[] | null {
  if (!snapshotLoaded) {
    snapshotLoaded = true
    snapshot = readStored()
  }
  return snapshot
}

function getServerSnapshot(): Item[] | null {
  return null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CACHE_KEY) return
    snapshot = readStored()
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function saveStored(items: Item[]) {
  snapshot = items
  snapshotLoaded = true
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items }))
  } catch {
    // localStorage unavailable (private mode/quota): keep the in-memory snapshot
  }
  for (const listener of listeners) listener()
}

function mergeFresh(stored: Item[] | null, fresh: Item[]): Item[] {
  const merged = new Map((stored ?? []).map((item) => [item.id, item]))
  for (const item of fresh) {
    const existing = merged.get(item.id)
    if (!existing || Date.parse(item.updated_at) >= Date.parse(existing.updated_at)) merged.set(item.id, item)
  }
  return [...merged.values()]
}

export default function HomeFeed({ initialItems, initialNow }: { initialItems: Item[]; initialNow: string }) {
  const cached = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [now, setNow] = useState(() => Date.parse(initialNow))
  const [refreshing, setRefreshing] = useState(false)
  const busyRef = useRef(false)
  const items = cached ?? initialItems
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
  })

  const revalidate = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setRefreshing(true)
    try {
      const res = await fetch('/api/items', { cache: 'no-store' })
      if (!res.ok) return
      const { items: meta } = (await res.json()) as { items: { id: string; updated_at: string }[] }
      const live = new Map(meta.map((entry) => [entry.id, entry.updated_at]))
      const base = new Map(itemsRef.current.map((item) => [item.id, item]))
      const next = new Map(base)
      let changed = false
      for (const id of next.keys()) {
        if (!live.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      const staleIds = meta
        .filter((entry) => base.get(entry.id)?.updated_at !== entry.updated_at)
        .map((entry) => entry.id)
      for (let i = 0; i < staleIds.length; i += 100) {
        const batch = staleIds.slice(i, i + 100)
        const freshRes = await fetch(`/api/items?ids=${batch.join(',')}`, { cache: 'no-store' })
        if (!freshRes.ok) continue
        const { items: fresh } = (await freshRes.json()) as { items: Item[] }
        for (const id of batch) next.delete(id)
        for (const item of fresh) next.set(item.id, item)
        changed = true
      }
      if (changed) saveStored([...next.values()])
    } catch {
      // offline or server error: keep showing cached data
    } finally {
      busyRef.current = false
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    saveStored(mergeFresh(getSnapshot(), initialItems))
    void revalidate()

    const tick = window.setInterval(() => {
      setNow(Date.now())
      void revalidate()
    }, REVALIDATE_MS)
    const onFocus = () => {
      setNow(Date.now())
      void revalidate()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('focus', onFocus)
    }
  }, [initialItems, revalidate])

  const { dueSoon, overdue, notices, recent } = splitSections(items, now)

  return (
    <div className="space-y-14">
      <section aria-labelledby="due-title">
        <SectionHeading id="due-title" eyebrow="Cần chú ý" title="Ưu tiên" />
        {dueSoon.length ? <div className="grid gap-4 md:grid-cols-2">{dueSoon.map((item) => <ItemCard key={item.id} item={item} now={now} />)}</div> : <EmptyState text="Chưa có task hoặc bài tập sắp đến hạn." />}
      </section>
      <section aria-labelledby="notice-title">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Thông tin lớp</p><h2 id="notice-title" className="mt-1 font-serif text-3xl">Thông báo</h2></div>
          {refreshing && <span role="status" className="pb-1 text-xs text-ink/45">Đang đồng bộ…</span>}
        </div>
        {notices.length ? <div className="grid gap-4 md:grid-cols-2">{notices.map((item) => <ItemCard key={item.id} item={item} now={now} />)}</div> : <EmptyState text="Chưa có thông báo nào." />}
      </section>
      <section aria-labelledby="overdue-title">
        <SectionHeading id="overdue-title" eyebrow="Cần xử lý" title="Đã hết hạn" />
        {overdue.length ? <div className="grid gap-4 md:grid-cols-2">{overdue.map((item) => <ItemCard key={item.id} item={item} now={now} />)}</div> : <EmptyState text="Không có task hoặc bài tập nào hết hạn." />}
      </section>
      <section aria-labelledby="recent-title">
        <SectionHeading id="recent-title" eyebrow="Mới cập nhật" title="Tin mới của lớp" />
        {recent.length ? <div className="divide-y divide-oak/25 rounded-2xl border border-oak/30 bg-white/55 px-5">{recent.map((item) => <RecentItem key={item.id} item={item} />)}</div> : <EmptyState text="Chưa có nội dung nào được đăng." />}
      </section>
    </div>
  )
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">{eyebrow}</p><h2 id={id} className="mt-1 font-serif text-3xl">{title}</h2></div>
}

function ItemCard({ item, now }: { item: Item; now: number }) {
  const urgentNotice = (item.type === 'notice' || item.type === 'announcement') && item.priority === 'urgent'
  const overdue = item.due_at !== null && Date.parse(item.due_at) < now
  const subjectColor = item.subject ? subjectColors[item.subject] : undefined
  return <Link href={`/items/${item.id}`} className={`block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${overdue ? 'border-red-600 bg-gray-400 text-gray-800' : urgentNotice ? 'border-rose/50 bg-rose/10' : subjectColor ?? 'border-oak/30 bg-white/65'}`}>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full px-3 py-1 font-bold ${overdue ? 'border border-gray-500 bg-gray-400 text-gray-800' : item.type === 'homework' ? 'border border-orange-800 bg-orange-700 text-white' : typeChip}`}>{typeLabel[item.type]}</span>
      {overdue && <span className="rounded-full border border-red-600 bg-red-100 px-3 py-1 font-bold text-red-800">ĐÃ HẾT HẠN</span>}
      {item.due_at && <span className={`rounded-full border px-3 py-1 font-bold ${overdue ? 'border-red-900 bg-red-700 text-white' : 'border-purple-900 bg-pink-300 text-purple-950'}`}>{formatTimeLeft(Date.parse(item.due_at) - now, overdue)}</span>}
      {urgentNotice && <span className="rounded-full bg-rose px-3 py-1 font-semibold text-white">CẦN CHÚ Ý</span>}
      {!urgentNotice && item.priority !== 'normal' && <span className="rounded-full bg-oak/15 px-3 py-1 font-bold text-ink/70">{priorityLabel[item.priority]}</span>}
    </div>
    <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
    {item.description && <p className={`mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 ${overdue ? 'text-gray-600' : 'text-ink/65'}`}>{item.description}</p>}
    <div className={`mt-5 flex flex-wrap justify-between gap-2 border-t pt-4 text-xs ${overdue ? 'border-gray-500 text-gray-700' : 'border-oak/20 text-ink/60'}`}>
      <span className={`rounded-full border px-3 py-1 font-bold ${overdue ? 'border-gray-500 bg-gray-400 text-gray-800' : subjectColors[item.subject ?? ''] ?? 'border-oak/30 bg-white/70'}`}>{item.subject ?? 'Cả lớp'}</span>
      {item.due_at ? <time dateTime={item.due_at}>Hạn: {formatDate(item.due_at)}</time> : <time dateTime={item.updated_at}>Cập nhật: {formatDate(item.updated_at)}</time>}
    </div>
  </Link>
}

function RecentItem({ item }: { item: Item }) {
  return <Link href={`/items/${item.id}`} className="flex flex-col justify-between gap-2 py-4 transition hover:text-rose sm:flex-row sm:items-center">
    <div className="min-w-0"><p className="text-xs text-rose">{typeLabel[item.type]}{item.subject ? ` · ${item.subject}` : ''}</p><h3 className="mt-1 truncate font-medium">{item.title}</h3></div>
    <time className="shrink-0 text-xs text-ink/55" dateTime={item.updated_at}>Cập nhật {formatDate(item.updated_at)}</time>
  </Link>
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-oak/40 px-5 py-8 text-sm text-ink/55">{text}</p>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
}

function formatTimeLeft(milliseconds: number, overdue: boolean) {
  const totalMinutes = Math.floor(Math.abs(milliseconds) / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const duration = days ? `${days} ngày ${hours} giờ` : hours ? `${hours} giờ ${minutes} phút` : `${Math.max(1, minutes)} phút`
  return overdue ? `Quá hạn ${duration}` : `Còn ${duration}`
}
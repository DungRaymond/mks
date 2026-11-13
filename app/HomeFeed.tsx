'use client'

import { useCallback, useEffect, useState } from 'react'
import ItemLink from '@/components/ItemLink'
import { filterItems, splitSections, type Item, type ItemCollection } from '@/lib/items'
import TaskDock, { DraggableTask } from './TaskDock'
import { moveTaskToCollection } from './task-actions'
import SubjectBadge from '@/components/SubjectBadge'
import { subjectLabel, subjectVars } from '@/lib/subjects'
import { cacheUpdatedItem, syncItems, useItemCache } from '@/lib/item-cache'
import { itemHref } from '@/lib/item-slugs'

const priorityLabel = { urgent: 'Khẩn cấp', high: 'Ưu tiên cao', normal: 'Bình thường' }
const typeLabel = { task: 'Task lớp', homework: 'Bài tập', notice: 'Lưu ý', announcement: 'Thông báo' }
const typeChip = 'border border-oak/30 bg-white/70 text-ink/75'
export default function HomeFeed({ initialNow, canManage = false }: { initialNow: string; canManage?: boolean }) {
  const { items: cached, refreshing, error: syncError } = useItemCache()
  const [now, setNow] = useState(() => Date.parse(initialNow))
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [type, setType] = useState<Item['type'] | 'all'>('all')
  const [collection, setCollection] = useState<ItemCollection>('active')
  const items = cached ?? []

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000)
    const onFocus = () => setNow(Date.now())
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const moveTask = useCallback(async (item: Item, destination: ItemCollection) => {
    const result = await moveTaskToCollection(item.id, destination)
    if ('error' in result) throw new Error(result.error)
    cacheUpdatedItem(result.item)
  }, [])

  const changeCollection = (destination: ItemCollection) => {
    setCollection(destination)
    setQuery('')
    setType('all')
    setShowAll(false)
  }

  const visible = filterItems(items, query, type, collection)
  const filtering = collection !== 'active' || showAll || query.trim() !== '' || type !== 'all'
  const { dueSoon, overdue, notices, recent } = splitSections(items, now)

  if (cached === null) return <div role="status" className="rounded-2xl border border-oak/30 bg-white/60 p-6"><p className="text-sm text-ink/75">{syncError ?? 'Đang tải nội dung lớp lần đầu…'}</p>{syncError && <button type="button" onClick={() => void syncItems()} className="nav-button mt-4">Thử lại</button>}</div>

  return (
    <TaskDock items={items} enabled={canManage} collection={collection} onCollectionChange={changeCollection} onMove={moveTask}>
    <div className="space-y-9">
      {collection !== 'active' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-oak/35 bg-white/70 p-5"><div><p className="text-xs font-medium text-ink/70">Kho nội dung của lớp</p><h2 className="mt-1 text-2xl font-semibold">{collection === 'done' ? '✓ Đã xong' : '▤ Lưu trữ'}</h2><p className="mt-2 text-sm text-ink/75">Các mục ở đây không hiển thị trên trang chính. Nhấn “Kéo / chuyển” để đưa về.</p></div><button type="button" onClick={() => changeCollection('active')} className="nav-button">← Trang chính</button></div>}
      <div className="rounded-2xl border border-oak/30 bg-white/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 basis-full text-sm font-medium md:flex-1 md:basis-0">Tìm nội dung
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tiêu đề, mô tả hoặc môn học…" className="mt-2 h-11 w-full rounded-xl border border-oak/40 bg-white px-3" />
          </label>
          <label className="w-full text-sm font-medium sm:w-auto">Loại nội dung
            <select value={type} onChange={(event) => setType(event.target.value as Item['type'] | 'all')} className="mt-2 block h-11 w-full rounded-xl border border-oak/40 bg-white px-3 sm:w-40">
              <option value="all">Tất cả nội dung</option>
              {Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="button" disabled={refreshing} onClick={() => void syncItems()} className="min-h-11 shrink-0 rounded-xl border border-oak/40 px-4 text-sm font-medium hover:bg-beige/50 disabled:opacity-60">{refreshing ? 'Đang đồng bộ…' : 'Làm mới'}</button>
          <button type="button" onClick={() => { setShowAll(!filtering); setCollection('active'); setQuery(''); setType('all') }} className="nav-button">{filtering ? '← Về trang chính' : 'Xem tất cả nội dung →'}</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p role="status" className={`text-xs leading-5 ${syncError ? 'text-red-800' : 'text-ink/70'}`}>{syncError ?? (refreshing ? 'Đang hiển thị cache và kiểm tra cập nhật trong nền…' : 'Dữ liệu đã lưu trên thiết bị. Đối chiếu cập nhật mỗi phút trong nền.')}</p>
        </div>
      </div>
      {filtering ? <section aria-labelledby="search-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="search-title" className="text-xl font-semibold">{query.trim() || type !== 'all' ? 'Kết quả tìm kiếm' : 'Tất cả nội dung'} ({visible.length})</h2>{(query.trim() || type !== 'all') && <button type="button" onClick={() => { setQuery(''); setType('all') }} className="min-h-11 text-sm font-medium underline underline-offset-4">Xóa bộ lọc</button>}</div>
        {visible.length ? <div className="grid gap-4 md:grid-cols-2">{[...visible].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).map((item) => <ItemCard key={item.id} item={item} now={now} />)}</div> : <EmptyState text={collection === 'active' ? 'Không tìm thấy nội dung phù hợp. Thử từ khóa khác hoặc xóa bộ lọc.' : 'Chưa có task phù hợp trong kho này.'} />}
      </section> : <>
      <section aria-labelledby="due-title">
        <SectionHeading id="due-title" eyebrow="Cần chú ý" title="Ưu tiên" />
        {dueSoon.length ? <div className="grid gap-4 md:grid-cols-2">{dueSoon.map((item) => <ItemCard key={item.id} item={item} now={now} />)}</div> : <EmptyState text="Chưa có task hoặc bài tập sắp đến hạn." />}
      </section>
      <section aria-labelledby="notice-title">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Thông tin lớp</p><h2 id="notice-title" className="mt-1 font-serif text-3xl">Thông báo</h2></div>
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
      </>}
    </div>
    </TaskDock>
  )
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">{eyebrow}</p><h2 id={id} className="mt-1 font-serif text-3xl">{title}</h2></div>
}

function ItemCard({ item, now }: { item: Item; now: number }) {
  const urgentNotice = (item.type === 'notice' || item.type === 'announcement') && item.priority === 'urgent'
  const overdue = !item.is_done && (item.type === 'task' || item.type === 'homework') && item.due_at !== null && Date.parse(item.due_at) < now
  const subjectStyle = !overdue && !urgentNotice ? subjectVars(item.subjects) : null
  return <DraggableTask item={item}><ItemLink href={itemHref(item)} draggable={false} className={`block min-w-0 rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${overdue ? 'border-red-200 bg-red-50 text-ink' : urgentNotice ? 'border-rose/50 bg-rose/10' : subjectStyle ? 'subject-surface' : 'border-oak/30 bg-white/65'}`} style={subjectStyle ?? undefined}>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full px-3 py-1 font-bold ${item.type === 'homework' ? 'border border-orange-800 bg-orange-700 text-white' : typeChip}`}>{typeLabel[item.type]}</span>
      {item.is_done && <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 font-bold text-emerald-800">Đã hoàn thành</span>}
      {overdue && <span className="rounded-full border border-red-600 bg-red-100 px-3 py-1 font-bold text-red-800">ĐÃ HẾT HẠN</span>}
      {item.due_at && !item.is_done && (item.type === 'task' || item.type === 'homework') && <span className={`rounded-full border px-3 py-1 font-bold ${overdue ? 'border-red-200 bg-red-100 text-red-800' : 'border-oak/30 bg-white/80 text-ink'}`}>{formatTimeLeft(Date.parse(item.due_at) - now, overdue)}</span>}
      {urgentNotice && <span className="rounded-full bg-rose px-3 py-1 font-semibold text-white">CẦN CHÚ Ý</span>}
      {!urgentNotice && item.priority !== 'normal' && <span className="rounded-full bg-oak/15 px-3 py-1 font-bold text-ink/70">{priorityLabel[item.priority]}</span>}
    </div>
    <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
    {item.description && <p className={`mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 ${overdue ? 'text-gray-600' : 'text-ink/65'}`}>{item.description}</p>}
    <div className={`mt-5 flex flex-wrap justify-between gap-2 border-t pt-4 text-xs ${overdue ? 'border-gray-500 text-gray-700' : 'border-oak/20 text-ink/60'}`}>
      <SubjectBadge names={item.subjects} />
      {item.due_at ? <time dateTime={item.due_at}>Hạn: {formatDate(item.due_at)}</time> : <time dateTime={item.updated_at}>Cập nhật: {formatDate(item.updated_at)}</time>}
    </div>
  </ItemLink></DraggableTask>
}

function RecentItem({ item }: { item: Item }) {
  return <DraggableTask item={item}><ItemLink href={itemHref(item)} draggable={false} className="flex flex-col justify-between gap-2 py-4 transition hover:text-rose sm:flex-row sm:items-center">
    <div className="min-w-0"><p className="text-xs text-rose">{typeLabel[item.type]}{subjectLabel(item.subjects) ? ` · ${subjectLabel(item.subjects)}` : ''}</p><h3 className="mt-1 truncate font-medium">{item.title}</h3></div>
    <time className="shrink-0 text-xs text-ink/55" dateTime={item.updated_at}>Cập nhật {formatDate(item.updated_at)}</time>
  </ItemLink></DraggableTask>
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

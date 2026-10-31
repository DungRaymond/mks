import { createPublicClient } from '@/lib/supabase/public'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import QuickTaskForm from './QuickTaskForm'
import Image from 'next/image'

type Item = {
  id: string
  type: 'task' | 'homework' | 'notice'
  title: string
  description: string | null
  subject: string | null
  priority: 'normal' | 'high' | 'urgent'
  due_at: string | null
  updated_at: string
}

const priorityLabel = { urgent: 'Khẩn cấp', high: 'Ưu tiên cao', normal: 'Bình thường' }
const typeLabel = { task: 'Task lớp', homework: 'Bài tập', notice: 'Chú ý' }
const typeChip = 'border border-oak/30 bg-white/70 text-ink/75'
const subjectColors: Record<string, string> = {
  'Lý - dược': 'border-blue-500 bg-blue-100 text-blue-950',
  'Toán': 'border-blue-500 bg-blue-100 text-blue-950',
  'Hóa': 'border-yellow-500 bg-yellow-100 text-yellow-950',
  'Hoá vô cơ - dược': 'border-yellow-500 bg-yellow-100 text-yellow-950',
  'Y sinh': 'border-cyan-500 bg-cyan-100 text-cyan-950',
  'Sinh': 'border-cyan-500 bg-cyan-100 text-cyan-950',
}

export default async function Home() {
  const supabase = createPublicClient()
  const now = new Date().toISOString()
  const [session, { data: dueData, error: dueError }, { data: overdueData, error: overdueError }, { data: recentData, error: recentError }] = await Promise.all([
    getSession(),
    supabase
      .from('class_items')
      .select('id, type, title, description, subject, priority, due_at, updated_at')
      .eq('is_published', true)
      .in('type', ['task', 'homework'])
      .gte('due_at', now)
      .order('priority', { ascending: false })
      .order('due_at', { ascending: true })
      .limit(5),
    supabase
      .from('class_items')
      .select('id, type, title, description, subject, priority, due_at, updated_at')
      .eq('is_published', true)
      .eq('is_done', false)
      .in('type', ['task', 'homework'])
      .lt('due_at', now)
      .order('due_at', { ascending: false })
      .limit(5),
    supabase
      .from('class_items')
      .select('id, type, title, description, subject, priority, due_at, updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(8),
  ])

  const dueSoon = (dueData ?? []) as Item[]
  const recentlyUpdated = (recentData ?? []) as Item[]

  return (
    <main className="min-h-screen bg-linen px-5 py-12 text-ink sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 border-b border-oak/30 pb-8 sm:mb-14">
          <Link href="/" className="mb-5 inline-flex" aria-label="Trang chính">
            <Image src="/logo.svg" alt="Biểu tượng viên nang" width={100} height={100} priority />
          </Link>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">Task, bài tập và thông báo mới nhất.</h1>
            </div>
            <Link href={session ? '/admin/new' : '/login'} className="w-fit rounded-full border border-oak/50 px-5 py-2.5 text-sm font-medium transition hover:bg-beige/60">{session ? 'Tạo task' : 'Cán bộ đăng nhập'}</Link>
          </div>
        </header>

        {dueError || overdueError || recentError ? (
          <p role="status" className="rounded-2xl border border-rose/30 bg-rose/10 p-5 text-sm">Chưa tải được dữ liệu lớp. Vui lòng thử tải lại.</p>
        ) : (
          <div className="space-y-14">
            {session && <QuickTaskForm />}
            <section aria-labelledby="due-title">
              <SectionHeading id="due-title" eyebrow="Cần chú ý" title="Ưu tiên" />
              {dueSoon.length ? <div className="grid gap-4 md:grid-cols-2">{dueSoon.map((item) => <ItemCard key={item.id} item={item} now={now} />)}</div> : <EmptyState text="Chưa có task hoặc bài tập sắp đến hạn." />}
            </section>
            <section aria-labelledby="overdue-title">
              <SectionHeading id="overdue-title" eyebrow="Cần xử lý" title="Đã hết hạn" />
              {overdueData?.length ? <div className="grid gap-4 md:grid-cols-2">{overdueData.map((item) => <ItemCard key={item.id} item={item as Item} now={now} />)}</div> : <EmptyState text="Không có task hoặc bài tập nào hết hạn." />}
            </section>
            <section aria-labelledby="recent-title">
              <SectionHeading id="recent-title" eyebrow="Mới cập nhật" title="Tin mới của lớp" />
              {recentlyUpdated.length ? <div className="divide-y divide-oak/25 rounded-2xl border border-oak/30 bg-white/55 px-5">{recentlyUpdated.map((item) => <RecentItem key={item.id} item={item} />)}</div> : <EmptyState text="Chưa có nội dung nào được đăng." />}
            </section>
          </div>
        )}
        <footer className="mt-16 border-t border-oak/30 pt-5 text-xs text-ink/50">Cập nhật lịch lớp tại một nơi.</footer>
      </div>
    </main>
  )
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">{eyebrow}</p><h2 id={id} className="mt-1 font-serif text-3xl">{title}</h2></div>
}

function ItemCard({ item, now }: { item: Item; now: string }) {
  const urgentNotice = item.type === 'notice' && item.priority === 'urgent'
  const overdue = item.due_at !== null && Date.parse(item.due_at) < Date.parse(now)
  const subjectColor = item.subject ? subjectColors[item.subject] : undefined
  return <Link href={`/items/${item.id}`} className={`block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${overdue ? 'border-red-600 bg-gray-400 text-gray-800' : urgentNotice ? 'border-rose/50 bg-rose/10' : subjectColor ?? 'border-oak/30 bg-white/65'}`}>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full px-3 py-1 font-bold ${overdue ? 'border border-gray-500 bg-gray-400 text-gray-800' : item.type === 'homework' ? 'border border-orange-800 bg-orange-700 text-white' : typeChip}`}>{typeLabel[item.type]}</span>
      {overdue && <span className="rounded-full border border-red-600 bg-red-100 px-3 py-1 font-bold text-red-800">ĐÃ HẾT HẠN</span>}
      {item.due_at && <span className={`rounded-full border px-3 py-1 font-bold ${overdue ? 'border-red-900 bg-red-700 text-white' : 'border-purple-900 bg-pink-300 text-purple-950'}`}>{formatTimeLeft(Date.parse(item.due_at) - Date.parse(now), overdue)}</span>}
      {urgentNotice && <span className="rounded-full bg-rose px-3 py-1 font-semibold text-white">CẦN CHÚ Ý</span>}
      {!urgentNotice && item.priority !== 'normal' && <span className="rounded-full bg-oak/15 px-3 py-1 font-bold text-ink/70">{priorityLabel[item.priority]}</span>}
    </div>
    <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
    {item.description && <p className={`mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 ${overdue ? 'text-gray-600' : 'text-ink/65'}`}>{item.description}</p>}
    <div className={`mt-5 flex flex-wrap justify-between gap-2 border-t pt-4 text-xs ${overdue ? 'border-gray-500 text-gray-700' : 'border-oak/20 text-ink/60'}`}>
      <span className={`rounded-full border px-3 py-1 font-bold ${overdue ? 'border-gray-500 bg-gray-400 text-gray-800' : subjectColors[item.subject ?? ''] ?? 'border-oak/30 bg-white/70'}`}>{item.subject ?? 'Cả lớp'}</span>
      <time dateTime={item.due_at!}>Hạn: {formatDate(item.due_at!)}</time>
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

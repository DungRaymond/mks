import { createPublicClient } from '@/lib/supabase/public'
import Link from 'next/link'

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
const subjectColors: Record<string, string> = {
  'Lý - dược': 'border-sky-300 bg-sky-50 text-sky-950',
  'Toán': 'border-violet-300 bg-violet-50 text-violet-950',
  'Hóa': 'border-emerald-300 bg-emerald-50 text-emerald-950',
  'Sinh': 'border-lime-300 bg-lime-50 text-lime-950',
}

export default async function Home() {
  const supabase = createPublicClient()
  const [{ data: dueData, error: dueError }, { data: recentData, error: recentError }] = await Promise.all([
    supabase
      .from('class_items')
      .select('id, type, title, description, subject, priority, due_at, updated_at')
      .eq('is_published', true)
      .in('type', ['task', 'homework'])
      .gte('due_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('due_at', { ascending: true })
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-rose">Class Hub</p>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-6xl">Lớp mình, chung một nhịp.</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-ink/65">Task, bài tập và thông báo mới nhất của lớp.</p>
            </div>
            <Link href="/login" className="w-fit rounded-full border border-oak/50 px-5 py-2.5 text-sm font-medium transition hover:bg-beige/60">Cán bộ đăng nhập</Link>
          </div>
        </header>

        {dueError || recentError ? (
          <p role="status" className="rounded-2xl border border-rose/30 bg-rose/10 p-5 text-sm">Chưa tải được dữ liệu lớp. Vui lòng thử tải lại.</p>
        ) : (
          <div className="space-y-14">
            <section aria-labelledby="due-title">
              <SectionHeading id="due-title" eyebrow="Cần chú ý" title="Ưu tiên, sắp đến hạn" />
              {dueSoon.length ? <div className="grid gap-4 md:grid-cols-2">{dueSoon.map((item) => <ItemCard key={item.id} item={item} />)}</div> : <EmptyState text="Chưa có task hoặc bài tập sắp đến hạn." />}
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

function ItemCard({ item }: { item: Item }) {
  const urgentNotice = item.type === 'notice' && item.priority === 'urgent'
  const subjectColor = item.subject ? subjectColors[item.subject] : undefined
  return <Link href={`/items/${item.id}`} className={`block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${urgentNotice ? 'border-rose/50 bg-rose/10' : subjectColor ?? 'border-oak/30 bg-white/65'}`}>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-beige px-3 py-1 text-ink/75">{typeLabel[item.type]}</span>
      {urgentNotice && <span className="rounded-full bg-rose px-3 py-1 font-semibold text-white">CẦN CHÚ Ý</span>}
      {!urgentNotice && item.priority !== 'normal' && <span className="rounded-full bg-oak/15 px-3 py-1 text-ink/70">{priorityLabel[item.priority]}</span>}
    </div>
    <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
    {item.description && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-ink/65">{item.description}</p>}
    <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-oak/20 pt-4 text-xs text-ink/60">
      <span>{item.subject ?? 'Cả lớp'}</span>
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
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

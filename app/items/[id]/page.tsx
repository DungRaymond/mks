import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createPublicClient } from '@/lib/supabase/public'

type Item = {
  id: string
  type: 'task' | 'homework' | 'notice'
  title: string
  description: string | null
  subject: string | null
  priority: 'normal' | 'high' | 'urgent'
  due_at: string | null
  is_done: boolean
  updated_at: string
}

const typeLabels = { task: 'Task lớp', homework: 'Bài tập', notice: 'Thông báo' }
const subjectColors: Record<string, string> = {
  'Lý - dược': 'border-blue-500 bg-blue-100 text-blue-950',
  Toán: 'border-blue-500 bg-blue-100 text-blue-950',
  Hóa: 'border-yellow-500 bg-yellow-100 text-yellow-950',
  'Hóa vô cơ - dược': 'border-yellow-500 bg-yellow-100 text-yellow-950',
  'Modul Y sinh': 'border-cyan-500 bg-cyan-100 text-cyan-950',
  'Y sinh': 'border-cyan-500 bg-cyan-100 text-cyan-950',
  Sinh: 'border-cyan-500 bg-cyan-100 text-cyan-950',
}

async function getItem(id: string) {
  const { data } = await createPublicClient()
    .from('class_items')
    .select('id, type, title, description, subject, priority, due_at, is_done, updated_at')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()
  return data as Item | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const item = await getItem(id)
  if (!item) return { title: 'Không tìm thấy nội dung | Class Hub' }

  const description = item.description?.trim()
    || `${typeLabels[item.type]}${item.subject ? ` môn ${item.subject}` : ''}${item.due_at ? ` · Hạn ${formatDate(item.due_at)}` : ''}`
  const title = `${item.title} | Class Hub`
  const url = `/items/${item.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: item.title,
      description,
      url,
      siteName: 'Class Hub',
      locale: 'vi_VN',
      modifiedTime: item.updated_at,
    },
    twitter: { card: 'summary', title: item.title, description },
  }
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [item, session] = await Promise.all([getItem(id), getSession()])
  if (!item) notFound()

  const urgent = item.type === 'notice' && item.priority === 'urgent'

  return (
    <main className="min-h-screen bg-linen px-5 py-10 text-ink sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-oak/40 bg-white/70 px-4 text-sm font-medium text-ink shadow-sm transition hover:border-rose hover:bg-rose/5">← Trang chính</Link>
          {session && <div className="flex gap-2"><Link href="/admin/new" className="inline-flex min-h-11 items-center rounded-xl border border-oak/40 bg-white/70 px-4 text-sm font-medium text-ink shadow-sm transition hover:border-rose hover:bg-rose/5">Tạo nội dung</Link>{['admin', 'officer'].includes(session.profile.role) && <Link href={`/items/${id}/edit`} className="inline-flex min-h-11 items-center rounded-xl border border-oak/40 bg-white/70 px-4 text-sm font-medium text-ink shadow-sm transition hover:border-rose hover:bg-rose/5">Sửa</Link>}</div>}
        </div>
        <div className={`mt-8 rounded-3xl border p-6 shadow-sm sm:p-10 ${urgent ? 'border-rose/45 bg-rose/10' : 'border-oak/30 bg-white/65'}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-3 py-1 font-bold ${item.type === 'homework' ? 'border border-orange-800 bg-orange-700 text-white' : 'border border-oak/30 bg-white/70 text-ink/75'}`}>{typeLabels[item.type]}</span>
            {item.subject && <span className={`rounded-full border px-3 py-1 font-bold ${subjectColors[item.subject] ?? 'border-oak/30 bg-white/70 text-ink'}`}>{item.subject}</span>}
            {urgent && <span className="rounded-full bg-rose px-3 py-1 font-bold text-white">CẦN CHÚ Ý ĐẶC BIỆT</span>}
          </div>
          <h1 className="mt-6 font-serif text-3xl font-medium leading-tight sm:text-5xl">{item.title}</h1>
          {item.description && <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-ink/80">{item.description}</p>}
          <dl className="mt-8 grid gap-4 border-t border-oak/25 pt-6 text-sm sm:grid-cols-2">
            {item.due_at && <div><dt className="text-xs text-ink/55">Hạn hoàn thành</dt><dd className="mt-1 font-medium">{formatDate(item.due_at)}</dd></div>}
            <div><dt className="text-xs text-ink/55">Cập nhật lần cuối</dt><dd className="mt-1 font-medium">{formatDate(item.updated_at)}</dd></div>
            {item.type === 'task' && <div><dt className="text-xs text-ink/55">Trạng thái</dt><dd className="mt-1 font-medium">{item.is_done ? 'Đã hoàn thành' : 'Chưa hoàn thành'}</dd></div>}
          </dl>
        </div>
      </article>
    </main>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

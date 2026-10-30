import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'
import { signOut } from '@/app/login/signout'

type Item = {
  id: string
  title: string
  type: 'task' | 'homework' | 'notice'
  subject: string | null
  due_at: string | null
  is_published: boolean
  is_done: boolean
  updated_at: string
}

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=%2Fadmin')
  if (!['admin', 'officer'].includes(session.profile.role)) redirect('/')

  const { data } = await createAdminClient()
    .from('class_items')
    .select('id, title, type, subject, due_at, is_published, is_done, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  const items = (data ?? []) as Item[]

  return (
    <main className="min-h-screen bg-linen px-5 py-10 text-ink sm:px-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-oak/30 pb-6">
          <div>
            <Link href="/" className="text-sm text-ink/60 hover:text-ink">← Trang chủ</Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-rose">Quản lý lớp</p>
            <h1 className="mt-1 font-serif text-4xl">Xin chào, {session.profile.full_name}</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/new" className="inline-flex h-11 items-center rounded-xl bg-ink px-5 text-sm font-medium text-linen hover:bg-ink/85">+ Tạo task</Link>
            <form action={signOut}><button className="h-11 rounded-xl border border-oak/45 px-4 text-sm hover:bg-beige/50">Đăng xuất</button></form>
          </div>
        </header>

        <section aria-labelledby="items-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="items-title" className="font-serif text-2xl">Nội dung lớp</h2>
            <span className="text-sm text-ink/55">{items.length} mục</span>
          </div>
          {items.length ? (
            <div className="divide-y divide-oak/25 rounded-2xl border border-oak/30 bg-white/65 px-5">
              {items.map((item) => <Link key={item.id} href={`/items/${item.id}`} className="flex flex-col justify-between gap-3 py-4 transition-colors hover:text-rose focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="mt-1 text-xs text-ink/55">{item.subject ?? 'Chưa phân môn'} · {item.type === 'task' ? `Task · ${item.is_done ? 'Hoàn thành' : 'Chưa hoàn thành'}` : item.type === 'homework' ? 'Bài tập về nhà' : 'Thông báo'}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink/55">
                  <span>{item.is_published ? 'Công khai' : 'Bản nháp'}</span>
                  {item.due_at && <time dateTime={item.due_at}>Hạn {formatDate(item.due_at)}</time>}
                </div>
              </Link>)}
            </div>
          ) : <p className="rounded-2xl border border-dashed border-oak/40 p-8 text-sm text-ink/55">Chưa có nội dung. Tạo task đầu tiên.</p>}
        </section>
      </div>
    </main>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
}

import { createPublicClient } from '@/lib/supabase/public'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import QuickTaskForm from './QuickTaskForm'
import HomeFeed from './HomeFeed'
import Image from 'next/image'
import { ITEM_FIELDS, type Item } from '@/lib/items'

export default async function Home() {
  const now = new Date().toISOString()
  const [session, { data, error }] = await Promise.all([
    getSession(),
    createPublicClient()
      .from('class_items')
      .select(ITEM_FIELDS)
      .eq('is_published', true)
      .order('updated_at', { ascending: false }),
  ])

  const items = (data ?? []) as Item[]

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

        {error ? (
          <p role="status" className="rounded-2xl border border-rose/30 bg-rose/10 p-5 text-sm">Chưa tải được dữ liệu lớp. Vui lòng thử tải lại.</p>
        ) : (
          <div className="space-y-14">
            {session && <QuickTaskForm />}
            <HomeFeed initialItems={items} initialNow={now} />
          </div>
        )}
        <footer className="mt-16 border-t border-oak/30 pt-5 text-xs text-ink/50">Cập nhật lịch lớp tại một nơi.</footer>
      </div>
    </main>
  )
}

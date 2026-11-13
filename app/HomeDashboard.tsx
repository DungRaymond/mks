'use client'

import Link from 'next/link'
import HomeFeed from './HomeFeed'
import Image from 'next/image'
import { useViewer } from '@/lib/viewer'

export default function HomeDashboard({ initialNow }: { initialNow: string }) {
  const viewer = useViewer()
  const session = viewer?.authenticated

  return (
    <main id="main-content" className="min-h-screen bg-linen px-4 py-6 text-ink sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-2 rounded-2xl border border-oak/30 bg-white/60 p-3 sm:gap-4 sm:p-5">
          <h1 className="sr-only">Class Hub — Nội dung lớp</h1>
          <Link href="/" className="inline-flex shrink-0 items-center gap-3" aria-label="Class Hub — Trang chính">
            <Image src="/logo.svg" alt="" width={44} height={44} priority className="size-9 sm:size-11" />
            <span className="hidden text-sm font-bold tracking-[0.16em] sm:inline">CLASS HUB</span>
          </Link>
          <nav aria-label="Quản lý nội dung lớp" className="flex items-center gap-2">
            {session && <Link href="/admin" className="nav-button whitespace-nowrap px-2 text-xs sm:px-4 sm:text-sm">Quản lý lớp</Link>}
            <Link href={session ? '/admin/new' : '/login'} className="nav-button whitespace-nowrap bg-ink px-2 text-xs text-linen hover:bg-ink/85 sm:px-4 sm:text-sm">{session ? '+ Tạo nội dung' : 'Cán bộ đăng nhập'}</Link>
          </nav>
        </header>

        <HomeFeed initialNow={initialNow} canManage={viewer?.canManage ?? false} />
        <footer className="mt-16 border-t border-oak/30 pt-5 text-xs text-ink/50">Cập nhật lịch lớp tại một nơi.</footer>
      </div>
    </main>
  )
}

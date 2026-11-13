import HomeButton from '@/components/HomeButton'

export default function ItemLoading() {
  return <main className="min-h-screen bg-linen px-5 py-10 text-ink sm:px-8 sm:py-16">
    <div className="mx-auto max-w-3xl">
      <HomeButton />
      <div role="status" aria-label="Đang tải nội dung" className="mt-8 animate-pulse rounded-3xl border border-oak/30 bg-white/65 p-6 sm:p-10">
        <span className="sr-only">Đang tải nội dung…</span>
        <div aria-hidden="true" className="space-y-6"><div className="h-6 w-28 rounded-full bg-oak/20" /><div className="h-10 w-4/5 rounded-xl bg-oak/20" /><div className="h-32 rounded-xl bg-oak/10" /></div>
      </div>
    </div>
  </main>
}

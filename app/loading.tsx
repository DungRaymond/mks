export default function Loading() {
  return (
    <main className="min-h-screen bg-linen px-5 py-12 text-ink sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="mb-12 border-b border-oak/30 pb-8 sm:mb-14">
          <div className="mb-5 h-[100px] w-[100px] rounded-2xl bg-oak/15" />
          <div className="h-9 w-3/4 rounded-xl bg-oak/15" />
        </div>
        <div className="space-y-14">
          {[0, 1, 2].map((section) => (
            <div key={section}>
              <div className="mb-5 h-8 w-48 rounded-lg bg-oak/15" />
              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1].map((card) => <div key={card} className="h-44 rounded-2xl border border-oak/20 bg-white/50" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
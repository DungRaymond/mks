import { signIn } from './actions'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

const errors: Record<string, string> = {
  credentials: 'Tên đăng nhập hoặc mật khẩu không đúng.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  if (await getSession()) redirect(params.next?.startsWith('/admin') ? params.next : '/admin')

  return (
    <main className="grid min-h-screen place-items-center bg-linen px-5 py-12 text-ink">
      <section className="w-full max-w-md rounded-3xl border border-oak/30 bg-white/70 p-7 shadow-sm sm:p-9">
        <Link href="/" className="text-sm font-medium uppercase tracking-[0.2em] text-rose">Class Hub</Link>
        <h1 className="mt-5 font-serif text-3xl">Đăng nhập cán bộ</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">Dùng tài khoản được cấp bởi quản trị viên lớp.</p>
        {params.error && errors[params.error] && (
          <p role="alert" className="mt-5 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose">{errors[params.error]}</p>
        )}
        <form action={signIn} className="mt-7 space-y-4">
          <input type="hidden" name="next" value={params.next ?? '/admin'} />
          <label className="block text-sm font-medium">
            Tên đăng nhập
            <input required type="text" name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]{3,32}" className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-4 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
          </label>
          <label className="block text-sm font-medium">
            Mật khẩu
            <input required type="password" name="password" autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-4 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
          </label>
          <button className="h-12 w-full rounded-xl bg-ink px-4 font-medium text-linen transition hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose">
            Đăng nhập
          </button>
        </form>
      </section>
    </main>
  )
}

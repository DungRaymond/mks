'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Không thể đăng nhập.')

      const nextPath = new URLSearchParams(window.location.search).get('next')
      router.replace(nextPath?.startsWith('/') ? nextPath : '/')
      router.refresh()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Đã có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f4f0] px-4 py-10 text-[#1a1a19] dark:bg-[#1c1c1a] dark:text-[#e8e6df]">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#534ab7]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#8a82dd]/10 blur-3xl" />

      <section className="relative w-full max-w-sm rounded-3xl border border-black/10 bg-white p-7 shadow-[0_24px_80px_rgba(40,36,28,0.12)] dark:border-white/10 dark:bg-[#272725] dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-[#534ab7] text-xl font-semibold text-white shadow-[0_8px_24px_rgba(83,74,183,0.3)]">
          L
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#534ab7] dark:text-[#aaa5ed]">Khu vực giáo viên</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Đăng nhập quản lý lớp</h1>
        <p className="mt-2 text-sm leading-6 text-[#77766f] dark:text-[#aaa9a2]">Nhập mật khẩu giáo viên để tiếp tục.</p>

        <form onSubmit={login} className="mt-7">
          <label className="block text-xs font-semibold text-[#5f5e5a] dark:text-[#c4c2b9]">
            Mật khẩu
            <input
              autoFocus
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              className="mt-2 h-12 w-full rounded-xl border border-black/15 bg-[#fbfbf9] px-4 text-sm font-normal outline-none transition focus:border-[#534ab7] focus:ring-4 focus:ring-[#534ab7]/10 dark:border-white/15 dark:bg-[#20201e]"
            />
          </label>

          {error && <p className="mt-3 rounded-xl bg-[#fcebeb] px-3 py-2.5 text-xs text-[#a32d2d] dark:bg-[#4a2929] dark:text-[#ffb4b4]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 h-12 w-full rounded-xl bg-[#534ab7] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(83,74,183,0.22)] transition hover:-translate-y-0.5 hover:bg-[#433b9c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  )
}

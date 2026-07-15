'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="h-11 rounded-xl border border-black/15 bg-white px-4 text-sm font-semibold text-[#65645e] transition hover:bg-[#ebe9e2] disabled:opacity-50 dark:border-white/15 dark:bg-[#272725] dark:text-[#c4c2b9] dark:hover:bg-[#353533]"
    >
      {loading ? 'Đang thoát...' : 'Đăng xuất'}
    </button>
  )
}

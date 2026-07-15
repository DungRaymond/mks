'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import StudentModal from '@/components/StudentModal'
import LogoutButton from '@/components/LogoutButton'
import type { StudentSummary } from '@/lib/types'

type Ripple = { x: number; y: number; key: number }

export default function AdminPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentSummary | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [ripples, setRipples] = useState<Record<string, Ripple>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    async function loadStudents() {
      try {
        const response = await fetch('/api/students')
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Không thể tải danh sách học viên.')
        if (active) setStudents(result as StudentSummary[])
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Đã có lỗi xảy ra.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStudents()
    return () => { active = false }
  }, [])

  useEffect(() => {
    function closeSearch(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', closeSearch)
    return () => document.removeEventListener('mousedown', closeSearch)
  }, [])

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    if (!normalizedQuery) return students
    return students.filter((student) =>
      student.name.toLocaleLowerCase('vi').includes(normalizedQuery),
    )
  }, [query, students])

  const collectedTuition = students.reduce(
    (total, student) => total + (student.paid ? (student.tuition_fee ?? 0) : 0),
    0,
  )
  const totalLessons = students.reduce((total, student) => total + student.attended, 0)

  function openCalendar(id: string) {
    setSearchOpen(false)
    router.push(`/students/${id}`)
  }

  function saveStudent(student: StudentSummary) {
    setStudents((current) => {
      const exists = current.some((item) => item.id === student.id)
      const next = exists
        ? current.map((item) => item.id === student.id ? student : item)
        : [...current, student]
      return next.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    })
  }

  async function deleteStudent(student: StudentSummary) {
    if (!window.confirm(`Xóa học viên ${student.name} và toàn bộ lịch học?`)) return
    setDeletingId(student.id)
    setError(null)
    try {
      const response = await fetch(`/api/students/${student.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error ?? 'Không thể xóa học viên.')
      }
      setStudents((current) => current.filter((item) => item.id !== student.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Đã có lỗi xảy ra.')
    } finally {
      setDeletingId(null)
    }
  }

  function showRipple(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const rect = event.currentTarget.getBoundingClientRect()
    setRipples((current) => ({
      ...current,
      [id]: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        key: Date.now(),
      },
    }))
  }

  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 py-10 text-[#1a1a19] dark:bg-[#1c1c1a] dark:text-[#e8e6df] sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#534ab7] dark:text-[#aaa5ed]">
              Quản lý lớp học
            </p>
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Học viên &amp; lịch học</h1>
            <p className="mt-2 text-sm text-[#77766f] dark:text-[#aaa9a2]">
              Theo dõi buổi học và tình trạng học phí tại một nơi.
            </p>
          </div>
          <div className="flex gap-2">
            <LogoutButton />
            <button
              type="button"
              onClick={() => { setEditingStudent(null); setModalOpen(true) }}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#534ab7] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(83,74,183,0.22)] transition hover:bg-[#433b9c]"
            >
              <span className="mr-2 text-lg leading-none">+</span> Thêm học viên
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Tổng quan">
          <SummaryCard label="Tổng học viên" value={students.length} />
          <SummaryCard label="Học phí đã thu" value={formatCurrency(collectedTuition)} accent="green" />
          <SummaryCard label="Tổng buổi đã học" value={totalLessons} accent="purple" />
        </section>

        <section className="mb-6 rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#272725] sm:p-5">
          <label className="mb-2 block text-xs font-semibold text-[#66655f] dark:text-[#b4b2a9]">
            Chọn học viên để xem lịch
          </label>
          <div ref={searchRef} className="relative max-w-xl">
            <div className="flex h-12 items-center rounded-xl border border-black/15 bg-[#fbfbf9] px-4 transition focus-within:border-[#534ab7] focus-within:ring-2 focus-within:ring-[#534ab7]/10 dark:border-white/15 dark:bg-[#20201e]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-3 h-5 w-5 fill-none stroke-[#888780]" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
              </svg>
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Tìm theo tên học viên..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#aaa9a2]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="ml-2 text-sm text-[#888780] hover:text-[#1a1a19] dark:hover:text-white"
                  aria-label="Xóa tìm kiếm"
                >
                  ×
                </button>
              )}
            </div>

            {searchOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-black/10 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#2c2c2a]">
                {filteredStudents.length > 0 ? filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => openCalendar(student.id)}
                    className="student-option flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition duration-200 hover:-translate-y-px hover:bg-[#f2f1ec] hover:shadow-sm dark:hover:bg-[#3a3a38]"
                  >
                    <span className="text-sm font-medium">{student.name}</span>
                    <PaymentBadge paid={student.paid} tuitionFee={student.tuition_fee} />
                  </button>
                )) : (
                  <p className="px-3 py-4 text-center text-sm text-[#888780]">
                    {loading ? 'Đang tải...' : 'Không tìm thấy học viên.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#272725]">
          <div className="flex items-center justify-between border-b border-black/8 px-5 py-4 dark:border-white/8">
            <div>
              <h2 className="text-lg font-medium">Tình trạng học viên</h2>
              <p className="mt-1 text-xs text-[#888780]">Nhấn vào một học viên để mở lịch học.</p>
            </div>
            <span className="rounded-full bg-[#f1f0eb] px-3 py-1 text-xs text-[#6f6e68] dark:bg-[#363634] dark:text-[#b4b2a9]">
              {students.length} học viên
            </span>
          </div>

          {error && (
            <div className="m-5 rounded-xl bg-[#fcebeb] px-4 py-3 text-sm text-[#a32d2d] dark:bg-[#4a2929] dark:text-[#ffb4b4]">
              {error}
            </div>
          )}

          {!error && loading ? (
            <div className="px-5 py-12 text-center text-sm text-[#888780]">Đang tải danh sách...</div>
          ) : students.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#efedf9] text-xl text-[#534ab7]">+</div>
              <h3 className="text-sm font-semibold">Chưa có học viên</h3>
              <p className="mt-1 text-xs text-[#888780]">Thêm học viên đầu tiên để bắt đầu ghi lịch học.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/8 dark:divide-white/8">
              {students.map((student) => {
                const remaining = Math.max(0, student.lesson_limit - student.attended)
                return (
                  <div
                    key={student.id}
                    className="relative isolate grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 overflow-hidden px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#faf9f6] hover:shadow-[0_8px_24px_rgba(45,42,35,0.08)] dark:hover:bg-[#2f2f2d] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:grid-cols-[minmax(0,1fr)_130px_150px_76px]"
                  >
                    <button
                      type="button"
                      onPointerDown={(event) => showRipple(event, student.id)}
                      onClick={() => openCalendar(student.id)}
                      className="relative z-10 min-w-0 overflow-hidden rounded-lg px-2 py-2 text-left transition-all duration-200 hover:translate-x-0.5 hover:bg-[#f1f0eb] dark:hover:bg-[#383836]"
                    >
                      {ripples[student.id] && (
                        <span
                          key={ripples[student.id].key}
                          className="student-ripple"
                          style={{ left: ripples[student.id].x, top: ripples[student.id].y }}
                        />
                      )}
                      <span className="relative z-10 block truncate text-sm font-semibold">{student.name}</span>
                      <span className="relative z-10 mt-1 block text-xs text-[#888780]">Tham gia {formatDate(student.created_at)}</span>
                    </button>
                    <div className="relative z-10 hidden sm:block">
                      <p className="text-sm font-medium">{student.attended}/{student.lesson_limit} buổi</p>
                      <p className="mt-1 text-xs text-[#888780]">Còn {remaining} buổi</p>
                    </div>
                    <div className="relative z-10 text-right">
                      <PaymentBadge paid={student.paid} tuitionFee={student.tuition_fee} />
                    </div>
                    <div className="relative z-10 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => { setEditingStudent(student); setModalOpen(true) }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#77766f] transition hover:bg-[#ebe9f7] hover:text-[#534ab7] dark:text-[#b4b2a9] dark:hover:bg-[#3b3655]"
                        aria-label={`Sửa ${student.name}`}
                        title="Sửa"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m14.5 6.5 3 3" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStudent(student)}
                        disabled={deletingId === student.id}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#888780] transition hover:bg-[#fcebeb] hover:text-[#a32d2d] disabled:opacity-40 dark:hover:bg-[#4a2929] dark:hover:text-[#ffb4b4]"
                        aria-label={`Xóa ${student.name}`}
                        title="Xóa"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <StudentModal
          student={editingStudent}
          onClose={() => { setModalOpen(false); setEditingStudent(null) }}
          onSaved={saveStudent}
        />
      )}
    </main>
  )
}

function SummaryCard({ label, value, accent = 'neutral' }: {
  label: string
  value: number | string
  accent?: 'neutral' | 'green' | 'purple'
}) {
  const colors = {
    neutral: 'bg-[#f1f0eb] text-[#575650] dark:bg-[#383836] dark:text-[#d5d3ca]',
    green: 'bg-[#eaf3de] text-[#3b6d11] dark:bg-[#29401d] dark:text-[#b9df91]',
    purple: 'bg-[#efedf9] text-[#534ab7] dark:bg-[#35304f] dark:text-[#bbb5ff]',
  }

  return (
    <article className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#272725]">
      <div className={`grid min-h-11 min-w-11 place-items-center rounded-xl px-3 font-semibold ${
        typeof value === 'string' ? 'text-sm' : 'text-lg'
      } ${colors[accent]}`}>
        {value}
      </div>
      <p className="text-sm text-[#6f6e68] dark:text-[#b4b2a9]">{label}</p>
    </article>
  )
}

function PaymentBadge({ paid, tuitionFee }: { paid: boolean; tuitionFee?: number }) {
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        paid
          ? 'bg-[#eaf3de] text-[#3b6d11] dark:bg-[#29401d] dark:text-[#b9df91]'
          : 'bg-[#faeeda] text-[#854f0b] dark:bg-[#4b3820] dark:text-[#f2c47f]'
      }`}>
        {paid ? 'Đã đóng tiền' : 'Chưa đóng tiền'}
      </span>
      <span className="whitespace-nowrap text-xs font-semibold text-[#5f5e5a] dark:text-[#c4c2b9]">
        {formatCurrency(tuitionFee ?? 0)}
      </span>
    </span>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'không rõ ngày'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

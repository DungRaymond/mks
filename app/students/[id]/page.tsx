'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { StudentCalendarData } from '@/lib/types'

const MONTHS_DATA = [
  { name: 'Tháng 5/2026', year: 2026, month: 4 },
  { name: 'Tháng 6/2026', year: 2026, month: 5 },
]

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function StudentCalendarPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<StudentCalendarData | null>(null)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [busyDates, setBusyDates] = useState<Set<string>>(new Set())
  const [clearing, setClearing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadCalendar() {
      try {
        const response = await fetch(`/api/students/${encodeURIComponent(id)}`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Không thể tải lịch học.')
        if (!active) return
        const calendarData = result as StudentCalendarData
        setData(calendarData)
        setSelectedDates(new Set(calendarData.attendance.map((lesson) => lesson.date)))
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Đã có lỗi xảy ra.')
      } finally {
        if (active) setLoading(false)
      }
    }

    if (id) loadCalendar()
    return () => { active = false }
  }, [id])

  async function toggleDate(key: string) {
    if (busyDates.has(key)) return

    const wasSelected = selectedDates.has(key)
    setBusyDates((current) => new Set(current).add(key))
    setSelectedDates((current) => {
      const next = new Set(current)
      if (wasSelected) next.delete(key)
      else next.add(key)
      return next
    })
    setError(null)

    try {
      const response = await fetch('/api/attendance', {
        method: wasSelected ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: id, date: key }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error ?? 'Không thể cập nhật buổi học.')
      }
    } catch (updateError) {
      setSelectedDates((current) => {
        const rollback = new Set(current)
        if (wasSelected) rollback.add(key)
        else rollback.delete(key)
        return rollback
      })
      setError(updateError instanceof Error ? updateError.message : 'Đã có lỗi xảy ra.')
    } finally {
      setBusyDates((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function clearAll() {
    if (selectedDates.size === 0 || clearing) return
    const previousDates = new Set(selectedDates)
    setClearing(true)
    setSelectedDates(new Set())
    setError(null)

    try {
      const response = await fetch('/api/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: id }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error ?? 'Không thể xóa lịch học.')
      }
    } catch (clearError) {
      setSelectedDates(previousDates)
      setError(clearError instanceof Error ? clearError.message : 'Đã có lỗi xảy ra.')
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f4f0] text-sm text-[#888780] dark:bg-[#1c1c1a]">Đang tải lịch học...</main>
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f4f0] px-4 dark:bg-[#1c1c1a]">
        <div className="text-center">
          <p className="text-sm text-[#a32d2d] dark:text-[#ffb4b4]">{error ?? 'Không tìm thấy học viên.'}</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#534ab7] dark:text-[#aaa5ed]">← Về trang quản lý</Link>
        </div>
      </main>
    )
  }

  const attended = selectedDates.size
  const remaining = Math.max(0, data.student.lesson_limit - attended)
  const progress = data.student.lesson_limit > 0
    ? Math.min(100, (attended / data.student.lesson_limit) * 100)
    : 0
  const now = new Date()

  return (
    <main className="min-h-screen w-full bg-[#f5f4f0] px-4 py-8 text-[#1a1a19] transition-colors duration-200 dark:bg-[#1c1c1a] dark:text-[#e8e6df]">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#534ab7] hover:underline dark:text-[#aaa5ed]">← Trang quản lý</Link>
          <div className="text-right">
            <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              data.student.paid
                ? 'bg-[#eaf3de] text-[#3b6d11] dark:bg-[#29401d] dark:text-[#b9df91]'
                : 'bg-[#faeeda] text-[#854f0b] dark:bg-[#4b3820] dark:text-[#f2c47f]'
            }`}>
              {data.student.paid ? 'Đã đóng tiền' : 'Chưa đóng tiền'}
            </span>
            <p className="mt-1 text-xs font-semibold text-[#5f5e5a] dark:text-[#c4c2b9]">
              {new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND',
                maximumFractionDigits: 0,
              }).format(data.student.tuition_fee ?? 0)}
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#272725]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#888780]">Lịch học của</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">{data.student.name}</h1>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="text-3xl font-semibold text-[#534ab7] dark:text-[#aaa5ed]">{remaining}</span>
              <span className="ml-2 text-sm text-[#77766f] dark:text-[#aaa9a2]">buổi còn lại / {data.student.lesson_limit}</span>
            </div>
            <span className="text-xs text-[#888780]">Đã học {attended} buổi</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
            <div className="h-full rounded-full bg-[#534ab7] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <header className="mb-6 flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-xl font-medium tracking-tight">Lịch tháng 5 – 6/2026</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearAll}
              disabled={clearing || selectedDates.size === 0}
              className="border-none bg-transparent text-[13px] text-[#888780] underline underline-offset-[3px] transition-colors hover:text-[#1a1a19] disabled:cursor-default disabled:opacity-50 dark:hover:text-[#e8e6df]"
            >
              {clearing ? 'đang xóa...' : 'xóa tất cả'}
            </button>
            <div className="rounded-lg border border-black/20 bg-white px-3.5 py-1.5 text-sm shadow-sm dark:border-white/15 dark:bg-[#2c2c2a]">
              <span className="text-base font-semibold">{attended}</span> buổi đã chọn
            </div>
          </div>
        </header>

        {error && (
          <p className="mb-4 rounded-xl bg-[#fcebeb] px-4 py-3 text-sm text-[#a32d2d] dark:bg-[#4a2929] dark:text-[#ffb4b4]">{error}</p>
        )}

        <div className="flex flex-col gap-6">
          {MONTHS_DATA.map(({ name, year, month }) => {
            const firstDay = firstDayOfMonth(year, month)
            const totalDays = daysInMonth(year, month)

            return (
              <section key={name}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#888780] dark:text-[#77766f]">{name}</h3>
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {DAY_LABELS.map((label) => (
                    <div key={label} className="py-0.5 text-center text-[11px] text-[#b4b2a9] dark:text-[#77766f]">{label}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }, (_, index) => (
                    <div key={`empty-${index}`} className="aspect-square border-transparent bg-transparent" />
                  ))}
                  {Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => {
                    const key = dateKey(year, month, day)
                    const selected = selectedDates.has(key)
                    const today = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day
                    const busy = busyDates.has(key)

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleDate(key)}
                        disabled={busy || clearing}
                        aria-pressed={selected}
                        aria-label={`${name} ngày ${day}${selected ? ', đã học' : ''}`}
                        className={`flex aspect-square select-none items-center justify-center rounded-lg border text-[13px] outline-none transition-all duration-100 disabled:cursor-wait disabled:opacity-60 ${
                          selected
                            ? 'border-[#534ab7] bg-[#534ab7] font-medium text-white hover:bg-[#433b9c]'
                            : 'border-black/12 bg-white text-[#1a1a19] hover:border-black/25 hover:bg-[#f1efe8] dark:border-white/10 dark:bg-[#2c2c2a] dark:text-[#e8e6df] dark:hover:border-white/20 dark:hover:bg-[#3a3a38]'
                        } ${today && !selected ? 'border-[#534ab7] dark:border-[#534ab7]' : ''}`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-[#888780]">
          Chọn một ngày để ghi nhận buổi học. Chọn lại ngày đã đánh dấu để xóa buổi học.
        </p>
      </div>
    </main>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import type { StudentSummary } from '@/lib/types'

type Props = {
  student?: StudentSummary | null
  onClose: () => void
  onSaved: (student: StudentSummary) => void
}

export default function StudentModal({ student, onClose, onSaved }: Props) {
  const editing = Boolean(student)
  const [name, setName] = useState(student?.name ?? '')
  const [lessonLimit, setLessonLimit] = useState(student?.lesson_limit ?? 10)
  const [tuitionFee, setTuitionFee] = useState(student?.tuition_fee ?? 1800000)
  const [paid, setPaid] = useState(student?.paid ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || lessonLimit < 1 || tuitionFee < 0) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(editing ? `/api/students/${student?.id}` : '/api/students', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          lesson_limit: lessonLimit,
          tuition_fee: tuitionFee,
          paid,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Không thể lưu học viên.')
      onSaved({
        ...(result as StudentSummary),
        attended: student?.attended ?? (result as StudentSummary).attended ?? 0,
      })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Đã có lỗi xảy ra.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 text-[#1a1a19] shadow-2xl dark:bg-[#2c2c2a] dark:text-[#e8e6df]"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#534ab7] dark:text-[#aaa5ed]">
              {editing ? 'Cập nhật thông tin' : 'Học viên mới'}
            </p>
            <h2 id="student-modal-title" className="text-xl font-medium">
              {editing ? 'Sửa học viên' : 'Thêm vào lớp học'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f0eb] text-[#77766f] hover:bg-[#e5e3db] dark:bg-[#3a3a38] dark:text-[#c4c2b9]">×</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-semibold text-[#5f5e5a] dark:text-[#c4c2b9]">
            Họ và tên
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Nguyễn Minh Anh"
              className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-[#fbfbf9] px-3 text-sm font-normal outline-none transition focus:border-[#534ab7] focus:ring-2 focus:ring-[#534ab7]/10 dark:border-white/15 dark:bg-[#222220]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-[#5f5e5a] dark:text-[#c4c2b9]">
              Số buổi
              <input
                required
                type="number"
                min={1}
                value={lessonLimit}
                onChange={(event) => setLessonLimit(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-[#fbfbf9] px-3 text-sm font-normal outline-none transition focus:border-[#534ab7] dark:border-white/15 dark:bg-[#222220]"
              />
            </label>

            <label className="block text-xs font-semibold text-[#5f5e5a] dark:text-[#c4c2b9]">
              Học phí
              <div className="relative mt-2">
                <input
                  required
                  type="number"
                  min={0}
                  step={50000}
                  value={tuitionFee}
                  onChange={(event) => setTuitionFee(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-black/15 bg-[#fbfbf9] px-3 pr-11 text-sm font-normal outline-none transition focus:border-[#534ab7] dark:border-white/15 dark:bg-[#222220]"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#888780]">VNĐ</span>
              </div>
            </label>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 px-4 py-3 dark:border-white/10">
            <span>
              <span className="block text-sm font-medium">Đã đóng học phí</span>
              <span className="mt-0.5 block text-xs text-[#888780]">Đánh dấu nếu đã thanh toán đủ.</span>
            </span>
            <input
              type="checkbox"
              checked={paid}
              onChange={(event) => setPaid(event.target.checked)}
              className="h-5 w-5 accent-[#534ab7]"
            />
          </label>

          {error && <p className="rounded-lg bg-[#fcebeb] px-3 py-2 text-xs text-[#a32d2d] dark:bg-[#4a2929] dark:text-[#ffb4b4]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-xl border border-black/15 px-4 text-sm font-medium hover:bg-[#f1f0eb] disabled:opacity-50 dark:border-white/15 dark:hover:bg-[#3a3a38]">Hủy</button>
            <button type="submit" disabled={saving} className="h-10 rounded-xl bg-[#534ab7] px-5 text-sm font-semibold text-white hover:bg-[#433b9c] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm học viên'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { createTaskQuick } from '@/app/admin/new/actions'

export default function QuickTaskForm() {
  const [state, action, pending] = useActionState(createTaskQuick, null)

  useEffect(() => {
    if (state && 'id' in state && state.id) window.location.assign(`/items/${state.id}`)
  }, [state])

  return (
    <details className="mb-8 rounded-2xl border border-oak/35 bg-white/65 p-4 sm:p-5">
      <summary className="cursor-pointer list-none font-medium marker:hidden">＋ Tạo task nhanh</summary>
      <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Tiêu đề <span className="text-rose">*</span>
          <input required name="title" maxLength={240} className="mt-1.5 h-11 w-full rounded-xl border border-oak/40 bg-linen px-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
        </label>
        <label className="text-sm font-medium">
          Loại nội dung
          <select name="type" defaultValue="task" className="mt-1.5 h-11 w-full rounded-xl border border-oak/40 bg-linen px-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20">
            <option value="task">Task lớp</option>
            <option value="homework">Bài tập về nhà</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Môn học
          <input name="subject" maxLength={120} placeholder="Ví dụ: Lý - dược" className="mt-1.5 h-11 w-full rounded-xl border border-oak/40 bg-linen px-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
        </label>
        <label className="text-sm font-medium">
          Hạn (mặc định 7 ngày)
          <input name="due_at" type="datetime-local" className="mt-1.5 h-11 w-full rounded-xl border border-oak/40 bg-linen px-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Mô tả
          <textarea name="description" rows={3} className="mt-1.5 w-full rounded-xl border border-oak/40 bg-linen p-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
        </label>
        <input type="hidden" name="priority" value="normal" />
        <input type="hidden" name="is_published" value="on" />
        {state?.error && <p role="alert" className="text-sm text-rose sm:col-span-2">Không lưu được task. Kiểm tra dữ liệu hoặc thử lại.</p>}
        <div className="flex items-center gap-4 sm:col-span-2">
          <button disabled={pending} className="h-11 rounded-xl bg-ink px-5 text-sm font-medium text-linen disabled:opacity-60">{pending ? 'Đang lưu…' : 'Tạo task'}</button>
          <Link href="/admin/new" className="text-sm text-ink/60 underline">Tùy chọn đầy đủ</Link>
        </div>
      </form>
    </details>
  )
}

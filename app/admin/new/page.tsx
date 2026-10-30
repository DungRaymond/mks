import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createTask } from './actions'
import { getSession } from '@/lib/session'

const errors: Record<string, string> = {
  title: 'Nhập tiêu đề, tối đa 240 ký tự.',
  fields: 'Chọn loại nội dung, môn học hoặc mức ưu tiên hợp lệ.',
  due: 'Hạn hoàn thành không hợp lệ.',
  save: 'Không lưu được task. Kiểm tra migration RPC trên Supabase.',
}

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login?next=%2Fadmin%2Fnew')
  if (session.profile.role !== 'admin' && session.profile.role !== 'officer') redirect('/')

  const { error } = await searchParams

  return (
    <main className="min-h-screen bg-linen px-5 py-10 text-ink sm:px-8 sm:py-14">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-ink/60 hover:text-ink">← Trang chủ</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-rose">Nội dung lớp</p>
        <h1 className="mt-2 font-serif text-4xl">Tạo nội dung mới</h1>
        <p className="mt-3 text-sm text-ink/65">Nếu không chọn hạn, task hoặc bài tập sẽ tự nhận hạn 7 ngày từ lúc tạo.</p>

        {error && errors[error] && <p role="alert" className="mt-6 rounded-xl bg-rose/10 p-4 text-sm text-rose">{errors[error]}</p>}

        <form action={createTask} className="mt-8 space-y-5 rounded-3xl border border-oak/30 bg-white/65 p-6 shadow-sm sm:p-8">
          <label className="block text-sm font-medium">
            Loại nội dung
            <select name="type" defaultValue="task" className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20">
              <option value="task">Task lớp</option>
              <option value="homework">Bài tập về nhà</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Tiêu đề <span aria-hidden="true" className="text-rose">*</span>
            <input required name="title" maxLength={240} className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-4 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
          </label>

          <label className="block text-sm font-medium">
            Môn học
            <input name="subject" maxLength={120} placeholder="Ví dụ: Lý - dược" className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-4 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
          </label>

          <label className="block text-sm font-medium">
            Mô tả
            <textarea name="description" rows={6} className="mt-2 w-full rounded-xl border border-oak/40 bg-linen/60 p-4 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Mức ưu tiên
              <select name="priority" defaultValue="normal" className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20">
                <option value="normal">Bình thường</option>
                <option value="high">Ưu tiên cao</option>
                <option value="urgent">Khẩn cấp</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Hạn hoàn thành
              <input name="due_at" type="datetime-local" className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-3 outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input name="is_published" type="checkbox" defaultChecked className="h-4 w-4 accent-[#b77978]" />
            Công khai task ngay
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button className="h-12 rounded-xl bg-ink px-6 font-medium text-linen transition hover:bg-ink/85">Tạo task</button>
            <Link href="/" className="inline-flex h-12 items-center rounded-xl border border-oak/40 px-5 text-sm font-medium hover:bg-beige/50">Hủy</Link>
          </div>
        </form>
      </section>
    </main>
  )
}

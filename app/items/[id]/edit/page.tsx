import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'
import { updateTask } from '@/app/admin/new/actions'
import ImageUploader from '@/app/admin/new/ImageUploader'

const errorText: Record<string, string> = {
  title: 'Nhập tiêu đề, tối đa 240 ký tự.',
  fields: 'Thông tin task không hợp lệ.',
  due: 'Hạn hoàn thành không hợp lệ.',
  images: 'Danh sách ảnh không hợp lệ. Tải lại ảnh rồi thử lại.',
  save: 'Không lưu được thay đổi. Kiểm tra quyền và RPC trên Supabase.',
}

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, { error }, session] = await Promise.all([params, searchParams, getSession()])
  if (!session) redirect(`/login?next=${encodeURIComponent(`/items/${id}/edit`)}`)
  if (!['admin', 'officer'].includes(session.profile.role)) redirect(`/items/${id}`)

  const { data: item, error: loadError } = await createAdminClient()
    .from('class_items')
    .select('id, type, title, description, subject, priority, due_at, is_published')
    .eq('id', id)
    .in('type', ['task', 'homework', 'notice'])
    .maybeSingle()
  if (loadError) throw new Error('Could not load item')
  if (!item) notFound()

  const { data: images, error: imagesError } = await createAdminClient()
    .from('item_images')
    .select('uc_uuid')
    .eq('item_id', id)
    .order('sort_order')
  if (imagesError) throw new Error('Could not load item images')
  const action = updateTask.bind(null, id)
  const dueValue = item.due_at ? new Date(item.due_at).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(' ', 'T').slice(0, 16) : ''

  return (
    <main className="min-h-screen bg-linen px-5 py-10 text-ink sm:px-8 sm:py-14">
      <section className="mx-auto max-w-2xl">
        <Link href={`/items/${id}`} className="text-sm text-ink/60 hover:text-ink">← Chi tiết task</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-rose">Nội dung lớp</p>
        <h1 className="mt-2 font-serif text-4xl">Sửa task / bài tập</h1>
        {error && errorText[error] && <p role="alert" className="mt-6 rounded-xl bg-rose/10 p-4 text-sm text-rose">{errorText[error]}</p>}
        <form action={action} className="mt-8 space-y-5 rounded-3xl border border-oak/30 bg-white/65 p-6 shadow-sm sm:p-8">
          <label className="block text-sm font-medium">Loại nội dung
            <select name="type" defaultValue={item.type} className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-3">
              <option value="task">Task lớp</option><option value="homework">Bài tập về nhà</option><option value="notice">Thông báo</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Tiêu đề
            <input required name="title" maxLength={240} defaultValue={item.title} className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-4" />
          </label>
          <label className="block text-sm font-medium">Môn học
            <input name="subject" maxLength={120} defaultValue={item.subject ?? ''} className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-4" />
          </label>
          <label className="block text-sm font-medium">Mô tả
            <textarea name="description" rows={6} defaultValue={item.description ?? ''} className="mt-2 w-full rounded-xl border border-oak/40 bg-linen/60 p-4" />
          </label>
          <fieldset className="space-y-2 text-sm font-medium"><legend>Ảnh đính kèm</legend><ImageUploader initialIds={(images ?? []).map((image) => image.uc_uuid)} /></fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">Mức ưu tiên
              <select name="priority" defaultValue={item.priority} className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-3">
                <option value="normal">Bình thường</option><option value="high">Ưu tiên cao</option><option value="urgent">Khẩn cấp</option>
              </select>
            </label>
            <label className="block text-sm font-medium">Hạn hoàn thành
              <input name="due_at" type="datetime-local" defaultValue={dueValue} className="mt-2 h-12 w-full rounded-xl border border-oak/40 bg-linen/60 px-3" />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm"><input name="is_published" type="checkbox" defaultChecked={item.is_published} className="h-4 w-4" />Công khai task</label>
          <div className="flex gap-3">
            <button className="h-12 rounded-xl bg-ink px-6 font-medium text-linen">Lưu thay đổi</button>
            <Link href={`/items/${id}`} className="inline-flex h-12 items-center rounded-xl border border-oak/40 px-5 text-sm">Hủy</Link>
          </div>
        </form>
      </section>
    </main>
  )
}

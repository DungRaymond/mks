'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import HomeButton from '@/components/HomeButton'
import SubjectBadge from '@/components/SubjectBadge'
import { loadItemImages, syncItems, useImageCache, useItemCache } from '@/lib/item-cache'
import { useViewer } from '@/lib/viewer'
import ItemLoading from './loading'
import { useRouter } from 'next/navigation'
import { findItemByRoute, itemHref, itemSlug } from '@/lib/item-slugs'

const typeLabels = { task: 'Task lớp', homework: 'Bài tập', notice: 'Lưu ý', announcement: 'Thông báo' }

export default function ItemDetail({ routeKey }: { routeKey: string }) {
  const router = useRouter()
  const { items, refreshing, error } = useItemCache()
  const viewer = useViewer()
  const [checked, setChecked] = useState(false)
  const item = findItemByRoute(items ?? [], routeKey)

  useEffect(() => {
    let active = true
    void syncItems().finally(() => { if (active) setChecked(true) })
    return () => { active = false }
  }, [routeKey])

  useEffect(() => {
    if (!item) return
    document.title = `${item.title} | Class Hub`
    if (routeKey !== itemSlug(item)) router.replace(`${itemHref(item)}${window.location.search}${window.location.hash}`, { scroll: false })
  }, [item, routeKey, router])

  if ((items === null && !error) || (!item && (!checked || refreshing))) return <ItemLoading />
  if (!item) return <main className="min-h-screen bg-linen px-5 py-10 text-ink sm:px-8 sm:py-16"><div className="mx-auto max-w-3xl"><HomeButton /><section className="mt-8 rounded-3xl border border-oak/30 bg-white/65 p-6"><h1 className="text-2xl font-semibold">{error ? 'Chưa tải được nội dung' : 'Không tìm thấy nội dung'}</h1><p className="mt-3 text-sm text-ink/75">{error ?? 'Nội dung đã bị xóa, ngừng công khai hoặc đường dẫn không hợp lệ.'}</p><button type="button" onClick={() => void syncItems()} className="nav-button mt-5">Thử lại</button></section></div></main>
  const urgent = (item.type === 'notice' || item.type === 'announcement') && item.priority === 'urgent'

  return <main className="min-h-screen bg-linen px-5 py-10 text-ink sm:px-8 sm:py-16">
    <article className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <HomeButton />
        {viewer?.authenticated && <div className="flex flex-wrap gap-2"><Link href="/admin/new" className="nav-button">Tạo nội dung</Link>{viewer.canManage && <Link href={`${itemHref(item)}/edit`} className="nav-button">Sửa</Link>}</div>}
      </div>
      <p role="status" className={`mt-5 text-xs leading-5 ${error ? 'text-rose' : 'text-ink/70'}`}>{error ?? (refreshing ? 'Đang hiển thị cache và đối chiếu cập nhật trong nền…' : 'Đang hiển thị dữ liệu đã lưu trên thiết bị.')}</p>
      <div className={`mt-5 rounded-3xl border p-6 shadow-sm sm:p-10 ${urgent ? 'border-rose/45 bg-rose/10' : 'border-oak/30 bg-white/65'}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 font-bold ${item.type === 'homework' ? 'border border-orange-800 bg-orange-700 text-white' : 'border border-oak/30 bg-white/70 text-ink/75'}`}>{typeLabels[item.type]}</span>
          <SubjectBadge names={item.subjects} />
          {urgent && <span className="rounded-full bg-rose px-3 py-1 font-bold text-white">CẦN CHÚ Ý ĐẶC BIỆT</span>}
        </div>
        <h1 className="mt-6 text-3xl font-medium leading-tight sm:text-5xl">{item.title}</h1>
        {item.description && <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-ink/80">{item.description}</p>}
        <DetailImages key={`${item.id}:${item.updated_at}`} id={item.id} updatedAt={item.updated_at} />
        <dl className="mt-8 grid gap-4 border-t border-oak/25 pt-6 text-sm sm:grid-cols-2">
          {item.due_at && <div><dt className="text-xs text-ink/70">Hạn hoàn thành</dt><dd className="mt-1 font-medium">{formatDate(item.due_at)}</dd></div>}
          <div><dt className="text-xs text-ink/70">Cập nhật lần cuối</dt><dd className="mt-1 font-medium">{formatDate(item.updated_at)}</dd></div>
          <div><dt className="text-xs text-ink/70">Trạng thái</dt><dd className="mt-1 font-medium">{item.is_archived ? 'Đã lưu trữ' : item.is_done ? 'Đã hoàn thành' : 'Đang hiển thị'}</dd></div>
        </dl>
      </div>
    </article>
  </main>
}

function DetailImages({ id, updatedAt }: { id: string; updatedAt: string }) {
  const entry = useImageCache(id)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void loadItemImages(id, updatedAt).catch(() => setError('Chưa tải được ảnh đính kèm.')) }, [id, updatedAt])
  return <>
    {error && <p role="status" className="mt-6 text-sm text-rose">{error} <button type="button" onClick={() => { setError(null); void loadItemImages(id, updatedAt).catch(() => setError('Chưa tải được ảnh đính kèm.')) }} className="nav-button ml-2">Thử lại</button></p>}
    {!entry && !error && <p role="status" className="mt-6 text-sm text-ink/70">Đang tải ảnh đính kèm…</p>}
    {!!entry?.images.length && <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Ảnh đính kèm">
      {entry.images.map((image) => <a key={image.uc_uuid} href={image.cdn_url} target="_blank" rel="noreferrer"><img src={image.cdn_url} alt="Ảnh đính kèm" loading="lazy" decoding="async" className="max-h-96 w-full rounded-xl border border-oak/25 object-contain" /></a>)}
    </div>}
  </>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
}

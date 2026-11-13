import type { Metadata } from 'next'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import { subjectLabel } from '@/lib/subjects'
import { ITEM_FIELDS, type Item } from '@/lib/items'
import ItemDetail from './ItemDetail'
import { notFound, permanentRedirect } from 'next/navigation'
import { findItemByRoute, itemHref, parseItemRoute } from '@/lib/item-slugs'

const typeLabels = { task: 'Task lớp', homework: 'Bài tập', notice: 'Lưu ý', announcement: 'Thông báo' }
const getItem = cache(async (id: string) => {
  const parsed = parseItemRoute(id)
  if (!parsed) return null
  let query = createPublicClient({ revalidate: 60 })
    .from('class_items')
    .select(ITEM_FIELDS)
    .eq('is_published', true)
  query = parsed.kind === 'uuid' ? query.eq('id', parsed.id) : query.gte('id', parsed.lower).lte('id', parsed.upper)
  const { data } = await query
  return findItemByRoute((data ?? []) as Item[], id)
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const item = await getItem(id)
  if (!item) return { title: 'Không tìm thấy nội dung | Class Hub' }

  const description = item.description?.trim()
    || `${typeLabels[item.type]}${subjectLabel(item.subjects) ? ` môn ${subjectLabel(item.subjects)}` : ''}${item.due_at ? ` · Hạn ${formatDate(item.due_at)}` : ''}`
  const title = `${item.title} | Class Hub`
  const url = itemHref(item)

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: item.title,
      description,
      url,
      siteName: 'Class Hub',
      locale: 'vi_VN',
      modifiedTime: item.updated_at,
    },
    twitter: { card: 'summary', title: item.title, description },
  }
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = parseItemRoute(id)
  if (!parsed) notFound()
  if (parsed.kind === 'uuid') {
    const item = await getItem(id)
    if (!item) notFound()
    permanentRedirect(itemHref(item))
  }
  return <ItemDetail key={id} routeKey={id} />
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

import { createPublicClient } from '@/lib/supabase/public'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'invalid_id' }, { status: 400 })
  const { data, error } = await createPublicClient().from('class_items')
    .select('updated_at, item_images(uc_uuid, cdn_url, sort_order)')
    .eq('id', id).eq('is_published', true).maybeSingle()
  if (error) return Response.json({ error: 'fetch_failed' }, { status: 502 })
  if (!data) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ updated_at: data.updated_at, images: [...(data.item_images ?? [])].sort((a, b) => a.sort_order - b.sort_order) }, { headers: { 'Cache-Control': 'no-store' } })
}

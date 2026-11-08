import { createPublicClient } from '@/lib/supabase/public'
import { ITEM_FIELDS } from '@/lib/items'

export async function GET(request: Request) {
  const idsParam = new URL(request.url).searchParams.get('ids')
  const supabase = createPublicClient()

  if (idsParam !== null) {
    const ids = idsParam.split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100)
    if (!ids.length) return Response.json({ items: [] })
    const { data, error } = await supabase
      .from('class_items')
      .select(ITEM_FIELDS)
      .eq('is_published', true)
      .in('id', ids)
    if (error) return Response.json({ error: 'fetch_failed' }, { status: 502 })
    return Response.json({ items: data ?? [] })
  }

  const { data, error } = await supabase
    .from('class_items')
    .select('id, updated_at')
    .eq('is_published', true)
  if (error) return Response.json({ error: 'fetch_failed' }, { status: 502 })
  return Response.json({ items: data ?? [] })
}
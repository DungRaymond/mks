'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { ITEM_FIELDS, taskCollectionPatch, type Item, type ItemCollection } from '@/lib/items'

export async function moveTaskToCollection(id: string, collection: ItemCollection): Promise<{ item: Item } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin', 'officer'].includes(session.profile.role)) {
    return { error: 'Bạn cần đăng nhập bằng tài khoản cán bộ để chuyển task.' }
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || !['active', 'done', 'archived'].includes(collection)) {
    return { error: 'Task hoặc vị trí không hợp lệ.' }
  }

  const { data, error } = await createAdminClient()
    .from('class_items')
    .update({ ...taskCollectionPatch(collection), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_published', true)
    .select(ITEM_FIELDS)
    .maybeSingle()

  if (error || !data) return { error: 'Không chuyển được task. Vui lòng thử lại.' }
  updateTag('class-items')
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/items/[id]', 'page')
  return { item: data as Item }
}

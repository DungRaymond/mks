'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUBJECT_NAMES } from '@/lib/subjects'
import { itemHref } from '@/lib/item-slugs'
import { parseVietnamDeadline } from '@/lib/deadlines'

function validateTask(formData: FormData, id?: string) {
  const type = String(formData.get('type') ?? 'task')
  const title = String(formData.get('title') ?? '').trim()
  const subjects = formData.getAll('subjects').map((value) => String(value).trim())
  const description = String(formData.get('description') ?? '').trim()
  const priority = String(formData.get('priority') ?? 'normal')
  const dueAt = String(formData.get('due_at') ?? '').trim()
  let imageIds: unknown
  try {
    imageIds = JSON.parse(String(formData.get('images') ?? '[]'))
  } catch {
    return { error: 'images' as const }
  }
  const published = formData.get('is_published') !== 'off'

  if (!['task', 'homework', 'notice', 'announcement'].includes(type)) return { error: 'fields' as const }
  if (!title || title.length > 240) return { error: 'title' as const }
  const uniqueSubjects = [...new Set(subjects)]
  if (uniqueSubjects.length !== subjects.length || subjects.some((subject) => !SUBJECT_NAMES.includes(subject)) || !['normal', 'high', 'urgent'].includes(priority)) {
    return { error: 'fields' as const }
  }
  const parsedDueAt = parseVietnamDeadline(dueAt)
  if (parsedDueAt === undefined) return { error: 'due' as const }
  if (!Array.isArray(imageIds) || imageIds.length > 10 || imageIds.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    return { error: 'images' as const }
  }

  return {
    value: {
      type,
      ...(id ? { id } : {}),
      title,
      description: description || null,
      subjects: SUBJECT_NAMES.filter((subject) => uniqueSubjects.includes(subject)),
      priority,
        due_at: ['notice', 'announcement'].includes(type) ? null : parsedDueAt,
      is_published: published,
      images: imageIds.map((uuid: string, sort_order: number) => ({
        uc_uuid: uuid,
        cdn_url: `https://ucarecdn.com/${uuid}/`,
        sort_order,
      })),
    },
  }
}

async function saveTask(formData: FormData, id?: string) {
  const session = await getSession()
  if (!session || !['admin', 'officer'].includes(session.profile.role)) redirect('/login')

  const result = validateTask(formData, id)
  if ('error' in result) return { error: result.error }

  const { data, error } = await createAdminClient().rpc('save_class_item', {
    payload: result.value,
    p_actor_id: session.profileId,
  })

  if (error || !data) return { error: 'save' as const }
  const href = itemHref({ id: data as string, title: result.value.title })
  updateTag('class-items')
  revalidatePath('/')
  revalidatePath('/items/[id]', 'page')
  revalidatePath('/admin')
  return { id: data as string, href }
}

export async function createTask(formData: FormData) {
  const result = await saveTask(formData)
  if ('error' in result) redirect(`/admin/new?error=${result.error}`)
  redirect(result.href)
}

export async function updateTask(id: string, formData: FormData) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/admin')
  const result = await saveTask(formData, id)
  if ('error' in result) redirect(`/items/${id}/edit?error=${result.error}`)
  redirect(result.href)
}

export async function archiveTask(id: string, archived: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/admin')
  const session = await getSession()
  if (!session || !['admin', 'officer'].includes(session.profile.role)) redirect('/login')
  const { error } = await createAdminClient()
    .from('class_items')
    .update({ is_archived: archived })
    .eq('id', id)
  if (error) redirect(`/items/${id}?error=save`)
  updateTag('class-items')
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/items/[id]', 'page')
  redirect('/admin')
}

export async function deleteTask(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/admin')
  const session = await getSession()
  if (!session || session.profile.role !== 'admin') redirect('/login')
  const { error } = await createAdminClient().rpc('delete_class_item', {
    p_item_id: id,
    p_actor_id: session.profileId,
  })
  if (error) redirect(`/items/${id}?error=delete`)
  updateTag('class-items')
  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

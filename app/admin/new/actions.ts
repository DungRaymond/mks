'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'

function validateTask(formData: FormData, id?: string) {
  const type = String(formData.get('type') ?? 'task')
  const title = String(formData.get('title') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
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

  if (!['task', 'homework'].includes(type)) return { error: 'fields' as const }
  if (!title || title.length > 240) return { error: 'title' as const }
  if (subject.length > 120 || !['normal', 'high', 'urgent'].includes(priority)) {
    return { error: 'fields' as const }
  }
  if (dueAt && Number.isNaN(Date.parse(dueAt))) return { error: 'due' as const }
  if (!Array.isArray(imageIds) || imageIds.length > 10 || imageIds.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    return { error: 'images' as const }
  }

  return {
    value: {
      type,
      ...(id ? { id } : {}),
      title,
      description: description || null,
      subject: subject || null,
      priority,
      due_at: dueAt ? `${dueAt}:00+07:00` : null,
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
  revalidatePath('/')
  revalidatePath(`/items/${data}`)
  revalidatePath('/admin')
  return { id: data as string }
}

export async function createTask(formData: FormData) {
  const result = await saveTask(formData)
  if ('error' in result) redirect(`/admin/new?error=${result.error}`)
  redirect(`/items/${result.id}`)
}

export async function createTaskQuick(_previousState: { error?: string } | null, formData: FormData) {
  return saveTask(formData)
}

export async function updateTask(id: string, formData: FormData) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/admin')
  const result = await saveTask(formData, id)
  if ('error' in result) redirect(`/items/${id}/edit?error=${result.error}`)
  redirect(`/items/${id}`)
}

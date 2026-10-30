'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'

function validateTask(formData: FormData) {
  const type = String(formData.get('type') ?? 'task')
  const title = String(formData.get('title') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const priority = String(formData.get('priority') ?? 'normal')
  const dueAt = String(formData.get('due_at') ?? '').trim()
  const published = formData.get('is_published') !== 'off'

  if (!['task', 'homework'].includes(type)) return { error: 'fields' as const }
  if (!title || title.length > 240) return { error: 'title' as const }
  if (subject.length > 120 || !['normal', 'high', 'urgent'].includes(priority)) {
    return { error: 'fields' as const }
  }
  if (dueAt && Number.isNaN(Date.parse(dueAt))) return { error: 'due' as const }

  return {
    value: {
      type,
      title,
      description: description || null,
      subject: subject || null,
      priority,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      is_published: published,
      images: [],
    },
  }
}

async function saveTask(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const result = validateTask(formData)
  if ('error' in result) return { error: result.error }

  const { data, error } = await createAdminClient().rpc('save_class_item', {
    payload: result.value,
    p_actor_id: session.profileId,
  })

  if (error || !data) return { error: 'save' as const }
  revalidatePath('/')
  revalidatePath(`/items/${data}`)
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

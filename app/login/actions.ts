'use server'

import { redirect } from 'next/navigation'
import { verifyPassword } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSession } from '@/lib/session'

export async function signIn(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')
  const destination = next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin'

  if (!/^[a-z0-9_]{3,32}$/.test(username) || !password) {
    redirect(`/login?error=credentials&next=${encodeURIComponent(destination)}`)
  }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, password_hash')
    .eq('username', username)
    .maybeSingle()

  if (!profile || !(await verifyPassword(password, profile.password_hash))) {
    redirect(`/login?error=credentials&next=${encodeURIComponent(destination)}`)
  }

  await createSession(profile.id)
  redirect(destination)
}

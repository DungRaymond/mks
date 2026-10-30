import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const COOKIE = 'class_hub_session'
const SESSION_DAYS = 10

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(profileId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString()
  const supabase = createAdminClient()
  const { error } = await supabase.from('auth_sessions').insert({
    profile_id: profileId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  })
  if (error) throw new Error('Could not create session')

  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('auth_sessions')
    .select('profile_id, expires_at, profiles(id, username, full_name, role)')
    .eq('token_hash', hashToken(token))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  const profile = Array.isArray(data?.profiles) ? data.profiles[0] : data?.profiles
  if (!data || !profile) return null

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5)
  const { error } = await supabase
    .from('auth_sessions')
    .update({ expires_at: expiresAt.toISOString() })
    .eq('token_hash', hashToken(token))
  if (error) return null

  // Cookie expiry is a fixed 10-day upper bound. Server-side expiry slides on each authenticated request.

  return { profileId: data.profile_id, profile }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (token) {
    await createAdminClient().from('auth_sessions').delete().eq('token_hash', hashToken(token))
  }
  cookieStore.delete(COOKIE)
}

import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  return Response.json({ authenticated: !!session, canManage: !!session && ['admin', 'officer'].includes(session.profile.role) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

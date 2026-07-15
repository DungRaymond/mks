import { NextResponse } from 'next/server'
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  createSessionToken,
  isValidPassword,
} from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!password || !isValidPassword(password)) {
    return NextResponse.json({ error: 'Mật khẩu không đúng.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: AUTH_COOKIE,
    value: createSessionToken(),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
    priority: 'high',
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

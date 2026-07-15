import { NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: AUTH_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

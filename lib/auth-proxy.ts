import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'

export async function updateSession(request: NextRequest) {
  const session = await getSession()
  if (request.nextUrl.pathname.startsWith('/admin') && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()
  const token = request.cookies.get('class_hub_session')?.value
  if (session && token) {
    response.cookies.set('class_hub_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 24 * 60 * 60,
    })
  }
  return response
}

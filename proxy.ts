import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE, isValidSession } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authenticated = isValidSession(request.cookies.get(AUTH_COOKIE)?.value)
  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  if (pathname === '/login' && authenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (isPublicPath) return NextResponse.next()
  if (authenticated) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

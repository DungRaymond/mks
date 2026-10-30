import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'

export async function updateSession(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin') && !(await getSession())) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

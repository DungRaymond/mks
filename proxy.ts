import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/auth-proxy'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/admin/:path*'],
}

import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createPublicClient(options?: { revalidate: number }) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(options ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {
        ...init,
        cache: 'force-cache',
        next: { revalidate: options.revalidate, tags: ['class-items'] },
      }) } } : {}),
    },
  )
}

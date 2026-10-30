'use server'

import { redirect } from 'next/navigation'
import { deleteSession } from '@/lib/session'

export async function signOut() {
  await deleteSession()
  redirect('/')
}

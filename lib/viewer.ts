'use client'

import { useEffect, useSyncExternalStore } from 'react'

type Viewer = { authenticated: boolean; canManage: boolean }
let viewer: Viewer | null = null
let pending: Promise<void> | null = null
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

async function refreshViewer() {
  if (pending) return pending
  pending = (async () => {
    try {
      const response = await fetch('/api/viewer', { cache: 'no-store' })
      if (!response.ok) throw new Error('viewer')
      const data = await response.json()
      viewer = { authenticated: data.authenticated === true, canManage: data.canManage === true }
    } catch { viewer = null }
    finally { pending = null; for (const listener of listeners) listener() }
  })()
  return pending
}

export function useViewer() {
  const snapshot = useSyncExternalStore(subscribe, () => viewer, () => null)
  useEffect(() => {
    void refreshViewer()
    const onFocus = () => void refreshViewer()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  return snapshot
}

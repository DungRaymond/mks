'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { Item } from './items'

const CACHE_KEY = 'class-hub-items-v2'
const IMAGES_KEY = 'class-hub-images-v1'
const listeners = new Set<() => void>()
type CacheState = { items: Item[] | null; refreshing: boolean; error: string | null }
export type ItemImage = { uc_uuid: string; cdn_url: string; sort_order: number }
type ImageEntry = { updatedAt: string; images: ItemImage[] }
const serverState: CacheState = { items: null, refreshing: false, error: null }
const serverImages: Record<string, ImageEntry> = {}
let state = serverState
let images = serverImages
let loaded = false
let revision = 0
let syncing: Promise<void> | null = null
const imageRequests = new Map<string, Promise<void>>()

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== 'object') return false
  const item = value as Item
  return typeof item.id === 'string' && typeof item.title === 'string'
    && ['task', 'homework', 'notice', 'announcement'].includes(item.type)
    && ['normal', 'high', 'urgent'].includes(item.priority)
    && (item.description === null || typeof item.description === 'string')
    && Array.isArray(item.subjects) && item.subjects.every((subject) => typeof subject === 'string')
    && typeof item.is_done === 'boolean' && typeof item.is_archived === 'boolean'
    && (item.due_at === null || (typeof item.due_at === 'string' && Number.isFinite(Date.parse(item.due_at))))
    && typeof item.updated_at === 'string' && Number.isFinite(Date.parse(item.updated_at))
}

function isImage(value: unknown): value is ItemImage {
  if (!value || typeof value !== 'object') return false
  const image = value as ItemImage
  return typeof image.uc_uuid === 'string' && typeof image.cdn_url === 'string' && Number.isFinite(image.sort_order)
}

function load() {
  if (loaded) return
  loaded = true
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    if (Array.isArray(stored?.items) && stored.items.every(isItem)) state = { ...state, items: stored.items }
  } catch { /* Storage can be unavailable or corrupt; fall back to the network. */ }
  try {
    const stored = JSON.parse(localStorage.getItem(IMAGES_KEY) ?? '{}')
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      images = Object.fromEntries(Object.entries(stored).filter(([, value]) => {
        const entry = value as ImageEntry | null
        return entry && typeof entry.updatedAt === 'string' && Array.isArray(entry.images) && entry.images.every(isImage)
      })) as Record<string, ImageEntry>
    }
  } catch { /* Image caching is optional. */ }
}

function emit() { for (const listener of listeners) listener() }
function getSnapshot() { load(); return state }
function getImagesSnapshot() { load(); return images }
function onStorage(event: StorageEvent) {
  if (event.key !== CACHE_KEY && event.key !== IMAGES_KEY && event.key !== null) return
  revision += 1
  loaded = false
  state = { ...state, items: null }
  images = {}
  load()
  emit()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('storage', onStorage)
  }
}

function saveItems(items: Item[]) {
  state = { ...state, items }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items })) } catch { /* Keep the in-memory cache when storage is full. */ }
  emit()
}

export function cacheUpdatedItem(item: Item) {
  load()
  const current = state.items ?? []
  const existing = current.find((entry) => entry.id === item.id)
  if (existing?.updated_at === item.updated_at) return
  revision += 1
  saveItems(existing ? current.map((entry) => entry.id === item.id ? item : entry) : [...current, item])
}

export function getCachedItems() { load(); return state.items }

export async function syncItems(): Promise<void> {
  load()
  if (syncing) return syncing
  state = { ...state, refreshing: true }
  emit()
  const version = revision
  syncing = (async () => {
    try {
      const response = await fetch('/api/items', { cache: 'no-store' })
      if (!response.ok) throw new Error('Không kiểm tra được cập nhật. Đang hiển thị dữ liệu đã lưu.')
      const payload = await response.json()
      const meta: { id: string; updated_at: string }[] = payload.items
      if (!Array.isArray(meta) || !meta.every((entry) => typeof entry.id === 'string' && typeof entry.updated_at === 'string')) throw new Error('Dữ liệu cập nhật không hợp lệ.')
      const base = new Map((state.items ?? []).map((item) => [item.id, item]))
      const live = new Set(meta.map((entry) => entry.id))
      const next = new Map([...base].filter(([id]) => live.has(id)))
      const staleIds = meta.filter((entry) => base.get(entry.id)?.updated_at !== entry.updated_at).map((entry) => entry.id)
      let incomplete = false
      for (let i = 0; i < staleIds.length; i += 100) {
        const ids = staleIds.slice(i, i + 100)
        const freshResponse = await fetch(`/api/items?ids=${ids.join(',')}`, { cache: 'no-store' })
        if (!freshResponse.ok) { incomplete = true; continue }
        const fresh = await freshResponse.json()
        if (!Array.isArray(fresh.items) || !fresh.items.every(isItem)) { incomplete = true; continue }
        const returned = new Set((fresh.items as Item[]).map((item) => item.id))
        for (const id of ids) if (!returned.has(id)) next.delete(id)
        for (const item of fresh.items as Item[]) next.set(item.id, item)
      }
      // A drop or another tab may have saved newer data while the request ran.
      if (revision === version) {
        if (state.items === null && incomplete) throw new Error('Chưa tải được nội dung. Vui lòng thử lại.')
        const changed = state.items === null || state.items.length !== next.size
          || state.items.some((item) => next.get(item.id)?.updated_at !== item.updated_at)
        if (changed) saveItems([...next.values()])
      }
      state = { ...state, error: incomplete ? 'Một số cập nhật chưa tải được. Dữ liệu đã lưu vẫn được giữ lại.' : null }
    } catch (error) {
      state = { ...state, error: error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError)
        ? error.message : 'Không kiểm tra được cập nhật. Đang hiển thị dữ liệu đã lưu.' }
    } finally {
      state = { ...state, refreshing: false }
      syncing = null
      emit()
    }
  })()
  return syncing
}

export function useItemCache() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => serverState)
  useEffect(() => {
    void syncItems()
    const tick = window.setInterval(() => void syncItems(), 60_000)
    const onFocus = () => void syncItems()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [])
  return snapshot
}

export function useImageCache(id: string) {
  return useSyncExternalStore(subscribe, getImagesSnapshot, () => serverImages)[id]
}

export async function loadItemImages(id: string, updatedAt: string) {
  load()
  if (images[id]?.updatedAt === updatedAt) return
  if (imageRequests.has(id)) return imageRequests.get(id)
  const request = (async () => {
    const response = await fetch(`/api/items/${id}/images`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Chưa tải được ảnh đính kèm.')
    const payload = await response.json()
    if (typeof payload.updated_at !== 'string' || !Array.isArray(payload.images) || !payload.images.every(isImage)) throw new Error('Dữ liệu ảnh không hợp lệ.')
    images = { ...images, [id]: { updatedAt: payload.updated_at, images: payload.images } }
    try { localStorage.setItem(IMAGES_KEY, JSON.stringify(images)) } catch { /* Keep images in memory if persistence fails. */ }
    emit()
  })()
  imageRequests.set(id, request)
  try { await request } finally { imageRequests.delete(id) }
}

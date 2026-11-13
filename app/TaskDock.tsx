'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode, type TouchEvent } from 'react'
import { belongsToCollection, type Item, type ItemCollection } from '@/lib/items'

type Drag = { item: Item; x: number; y: number; mode: 'pointer' | 'native' | 'touch' }
type PendingTouch = { identifier: number; item: Item; x: number; y: number; timer: number }
type DockContext = {
  busy: boolean
  draggedId?: string
  select: (item: Item) => void
  startNative: (event: DragEvent, item: Item) => void
  end: () => void
  pointerDown: (event: PointerEvent<HTMLButtonElement>, item: Item) => void
  pointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  pointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  touchStart: (event: TouchEvent, item: Item) => void
  consumeSuppressedClick: () => boolean
  suppressContextMenu: () => boolean
  clearSuppressedClick: () => void
}

const Context = createContext<DockContext | null>(null)
const labels = { active: 'Trang chính', done: 'Đã xong', archived: 'Lưu trữ' }

export default function TaskDock({ children, items, enabled, collection, onCollectionChange, onMove }: {
  children: ReactNode
  items: Item[]
  enabled: boolean
  collection: ItemCollection
  onCollectionChange: (collection: ItemCollection) => void
  onMove: (item: Item, collection: ItemCollection) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Item | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hovered, setHovered] = useState<ItemCollection | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const dockRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const activeRef = useRef<Drag | null>(null)
  const originRef = useRef({ x: 0, y: 0 })
  const busyRef = useRef(false)
  const touchRef = useRef<PendingTouch | null>(null)
  const suppressClick = useRef(false)
  const suppressUntil = useRef(0)

  const end = useCallback(() => {
    if (activeRef.current && suppressClick.current) suppressUntil.current = Date.now() + 500
    if (touchRef.current) window.clearTimeout(touchRef.current.timer)
    touchRef.current = null
    activeRef.current = null
    setDrag(null)
    setHovered(null)
  }, [])

  const track = useCallback((x: number, y: number) => {
    const active = activeRef.current
    if (!active) return
    const next = { ...active, x, y }
    activeRef.current = next
    setDrag(next)
    const bounds = triggerRef.current?.getBoundingClientRect()
    if (bounds && x >= bounds.left - 110 && x <= bounds.right + 110 && y >= bounds.top - 110 && y <= bounds.bottom + 110) setOpen(true)
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-task-destination]')
    setHovered((target?.dataset.taskDestination as ItemCollection | undefined) ?? null)
  }, [])

  const move = useCallback(async (item: Item, destination: ItemCollection) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    end()
    setSelected(null)
    setMessage(`Đang chuyển “${item.title}”…`)
    try {
      await onMove(item, destination)
      setMessage(`Đã chuyển “${item.title}” vào ${labels[destination]}.`)
      setOpen(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không lưu được. Task vẫn ở vị trí cũ; hãy thử lại.')
      setSelected(item)
      setOpen(true)
    } finally {
      busyRef.current = false
      setBusy(false)
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [end, onMove])

  const drop = useCallback((x: number, y: number) => {
    const item = activeRef.current?.item
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-task-destination]')
    const destination = target?.dataset.taskDestination as ItemCollection | undefined
    end()
    if (item && destination) void move(item, destination)
    else {
      setOpen(false)
      setMessage('Đã hủy kéo. Task vẫn ở vị trí cũ.')
    }
  }, [end, move])

  useEffect(() => {
    if (!enabled) return
    const onDragOver = (event: globalThis.DragEvent) => {
      if (!activeRef.current) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      track(event.clientX, event.clientY)
    }
    const onDrop = (event: globalThis.DragEvent) => {
      if (!activeRef.current) return
      event.preventDefault()
      drop(event.clientX, event.clientY)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      end()
      setOpen(false)
      setSelected(null)
    }
    const onBlur = () => { end(); setOpen(false) }
    const onTouchMove = (event: globalThis.TouchEvent) => {
      const pending = touchRef.current
      if (!pending) return
      const touch = Array.from(event.touches).find((entry) => entry.identifier === pending.identifier)
      if (!touch || event.touches.length !== 1) { end(); return }
      if (activeRef.current?.mode === 'touch') {
        event.preventDefault()
        track(touch.clientX, touch.clientY)
      } else if (Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y) > 10) {
        window.clearTimeout(pending.timer)
        touchRef.current = null
      }
    }
    const onTouchEnd = (event: globalThis.TouchEvent) => {
      const pending = touchRef.current
      if (!pending) return
      const touch = Array.from(event.changedTouches).find((entry) => entry.identifier === pending.identifier)
      if (!touch) return
      if (activeRef.current?.mode === 'touch') {
        event.preventDefault()
        drop(touch.clientX, touch.clientY)
      } else end()
    }
    const onTouchCancel = () => { end(); setOpen(false) }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: false })
    document.addEventListener('touchcancel', onTouchCancel)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
      if (touchRef.current) window.clearTimeout(touchRef.current.timer)
    }
  }, [enabled, drop, end, track])

  if (!enabled) return children

  const start = (item: Item, x: number, y: number, mode: Drag['mode']) => {
    if (busyRef.current) return
    const next = { item, x, y, mode }
    activeRef.current = next
    originRef.current = { x, y }
    suppressClick.current = false
    setSelected(null)
    setDrag(next)
    setMessage('Kéo đến nút ☰ ở góc dưới, rồi thả vào Đã xong hoặc Lưu trữ. Nhấn Escape để hủy.')
  }

  const context: DockContext = {
    busy,
    draggedId: drag?.item.id,
    consumeSuppressedClick: () => {
      const suppressed = suppressClick.current && Date.now() < suppressUntil.current
      suppressClick.current = false
      return suppressed
    },
    suppressContextMenu: () => !!touchRef.current || activeRef.current?.mode === 'touch',
    clearSuppressedClick: () => { suppressClick.current = false },
    end,
    select: (item) => {
      if (busyRef.current) return
      setSelected(item)
      setOpen(true)
      window.requestAnimationFrame(() => dockRef.current?.querySelector<HTMLButtonElement>('[data-task-destination]')?.focus({ preventScroll: true }))
    },
    startNative: (event, item) => {
      if (touchRef.current) { event.preventDefault(); return }
      if (busyRef.current) { event.preventDefault(); return }
      event.stopPropagation()
      event.dataTransfer.setData('text/plain', item.id)
      event.dataTransfer.effectAllowed = 'move'
      start(item, event.clientX, event.clientY, 'native')
    },
    pointerDown: (event, item) => {
      if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary || busyRef.current) return
      event.preventDefault()
      event.currentTarget.focus({ preventScroll: true })
      event.currentTarget.setPointerCapture(event.pointerId)
      start(item, event.clientX, event.clientY, 'pointer')
    },
    pointerMove: (event) => {
      if (activeRef.current?.mode !== 'pointer') return
      if (Math.hypot(event.clientX - originRef.current.x, event.clientY - originRef.current.y) > 6) suppressClick.current = true
      track(event.clientX, event.clientY)
    },
    pointerUp: (event) => {
      if (activeRef.current?.mode !== 'pointer') return
      if (suppressClick.current) drop(event.clientX, event.clientY)
      else end()
    },
    touchStart: (event, item) => {
      if (busyRef.current || event.touches.length !== 1) { end(); return }
      const touch = event.touches[0]
      if (touchRef.current) window.clearTimeout(touchRef.current.timer)
      const pending: PendingTouch = {
        identifier: touch.identifier, item, x: touch.clientX, y: touch.clientY,
        timer: window.setTimeout(() => {
          start(item, touch.clientX, touch.clientY, 'touch')
          suppressClick.current = true
        }, 600),
      }
      touchRef.current = pending
    },
  }

  const current = drag?.item ?? selected
  const tasks = items

  return <Context.Provider value={context}>
    <div className="pb-24">{children}</div>
    {drag && drag.mode !== 'native' && <div aria-hidden="true" className="pointer-events-none fixed z-[70] max-w-56 -translate-x-1/2 -translate-y-full truncate rounded-xl border border-oak bg-ink px-4 py-3 text-sm text-linen shadow-xl" style={{ left: drag.x, top: drag.y - 12 }}>{drag.item.title}</div>}
    <div ref={dockRef} className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-8">
      {message && <p role="status" className="max-w-72 rounded-xl border border-oak/30 bg-linen px-4 py-3 text-xs leading-5 shadow-md">{message}</p>}
      {open && <section aria-label="Sắp xếp task" className="max-h-[calc(100dvh-14rem)] w-72 max-w-full overflow-y-auto rounded-2xl border border-oak/40 bg-linen p-3 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-2 px-1">
          <div className="min-w-0"><h2 className="text-sm font-semibold">{current ? 'Chuyển nội dung vào…' : 'Kho nội dung của lớp'}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-ink/75">{current?.title ?? 'Cảm ứng: giữ card 0,6 giây rồi kéo đến nút ☰.'}</p></div>
          <button type="button" aria-label="Đóng kho task" disabled={busy} onClick={() => { end(); setOpen(false); setSelected(null); triggerRef.current?.focus() }} className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-beige">×</button>
        </div>
        <div className="space-y-2">
          {(['done', 'archived'] as const).map((destination) => <button key={destination} type="button" data-task-destination={destination} disabled={busy} onClick={() => {
            if (selected) void move(selected, destination)
            else { onCollectionChange(destination); setOpen(false) }
          }} className={`flex min-h-20 w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition ${hovered === destination ? 'scale-[1.02] border-ink bg-beige shadow-md' : 'border-oak/30 bg-white/80 hover:border-oak'} disabled:opacity-50`}>
            <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-xl ${destination === 'done' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{destination === 'done' ? '✓' : '▤'}</span>
            <span className="flex-1"><span className="block text-sm font-semibold">{labels[destination]}</span><span className="mt-1 block text-xs text-ink/75">{current ? hovered === destination ? 'Thả tại đây để chuyển' : 'Thả card vào kho này' : `${tasks.filter((item) => belongsToCollection(item, destination)).length} mục · Nhấn để xem`}</span></span>
          </button>)}
          {selected && (selected.is_done || selected.is_archived) && <button type="button" disabled={busy} onClick={() => void move(selected, 'active')} className="min-h-11 w-full rounded-xl border border-oak/30 px-3 text-sm font-medium">↩ Đưa về trang chính</button>}
          {!current && collection !== 'active' && <button type="button" onClick={() => { onCollectionChange('active'); setOpen(false) }} className="nav-button w-full">← Về trang chính</button>}
        </div>
        {current && <p className="mt-3 px-1 text-xs leading-5 text-ink/70">Thay đổi áp dụng cho cả lớp. Thả ra ngoài để hủy.</p>}
      </section>}
      <button ref={triggerRef} type="button" aria-label="Mở kho task: Đã xong và Lưu trữ" aria-expanded={open} disabled={busy} onClick={() => { setOpen(!open); setSelected(null); setMessage('') }} className={`grid size-16 place-items-center rounded-full border-2 border-linen bg-ink text-2xl text-linen shadow-xl transition ${drag ? 'ring-8 ring-oak/30' : 'hover:bg-ink/85'} disabled:opacity-60`}>
        <span aria-hidden="true">{busy ? '…' : open ? '×' : '☰'}</span>
      </button>
    </div>
  </Context.Provider>
}

export function DraggableTask({ item, children }: { item: Item; children: ReactNode }) {
  const dock = useContext(Context)
  if (!dock) return children

  return <div draggable={!dock.busy} onDragStart={(event) => dock.startNative(event, item)} onDragEnd={dock.end}
    onPointerDownCapture={dock.clearSuppressedClick} onKeyDownCapture={dock.clearSuppressedClick}
    onTouchStart={(event) => dock.touchStart(event, item)} onContextMenu={(event) => { if (dock.suppressContextMenu()) event.preventDefault() }}
    onClickCapture={(event) => { if (dock.consumeSuppressedClick()) { event.preventDefault(); event.stopPropagation() } }}
    className={`min-w-0 rounded-2xl [-webkit-touch-callout:none] transition-opacity ${dock.draggedId === item.id ? 'select-none opacity-40' : ''}`}>
    <div className="mb-2 flex justify-end">
      <button type="button" disabled={dock.busy} aria-label={`Kéo hoặc chọn vị trí cho nội dung: ${item.title}`} title="Kéo đến nút ☰ hoặc nhấn để chọn kho"
        onPointerDown={(event) => dock.pointerDown(event, item)} onPointerMove={dock.pointerMove} onPointerUp={dock.pointerUp} onPointerCancel={(event) => { if (event.pointerType !== 'touch') dock.end() }}
        onClick={() => dock.select(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-oak/35 bg-white/75 px-3 text-xs font-medium text-ink/80 hover:bg-beige/60 active:cursor-grabbing disabled:opacity-50">
        <span aria-hidden="true" className="text-lg">⠿</span> Kéo / chuyển
      </button>
    </div>
    {children}
  </div>
}

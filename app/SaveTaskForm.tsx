'use client'

import { useFormStatus } from 'react-dom'

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <>
      <button disabled={pending} className="h-12 rounded-xl bg-ink px-6 font-medium text-linen disabled:opacity-60">
        {pending ? 'Đang lưu…' : label}
      </button>
      {pending && (
        <p role="status" className="text-sm text-ink/75">Đang lưu thay đổi, vui lòng chờ…</p>
      )}
    </>
  )
}

export default function SaveTaskForm({ action, submitLabel, children, className }: {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  children: React.ReactNode
  className: string
}) {
  return <form action={action} className={className}>{children}<div className="flex items-center gap-3"><SaveButton label={submitLabel} /></div></form>
}

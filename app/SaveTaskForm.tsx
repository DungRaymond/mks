'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

const wisdoms = [
  'It always seems impossible until it is done. — Nelson Mandela',
  'Great things are done by a series of small things brought together. — Vincent van Gogh',
  'Well done is better than well said. — Benjamin Franklin',
  'The secret of getting ahead is getting started. — Mark Twain',
  'It does not matter how slowly you go as long as you do not stop. — Confucius',
]

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  const [wisdom] = useState(() => wisdoms[Math.floor(Math.random() * wisdoms.length)])

  return (
    <>
      <button disabled={pending} className="h-12 rounded-xl bg-ink px-6 font-medium text-linen disabled:opacity-60">
        {pending ? 'Đang lưu…' : label}
      </button>
      {pending && (
        <div role="dialog" aria-modal="true" aria-labelledby="saving-title" className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5">
          <section className="w-full max-w-md rounded-3xl bg-linen p-8 text-center shadow-xl">
            <h2 id="saving-title" className="text-xl font-semibold">Đang lưu thay đổi</h2>
            <p className="mt-4 text-ink/75">{wisdom}</p>
          </section>
        </div>
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

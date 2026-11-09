'use client'

import { useId, useState } from 'react'
import { SUBJECTS, pickSubjects, subjectVars } from '@/lib/subjects'

export default function SubjectPicker({ initialSubjects = [], className = '' }: { initialSubjects?: string[]; className?: string }) {
  const [selected, setSelected] = useState(() => pickSubjects(initialSubjects).map((subject) => subject.name))
  const hintId = useId()
  const chosen = pickSubjects(selected)
  const vars = subjectVars(selected)

  function toggle(name: string) {
    setSelected((current) => current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name])
  }

  return (
    <fieldset className={`min-w-0 ${className}`} aria-describedby={hintId}>
      <legend className="text-sm font-medium">Môn học</legend>
      <p id={hintId} className="mt-1 text-xs leading-5 text-ink/55">Chọn một hoặc nhiều môn. Hai môn ghép thành gradient hai màu, ba môn thành gradient ba màu.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {SUBJECTS.map((subject) => {
          const active = selected.includes(subject.name)
          return (
            <label key={subject.name} className="relative">
              <input type="checkbox" name="subjects" value={subject.name} checked={active} onChange={() => toggle(subject.name)} className="peer sr-only" />
              <span
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink/60 ${active ? '' : 'border-oak/40 bg-linen/70 text-ink/65 hover:border-oak hover:bg-beige/50 hover:text-ink'}`}
                style={active ? { borderColor: subject.color, backgroundColor: subject.tint, color: '#12100e', boxShadow: `0 8px 18px -12px ${subject.color}` } : undefined}
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full transition duration-200" style={{ backgroundColor: subject.color, opacity: active ? 1 : 0.35 }} />
                {subject.name}
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 shrink-0 transition duration-200 ${active ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} style={{ color: subject.color }}><path d="M3 8.5 6.5 12 13 4.5" /></svg>
              </span>
            </label>
          )
        })}
      </div>
      <div className="mt-3 rounded-xl border border-oak/30 bg-white/65 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Màu của task</span>
          <span className="flex items-center gap-3">
            <span aria-live="polite" className="text-[11px] font-medium text-ink/60">{chosen.length === 0 ? 'Cả lớp' : chosen.length === 1 ? '1 môn · màu đơn' : `${chosen.length} môn · gradient ${chosen.length} màu`}</span>
            {chosen.length > 0 && <button type="button" onClick={() => setSelected([])} className="cursor-pointer text-[11px] font-medium text-rose underline underline-offset-2 transition hover:text-ink">Xoá chọn</button>}
          </span>
        </div>
        {vars
          ? <div key={chosen.map((subject) => subject.name).join('|')} className="subject-gradient subject-swatch mt-2 h-9 rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)]" style={vars} />
          : <div className="mt-2 grid h-9 place-items-center rounded-lg border border-dashed border-oak/45 bg-beige/35 px-3 text-center text-[11px] text-ink/50">Không chọn môn — task hiển thị cho cả lớp</div>}
      </div>
    </fieldset>
  )
}
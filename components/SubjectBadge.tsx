import { pickSubjects, subjectVars } from '@/lib/subjects'

export default function SubjectBadge({ names, className = '' }: { names: readonly string[]; className?: string }) {
  const subjects = pickSubjects(names)
  if (!subjects.length) return null

  return (
    <span
      className={`subject-gradient inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-full px-3 py-1 font-bold leading-5 text-[#0a0a0a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] ${subjects.length > 1 ? 'text-[11px]' : 'text-xs'} ${className}`}
      style={subjectVars(names) ?? undefined}
    >
      {subjects.map((subject, index) => (
        <span key={subject.name} className="inline-flex items-center gap-1">
          {index > 0 && <span aria-hidden="true" className="opacity-55">+</span>}
          {subject.name}
        </span>
      ))}
    </span>
  )
}
import type { CSSProperties } from 'react'

export type Subject = { name: string; color: string; tint: string }

export const SUBJECTS: Subject[] = [
  { name: 'Modul Y sinh', color: '#06b6d4', tint: '#cffafe' },
  { name: 'Lý - dược', color: '#3b82f6', tint: '#dbeafe' },
  { name: 'Hóa vô cơ - dược', color: '#eab308', tint: '#fef9c3' },
]

export const SUBJECT_NAMES = SUBJECTS.map((subject) => subject.name)

export function pickSubjects(names: readonly string[] | null | undefined): Subject[] {
  const chosen = new Set(names ?? [])
  return SUBJECTS.filter((subject) => chosen.has(subject.name))
}

export function subjectLabel(names: readonly string[] | null | undefined): string | null {
  const subjects = pickSubjects(names)
  return subjects.length ? subjects.map((subject) => subject.name).join(' + ') : null
}

function gradient(colors: string[], colorSpace?: string) {
  const stops = colors.length > 1 ? colors : [colors[0], colors[0]]
  return `linear-gradient(${colorSpace ? `${colorSpace} ` : ''}135deg, ${stops.join(', ')})`
}

export function subjectVars(names: readonly string[] | null | undefined): CSSProperties | null {
  const subjects = pickSubjects(names)
  if (!subjects.length) return null
  const colors = subjects.map((subject) => subject.color)
  const tints = subjects.map((subject) => subject.tint)
  return {
    '--subject-line': colors[0],
    '--subject-fill': tints[0],
    '--subject-wash': gradient(tints),
    '--subject-edge': gradient(colors, 'in oklch'),
    '--subject-edge-srgb': gradient(colors),
  } as CSSProperties
}
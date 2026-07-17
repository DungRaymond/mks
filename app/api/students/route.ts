import { supabaseAdmin } from '@/lib/supabase-server'
import { withSupabaseClockSkewRetry } from '@/lib/supabase-retry'
import type { Attendance, Student, StudentSummary } from '@/lib/types'

export async function GET() {
  const [{ data: students, error: studentError }, { data: attendance, error: attendanceError }] =
    await Promise.all([
      withSupabaseClockSkewRetry(() =>
        supabaseAdmin.from('students').select('*').order('name'),
      ),
      withSupabaseClockSkewRetry(() =>
        supabaseAdmin.from('attendance').select('student_id'),
      ),
    ])

  if (studentError || attendanceError) {
    return Response.json(
      { error: studentError?.message ?? attendanceError?.message ?? 'Could not load students.' },
      { status: 500 },
    )
  }

  const counts = new Map<string, number>()
  for (const row of (attendance ?? []) as Pick<Attendance, 'student_id'>[]) {
    counts.set(row.student_id, (counts.get(row.student_id) ?? 0) + 1)
  }

  const result: StudentSummary[] = ((students ?? []) as Student[]).map((student) => ({
    ...student,
    attended: counts.get(student.id) ?? 0,
  }))

  return Response.json(result)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    name?: unknown
    lesson_limit?: unknown
    tuition_fee?: unknown
    paid?: unknown
  } | null

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const lessonLimit = Number(body?.lesson_limit)
  const tuitionFee = Number(body?.tuition_fee)
  const paid = body?.paid === true

  if (
    !name ||
    !Number.isInteger(lessonLimit) ||
    lessonLimit < 1 ||
    !Number.isFinite(tuitionFee) ||
    tuitionFee < 0
  ) {
    return Response.json({ error: 'Dữ liệu học viên không hợp lệ.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('students')
    .insert({ name, lesson_limit: lessonLimit, tuition_fee: tuitionFee, paid })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ...(data as Student), attended: 0 } satisfies StudentSummary, { status: 201 })
}

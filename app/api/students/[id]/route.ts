import { supabaseAdmin } from '@/lib/supabase-server'
import type { Attendance, Student, StudentCalendarData } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [{ data: student, error: studentError }, { data: attendance, error: attendanceError }] =
    await Promise.all([
      supabaseAdmin.from('students').select('*').eq('id', id).single(),
      supabaseAdmin.from('attendance').select('*').eq('student_id', id).order('date'),
    ])

  if (studentError?.code === 'PGRST116') {
    return Response.json({ error: 'Không tìm thấy học viên.' }, { status: 404 })
  }

  if (studentError || attendanceError) {
    return Response.json(
      { error: studentError?.message ?? attendanceError?.message ?? 'Could not load calendar.' },
      { status: 500 },
    )
  }

  const result: StudentCalendarData = {
    student: student as Student,
    attendance: (attendance ?? []) as Attendance[],
  }

  return Response.json(result)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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
    .update({ name, lesson_limit: lessonLimit, tuition_fee: tuitionFee, paid })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data as Student)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { error: attendanceError } = await supabaseAdmin
    .from('attendance')
    .delete()
    .eq('student_id', id)

  if (attendanceError) {
    return Response.json({ error: attendanceError.message }, { status: 500 })
  }

  const { error } = await supabaseAdmin.from('students').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

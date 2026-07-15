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

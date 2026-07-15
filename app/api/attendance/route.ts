import { supabaseAdmin } from '@/lib/supabase-server'
import type { Attendance } from '@/lib/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    student_id?: unknown
    date?: unknown
  } | null

  const studentId = typeof body?.student_id === 'string' ? body.student_id : ''
  const date = typeof body?.date === 'string' ? body.date : ''

  if (!studentId || !ISO_DATE.test(date)) {
    return Response.json({ error: 'Dữ liệu buổi học không hợp lệ.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .insert({ student_id: studentId, date })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data as Attendance, { status: 201 })
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null) as {
    student_id?: unknown
    date?: unknown
  } | null

  const studentId = typeof body?.student_id === 'string' ? body.student_id : ''
  const date = typeof body?.date === 'string' ? body.date : null

  if (!studentId || (date !== null && !ISO_DATE.test(date))) {
    return Response.json({ error: 'Dữ liệu buổi học không hợp lệ.' }, { status: 400 })
  }

  let query = supabaseAdmin.from('attendance').delete().eq('student_id', studentId)
  if (date) query = query.eq('date', date)
  const { error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

export type Student = {
  id: string
  name: string
  lesson_limit: number
  tuition_fee: number
  paid: boolean
  created_at: string
}

export type Attendance = {
  id: string
  student_id: string
  date: string
  created_at: string
}

export type StudentSummary = Student & {
  attended: number
}

export type StudentCalendarData = {
  student: Student
  attendance: Attendance[]
}

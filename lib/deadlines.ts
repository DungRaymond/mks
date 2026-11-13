const VIETNAM_OFFSET_MINUTES = 7 * 60

/** Parse a datetime-local value as Vietnam wall time and return an ISO timestamp. */
export function parseVietnamDeadline(value: string): string | null | undefined {
  if (value === '') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const utc = Date.UTC(year, month - 1, day, hour, minute, second) - VIETNAM_OFFSET_MINUTES * 60_000
  const date = new Date(utc)
  // Reject impossible dates instead of allowing Date to normalize (e.g. Feb 30).
  const check = new Date(utc + VIETNAM_OFFSET_MINUTES * 60_000)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day
    || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute || check.getUTCSeconds() !== second
    || !Number.isFinite(date.getTime())) return undefined
  return date.toISOString()
}

/** Format a stored timestamp for a datetime-local input in Vietnam time. */
export function formatVietnamDeadline(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`
}

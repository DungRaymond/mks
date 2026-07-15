import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const AUTH_COOKIE = 'teacher_session'
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function authSecret() {
  const secret = process.env.AUTH_PASSWORD
  if (!secret) throw new Error('Missing AUTH_PASSWORD')
  return secret
}

export function createSessionToken() {
  return createHmac('sha256', authSecret())
    .update('teacher-session-v1')
    .digest('hex')
}

export function isValidSession(token?: string) {
  if (!token) return false
  const expected = Buffer.from(createSessionToken(), 'utf8')
  const received = Buffer.from(token, 'utf8')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export function isValidPassword(password: string) {
  const expected = createHash('sha256').update(authSecret()).digest()
  const received = createHash('sha256').update(password).digest()
  return timingSafeEqual(expected, received)
}

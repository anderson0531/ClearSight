import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { withDbRetry } from '@/lib/database-url'

const scrypt = promisify(scryptCb)

export const SESSION_COOKIE = 'cs-session'
/** Session lifetime: 30 days. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
/** Password reset token lifetime: 1 hour. */
export const RESET_TTL_MS = 1000 * 60 * 60

const SCRYPT_KEYLEN = 64

/**
 * Hash a plaintext password using scrypt. Output format: `scrypt$<saltHex>$<hashHex>`.
 * No external dependency required.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  const derived = (await scrypt(password, salt, expected.length || SCRYPT_KEYLEN)) as Buffer
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

/** Generate a high-entropy opaque token (returned to the client). */
export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/** Deterministic hash of a token for at-rest storage. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Create a DB-backed session for the user and set the httpOnly session cookie.
 */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

/** Resolve the authenticated user id from the session cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  // Retry transient connectivity errors; a DB blip here would otherwise look
  // identical to "no session" and silently log the user out. On exhausted
  // retries this throws DatabaseUnavailableError (handled by callers).
  const session = await withDbRetry(() =>
    prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { userId: true, expiresAt: true },
    })
  )

  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    // Best-effort cleanup — never let a delete failure surface as an auth error.
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {})
    return null
  }

  return session.userId
}

/** Destroy the current session (DB row + cookie). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  cookieStore.delete(SESSION_COOKIE)
}

/** Destroy every active session for a user (used on password change / delete). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

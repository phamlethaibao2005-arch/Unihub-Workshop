import { headers } from "next/headers"
import { auth } from "./auth"
import { redis } from "@/shared/infrastructure/RedisClient"
import { UnauthorizedError, ForbiddenError } from "@/shared/errors/AppError"
import type { Role } from "@/modules/auth/domain/Role"

const SESSION_COOKIE = "better-auth.session_token"
const SESSION_TTL = 60 // seconds

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>

function parseCookieToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`)
  )
  return match ? decodeURIComponent(match[1]) : null
}

export async function getSession(): Promise<SessionResult> {
  const heads = await headers()
  const token = parseCookieToken(heads.get("cookie") ?? "")

  if (token) {
    const cached = await redis.get<SessionResult>(`session:${token}`)
    if (cached) return cached
  }

  const session = await auth.api.getSession({ headers: heads })

  if (session && token) {
    await redis.set(`session:${token}`, session, { ex: SESSION_TTL })
  }

  return session
}

export async function requireAuth(): Promise<NonNullable<SessionResult>> {
  const session = await getSession()
  if (!session) throw new UnauthorizedError("Authentication required")
  return session
}

export async function requireRole(role: Role): Promise<NonNullable<SessionResult>> {
  const session = await requireAuth()
  if (session.user.role !== role) {
    throw new ForbiddenError(`Required role: ${role}`)
  }
  return session
}

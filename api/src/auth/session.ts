import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Cookie, HttpRequest } from '@azure/functions'
import type { AuthUserContext } from '../../../shared/studyContracts.js'
import '../config/env.js'
import { verifyExamToken } from './examAuthClient.js'

const sessionCookieName = 'sc_session'
const localDevelopmentSecret = 'local-study-companion-session-secret'

type SessionCookiePayload = {
  token: string
  user: AuthUserContext
  csrfToken: string
  expiresAt: string
  issuedAt: string
}

export type AuthenticatedRequest = {
  token: string
  user: AuthUserContext
  csrfToken?: string
  source: 'cookie' | 'bearer' | 'session-header'
}

export type AuthRequestDiagnostics = {
  hasAuthorizationHeader: boolean
  hasBearerToken: boolean
  hasStudySessionHeader: boolean
  hasSessionCookie: boolean
}

function getSessionKey(): Buffer {
  const configuredSecret = process.env.STUDY_SESSION_SECRET

  if (!configuredSecret && (process.env.NODE_ENV === 'production' || process.env.WEBSITE_SITE_NAME)) {
    throw new Error('STUDY_SESSION_SECRET is required for deployed Study Companion sessions')
  }

  return createHash('sha256').update(configuredSecret ?? localDevelopmentSecret).digest()
}

function encryptPayload(payload: SessionCookiePayload): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getSessionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

function decryptPayload(value: string): SessionCookiePayload {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.')

  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid session cookie format')
  }

  const decipher = createDecipheriv('aes-256-gcm', getSessionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))

  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()])
  const payload = JSON.parse(decrypted.toString('utf8')) as SessionCookiePayload

  if (Date.parse(payload.expiresAt) <= Date.now()) {
    throw new Error('Session has expired')
  }

  return payload
}

function getCookie(request: HttpRequest, name: string): string | null {
  const cookieHeader = request.headers.get('cookie')

  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim())

  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split('=')
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join('='))
    }
  }

  return null
}

export function getAuthRequestDiagnostics(request: HttpRequest): AuthRequestDiagnostics {
  const authorization = request.headers.get('authorization')

  return {
    hasAuthorizationHeader: Boolean(authorization),
    hasBearerToken: Boolean(authorization?.toLowerCase().startsWith('bearer ')),
    hasStudySessionHeader: Boolean(request.headers.get('x-study-session')),
    hasSessionCookie: Boolean(getCookie(request, sessionCookieName))
  }
}

function isSecureRequest(request: HttpRequest): boolean {
  const forcedSetting = process.env.STUDY_COOKIE_SECURE

  if (forcedSetting) {
    return forcedSetting === 'true'
  }

  if (request.headers.get('x-forwarded-proto') === 'https') {
    return true
  }

  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return Boolean(process.env.WEBSITE_SITE_NAME)
  }
}

function getCookieMaxAge(expiresAt: string): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))
}

export function createSession(request: HttpRequest, token: string, user: AuthUserContext, expiresAt: string): { csrfToken: string; sessionToken: string; cookie: Cookie } {
  const csrfToken = randomBytes(32).toString('base64url')
  const encryptedSession = encryptPayload({
    token,
    user,
    csrfToken,
    expiresAt,
    issuedAt: new Date().toISOString()
  })

  return {
    csrfToken,
    sessionToken: encryptedSession,
    cookie: {
      name: sessionCookieName,
      value: encryptedSession,
      path: '/api',
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: 'Lax',
      maxAge: getCookieMaxAge(expiresAt)
    }
  }
}

export function clearSessionCookie(request: HttpRequest): Cookie {
  return {
    name: sessionCookieName,
    value: '',
    path: '/api',
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'Lax',
    maxAge: 0
  }
}

export async function authenticateRequest(request: HttpRequest): Promise<AuthenticatedRequest | null> {
  const headerSession = request.headers.get('x-study-session')
  const encryptedSession = headerSession || getCookie(request, sessionCookieName)

  if (encryptedSession) {
    const session = decryptPayload(encryptedSession)

    return {
      token: session.token,
      user: session.user,
      csrfToken: session.csrfToken,
      source: headerSession ? 'session-header' : 'cookie'
    }
  }

  const authorization = request.headers.get('authorization')

  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice('bearer '.length).trim()
    return {
      token,
      user: await verifyExamToken(token),
      source: 'bearer'
    }
  }

  return null
}

export function hasValidCsrf(request: HttpRequest, authenticatedRequest: AuthenticatedRequest): boolean {
  if (authenticatedRequest.source === 'bearer') {
    return true
  }

  const expected = authenticatedRequest.csrfToken
  const actual = request.headers.get('x-csrf-token')

  if (!expected || !actual) {
    return false
  }

  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}

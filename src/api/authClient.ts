import {
  apiErrorSchema,
  authMeResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  type AuthSession,
  type AuthUserContext,
  type LoginRequest
} from '../../shared/studyContracts'
import { getLoginRecaptchaToken } from './recaptchaClient'

const csrfStorageKey = 'studyCompanion.csrfToken'
const sessionTokenStorageKey = 'studyCompanion.sessionToken'
const authTokenStorageKey = 'studyCompanion.authToken'
const sessionExpiresAtStorageKey = 'studyCompanion.sessionExpiresAt'

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    throw new Error('Study Companion API is not available')
  }

  return response.json()
}

export function getCsrfToken(): string | null {
  return localStorage.getItem(csrfStorageKey) ?? sessionStorage.getItem(csrfStorageKey)
}

export function getStudySessionToken(): string | null {
  const expiresAt = localStorage.getItem(sessionExpiresAtStorageKey)

  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    clearSession()
    return null
  }

  return localStorage.getItem(sessionTokenStorageKey) ?? sessionStorage.getItem(sessionTokenStorageKey)
}

export function getStudyAuthToken(): string | null {
  const expiresAt = localStorage.getItem(sessionExpiresAtStorageKey)

  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    clearSession()
    return null
  }

  return localStorage.getItem(authTokenStorageKey) ?? sessionStorage.getItem(authTokenStorageKey)
}

export function hasStoredStudySession(): boolean {
  return Boolean(getStudySessionToken())
}

function storeSession(session: AuthSession): void {
  localStorage.setItem(csrfStorageKey, session.csrfToken)
  localStorage.setItem(sessionExpiresAtStorageKey, session.expiresAt)
  localStorage.removeItem(authTokenStorageKey)
  sessionStorage.removeItem(authTokenStorageKey)

  if (session.sessionToken) {
    localStorage.setItem(sessionTokenStorageKey, session.sessionToken)
  }
}

function clearSession(): void {
  sessionStorage.removeItem(csrfStorageKey)
  sessionStorage.removeItem(sessionTokenStorageKey)
  sessionStorage.removeItem(authTokenStorageKey)
  localStorage.removeItem(csrfStorageKey)
  localStorage.removeItem(sessionTokenStorageKey)
  localStorage.removeItem(authTokenStorageKey)
  localStorage.removeItem(sessionExpiresAtStorageKey)
}

function sessionHeaders(): HeadersInit {
  const sessionToken = getStudySessionToken()

  return {
    ...(sessionToken ? { 'x-study-session': sessionToken } : {})
  }
}

export async function loadCurrentUser(): Promise<AuthUserContext | null> {
  if (!hasStoredStudySession()) {
    return null
  }

  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
    headers: sessionHeaders()
  })

  if (response.status === 401 || response.status === 404) {
    clearSession()
    return null
  }

  if (!response.ok) {
    throw new Error('Unable to load current account')
  }

  const payload = authMeResponseSchema.parse(await readJsonResponse(response))
  return payload.data.user
}

export async function login(input: LoginRequest): Promise<AuthUserContext> {
  const recaptchaToken = await getLoginRecaptchaToken()
  const hasRecaptchaToken = Boolean(recaptchaToken)
  console.info('Study Companion login request starting', { hasRecaptchaToken })
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(loginRequestSchema.parse({ ...input, recaptcha_token: recaptchaToken }))
  })

  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload)
    const error = parsedError.success ? parsedError.data.error : 'Login failed'
    console.warn('Study Companion login request failed', {
      status: response.status,
      error,
      traceId: parsedError.success ? parsedError.data.trace_id : undefined,
      hasRecaptchaToken
    })
    throw new Error(error)
  }

  const parsed = loginResponseSchema.parse(payload)
  storeSession(parsed.data.session)
  return parsed.data.user
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      ...sessionHeaders(),
      ...(getCsrfToken() ? { 'x-csrf-token': getCsrfToken() as string } : {})
    }
  })
  clearSession()
}

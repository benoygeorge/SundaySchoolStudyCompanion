import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { ZodError } from 'zod'
import { loginRequestSchema, type LoginRequest } from '../../../shared/studyContracts.js'
import { ExamAuthError, loginWithExamAuth } from '../auth/examAuthClient.js'
import { authenticateRequest, clearSessionCookie, createSession, getAuthRequestDiagnostics } from '../auth/session.js'
import { badRequest, forbidden, ok, unauthorized } from '../http/responses.js'

function normalizeClientIp(value: string | null): string | null {
  const candidate = value?.split(',')[0]?.trim()

  if (!candidate || !/^[a-zA-Z0-9:.%-]+$/.test(candidate)) {
    return null
  }

  return candidate
}

function getClientIp(request: HttpRequest): string | null {
  return (
    normalizeClientIp(request.headers.get('x-forwarded-for')) ??
    normalizeClientIp(request.headers.get('x-client-ip')) ??
    normalizeClientIp(request.headers.get('x-real-ip')) ??
    normalizeClientIp(request.headers.get('cf-connecting-ip'))
  )
}

export async function login(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let input: LoginRequest | null = null
  const clientIp = getClientIp(request)

  try {
    input = loginRequestSchema.parse(await request.json())
    const loginResult = await loginWithExamAuth(input, { clientIp })
    const sessionUser = {
      ...loginResult.user,
      id: input.user_id.trim()
    }
    const session = createSession(request, loginResult.token, sessionUser, loginResult.expiresAt)

    return ok(
      context,
      {
        session: {
          expiresAt: loginResult.expiresAt,
          csrfToken: session.csrfToken,
          sessionToken: session.sessionToken
        },
        user: sessionUser
      },
      'Login successful',
      [session.cookie]
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest(context, 'user_id and password are required')
    }

    const message = error instanceof Error ? error.message : 'Login failed'
    if (message.includes('allowed Study Companion user')) {
      return forbidden(context, 'Study Companion access is not enabled for this account')
    }

    if (error instanceof ExamAuthError && error.status === 403) {
      return forbidden(context, message)
    }

    context.warn('Study Companion login failed', {
      hasRecaptchaToken: Boolean(input?.recaptcha_token),
      hasClientIp: Boolean(clientIp),
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error)
    })
    return unauthorized(context, 'Invalid user ID or password')
  }
}

export async function me(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const auth = await authenticateRequest(request)

    if (!auth) {
      context.warn('Study Companion /me request did not include auth proof', getAuthRequestDiagnostics(request))
      return unauthorized(context)
    }

    return ok(context, { user: auth.user })
  } catch (error) {
    context.warn('Unable to validate Study Companion session', {
      diagnostics: getAuthRequestDiagnostics(request),
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error)
    })
    return unauthorized(context, 'Unauthorized', [clearSessionCookie(request)])
  }
}

export async function logout(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return ok(context, null, 'Logout successful', [clearSessionCookie(request)])
}

app.http('auth-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: login
})

app.http('auth-me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/me',
  handler: me
})

app.http('auth-logout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler: logout
})

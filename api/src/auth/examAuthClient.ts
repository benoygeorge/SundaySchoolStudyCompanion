import { z } from 'zod'
import { loginRequestSchema, type AuthUserContext, type LoginRequest } from '../../../shared/studyContracts.js'
import '../config/env.js'
import { mapExamUserToAuthContext } from './roles.js'

const examEnvelopeSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      token: z.string().optional(),
      user: z.unknown().optional(),
      valid: z.boolean().optional()
    })
    .optional(),
  error: z.string().optional(),
  message: z.string().optional()
})

export type ExamLoginResult = {
  token: string
  user: AuthUserContext
  expiresAt: string
}

type ExamRequestContext = {
  clientIp?: string | null
}

export class ExamAuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'ExamAuthError'
  }
}

function getExamAuthBaseUrl(): string {
  return (process.env.EXAM_AUTH_BASE_URL ?? 'https://api-exam.msossa.org/api').replace(/\/$/, '')
}

function clientIpHeaders(context?: ExamRequestContext): Record<string, string> {
  if (!context?.clientIp) {
    return {}
  }

  return {
    'x-forwarded-for': context.clientIp,
    'x-real-ip': context.clientIp,
    'x-client-ip': context.clientIp
  }
}

async function postExam(path: string, body: unknown, token?: string, context?: ExamRequestContext): Promise<z.infer<typeof examEnvelopeSchema>> {
  const response = await fetch(`${getExamAuthBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...clientIpHeaders(context),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  })

  const payload = examEnvelopeSchema.parse(await response.json())

  if (!response.ok || !payload.success) {
    throw new ExamAuthError(payload.error ?? payload.message ?? 'Exam auth request failed', response.status)
  }

  return payload
}

function decodeJwtExpiresAt(token: string): string {
  const payload = token.split('.')[1]

  if (!payload) {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString()
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number }

    if (decoded.exp) {
      return new Date(decoded.exp * 1000).toISOString()
    }
  } catch {
    // Fall through to a short local expiry when the JWT cannot be decoded.
  }

  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}

export async function loginWithExamAuth(input: LoginRequest, context?: ExamRequestContext): Promise<ExamLoginResult> {
  const loginInput = loginRequestSchema.parse(input)
  const payload = await postExam('/auth/login', loginInput, undefined, context)
  const token = payload.data?.token
  const user = mapExamUserToAuthContext((payload.data?.user ?? {}) as Record<string, unknown>)

  if (!token || !user) {
    throw new Error('Login response did not include an allowed Study Companion user')
  }

  return {
    token,
    user,
    expiresAt: decodeJwtExpiresAt(token)
  }
}

export async function verifyExamToken(token: string): Promise<AuthUserContext> {
  const payload = await postExam('/auth/verify-token', { token }, token)

  if (payload.data?.valid === false) {
    throw new Error('Invalid or expired token')
  }

  const user = mapExamUserToAuthContext((payload.data?.user ?? {}) as Record<string, unknown>)

  if (!user) {
    throw new Error('Token does not map to an allowed Study Companion role')
  }

  return user
}

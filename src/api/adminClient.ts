import {
  adminCurriculumInputSchema,
  adminCurriculumResponseSchema,
  adminQuestionInputSchema,
  adminQuestionListResponseSchema,
  adminQuestionResponseSchema,
  apiErrorSchema,
  type AdminCurriculum,
  type AdminCurriculumInput,
  type AdminQuestion,
  type AdminQuestionInput
} from '../../shared/studyContracts'
import { getCsrfToken, getStudyAuthToken, getStudySessionToken } from './authClient'

type AdminAuthDiagnostics = {
  hasLegacyAuthToken: boolean
  hasSessionToken: boolean
  hasCsrfToken: boolean
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    throw new Error('Study Companion API is not available')
  }

  return response.json()
}

async function fetchAdminJson(url: string, init?: RequestInit): Promise<unknown> {
  const sessionToken = getStudySessionToken()
  const diagnostics: AdminAuthDiagnostics = {
    hasLegacyAuthToken: Boolean(getStudyAuthToken()),
    hasSessionToken: Boolean(sessionToken),
    hasCsrfToken: Boolean(getCsrfToken())
  }
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(sessionToken ? { 'x-study-session': sessionToken } : {}),
      ...(init?.headers ?? {})
    }
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload)
    const error = parsedError.success ? parsedError.data.error : `Request failed: ${response.status}`
    console.warn('Study Companion admin request failed', {
      url,
      method: init?.method ?? 'GET',
      status: response.status,
      error,
      traceId: parsedError.success ? parsedError.data.trace_id : undefined,
      auth: diagnostics
    })
    throw new Error(error)
  }

  return payload
}

function writeHeaders(): HeadersInit {
  const csrfToken = getCsrfToken()
  const sessionToken = getStudySessionToken()

  return {
    'content-type': 'application/json',
    ...(sessionToken ? { 'x-study-session': sessionToken } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
  }
}

export async function loadAdminCurriculum(gradeId: string): Promise<AdminCurriculum> {
  const payload = adminCurriculumResponseSchema.parse(await fetchAdminJson(`/api/grades/${encodeURIComponent(gradeId)}/management/curriculum`))
  return payload.data
}

export async function saveAdminCurriculum(gradeId: string, input: AdminCurriculumInput): Promise<AdminCurriculum> {
  const payload = adminCurriculumResponseSchema.parse(
    await fetchAdminJson(`/api/grades/${encodeURIComponent(gradeId)}/management/curriculum`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify(adminCurriculumInputSchema.parse(input))
    })
  )
  return payload.data
}

export async function loadAdminQuestions(gradeId: string): Promise<AdminQuestion[]> {
  const payload = adminQuestionListResponseSchema.parse(await fetchAdminJson(`/api/grades/${encodeURIComponent(gradeId)}/management/questions`))
  return payload.data.questions
}

export async function createAdminQuestion(gradeId: string, input: AdminQuestionInput): Promise<AdminQuestion> {
  const payload = adminQuestionResponseSchema.parse(
    await fetchAdminJson(`/api/grades/${encodeURIComponent(gradeId)}/management/questions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify(adminQuestionInputSchema.parse(input))
    })
  )
  return payload.data
}

export async function updateAdminQuestion(gradeId: string, questionId: string, input: AdminQuestionInput): Promise<AdminQuestion> {
  const payload = adminQuestionResponseSchema.parse(
    await fetchAdminJson(`/api/grades/${encodeURIComponent(gradeId)}/management/questions/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      headers: writeHeaders(),
      body: JSON.stringify(adminQuestionInputSchema.parse(input))
    })
  )
  return payload.data
}

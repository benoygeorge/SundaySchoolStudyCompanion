import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { ZodError } from 'zod'
import { adminCurriculumInputSchema, adminQuestionInputSchema } from '../../../shared/studyContracts.js'
import { authenticateRequest, clearSessionCookie, getAuthRequestDiagnostics, hasValidCsrf, type AuthenticatedRequest } from '../auth/session.js'
import { getCosmosAdminStore } from '../data/cosmosAdminStore.js'
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from '../http/responses.js'

type AdminAuthResult = { auth: AuthenticatedRequest } | { response: HttpResponseInit }

async function requireAdmin(request: HttpRequest, context: InvocationContext, requireCsrf: boolean): Promise<AdminAuthResult> {
  let auth: AuthenticatedRequest | null

  try {
    auth = await authenticateRequest(request)
  } catch (error) {
    context.warn('Unable to validate Admin session', {
      diagnostics: getAuthRequestDiagnostics(request),
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error)
    })
    return { response: unauthorized(context, 'Unauthorized', [clearSessionCookie(request)]) }
  }

  if (!auth) {
    context.warn('Admin request did not include auth proof', getAuthRequestDiagnostics(request))
    return { response: unauthorized(context) }
  }

  if (auth.user.role !== 'Admin') {
    context.warn('Non-admin user attempted Admin request', {
      role: auth.user.role,
      sourceRole: auth.user.sourceRole,
      authSource: auth.source
    })
    return { response: forbidden(context, 'Admin access is required') }
  }

  if (requireCsrf && !hasValidCsrf(request, auth)) {
    context.warn('Admin write rejected due to missing or invalid CSRF token', {
      authSource: auth.source,
      hasCsrfHeader: Boolean(request.headers.get('x-csrf-token'))
    })
    return { response: forbidden(context, 'A valid CSRF token is required') }
  }

  return { auth }
}

function getGradeId(request: HttpRequest): string | null {
  return request.params.gradeId?.trim() || null
}

function getQuestionId(request: HttpRequest): string | null {
  return request.params.questionId?.trim() || null
}

function parseRequestError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join('; ')
  }

  if (error instanceof SyntaxError) {
    return 'Request body must be valid JSON'
  }

  return 'Invalid request body'
}

export async function adminCurriculum(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gradeId = getGradeId(request)

  if (!gradeId) {
    return notFound(context, 'Grade not found')
  }

  try {
    const authResult = await requireAdmin(request, context, request.method === 'PUT')

    if ('response' in authResult) {
      return authResult.response
    }

    const store = getCosmosAdminStore()

    if (request.method === 'GET') {
      const curriculum = await store.getCurriculum(gradeId)
      return curriculum ? ok(context, curriculum) : notFound(context, 'Grade not found')
    }

    const input = adminCurriculumInputSchema.parse(await request.json())
    return ok(context, await store.saveCurriculum(gradeId, input, authResult.auth.user), 'Curriculum saved')
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return badRequest(context, parseRequestError(error))
    }

    context.error('Unable to manage Admin curriculum', error)
    return serverError(context, 'Unable to manage curriculum')
  }
}

export async function adminQuestions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gradeId = getGradeId(request)

  if (!gradeId) {
    return notFound(context, 'Grade not found')
  }

  try {
    const authResult = await requireAdmin(request, context, request.method === 'POST')

    if ('response' in authResult) {
      return authResult.response
    }

    const store = getCosmosAdminStore()

    if (request.method === 'GET') {
      return ok(context, { questions: await store.listQuestions(gradeId) })
    }

    const input = adminQuestionInputSchema.parse(await request.json())
    return ok(context, await store.createQuestion(gradeId, input, authResult.auth.user), 'Question created')
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return badRequest(context, parseRequestError(error))
    }

    context.error('Unable to manage Admin questions', error)
    return serverError(context, 'Unable to manage questions')
  }
}

export async function adminQuestion(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gradeId = getGradeId(request)
  const questionId = getQuestionId(request)

  if (!gradeId || !questionId) {
    return notFound(context, 'Question not found')
  }

  try {
    const authResult = await requireAdmin(request, context, true)

    if ('response' in authResult) {
      return authResult.response
    }

    const input = adminQuestionInputSchema.parse(await request.json())
    const question = await getCosmosAdminStore().updateQuestion(gradeId, questionId, input, authResult.auth.user)

    return question ? ok(context, question, 'Question saved') : notFound(context, 'Question not found')
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return badRequest(context, parseRequestError(error))
    }

    context.error('Unable to update Admin question', error)
    return serverError(context, 'Unable to update question')
  }
}

app.http('admin-curriculum', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'grades/{gradeId}/management/curriculum',
  handler: adminCurriculum
})

app.http('admin-questions', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'grades/{gradeId}/management/questions',
  handler: adminQuestions
})

app.http('admin-question', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'grades/{gradeId}/management/questions/{questionId}',
  handler: adminQuestion
})

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getStudyStore } from '../data/studyStore.js'
import { notFound, ok, serverError } from '../http/responses.js'

export async function getGradeStudyPayload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const gradeId = request.params.gradeId

  if (!gradeId) {
    return notFound(context, 'Grade not found')
  }

  try {
    const payload = await getStudyStore().getStudyPayload(gradeId)

    if (!payload) {
      return notFound(context, 'Grade not found')
    }

    return ok(context, payload)
  } catch (error) {
    context.error('Unable to load study payload', error)
    return serverError(context, 'Unable to load study payload')
  }
}

app.http('study-payload', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'grades/{gradeId}/study-payload',
  handler: getGradeStudyPayload
})

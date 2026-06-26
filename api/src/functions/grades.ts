import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions'
import { getStudyStore } from '../data/studyStore.js'
import { ok, serverError } from '../http/responses.js'

export async function listGrades(_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    return ok(context, { grades: await getStudyStore().getGrades() })
  } catch (error) {
    context.error('Unable to load grades', error)
    return serverError(context, 'Unable to load grades')
  }
}

app.http('grades', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'grades',
  handler: listGrades
})

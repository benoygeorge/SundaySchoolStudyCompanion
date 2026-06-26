import type { Cookie, HttpResponseInit, InvocationContext } from '@azure/functions'

export function ok<T>(context: InvocationContext, data: T, message?: string, cookies?: Cookie[]): HttpResponseInit {
  return {
    status: 200,
    cookies,
    jsonBody: {
      success: true,
      data,
      message,
      trace_id: context.invocationId
    }
  }
}

export function badRequest(context: InvocationContext, error: string): HttpResponseInit {
  return {
    status: 400,
    jsonBody: {
      success: false,
      error,
      trace_id: context.invocationId
    }
  }
}

export function unauthorized(context: InvocationContext, error = 'Unauthorized', cookies?: Cookie[]): HttpResponseInit {
  return {
    status: 401,
    cookies,
    jsonBody: {
      success: false,
      error,
      trace_id: context.invocationId
    }
  }
}

export function forbidden(context: InvocationContext, error: string): HttpResponseInit {
  return {
    status: 403,
    jsonBody: {
      success: false,
      error,
      trace_id: context.invocationId
    }
  }
}

export function notFound(context: InvocationContext, error: string): HttpResponseInit {
  return {
    status: 404,
    jsonBody: {
      success: false,
      error,
      trace_id: context.invocationId
    }
  }
}

export function serverError(context: InvocationContext, error: string): HttpResponseInit {
  return {
    status: 500,
    jsonBody: {
      success: false,
      error,
      trace_id: context.invocationId
    }
  }
}

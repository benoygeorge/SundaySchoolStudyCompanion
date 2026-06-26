import {
  gradeListResponseSchema,
  gradeListSchema,
  studyPayloadResponseSchema,
  studyPayloadSchema,
  type GradeIndexEntry,
  type StudyPayload
} from '../../shared/studyContracts'

const staticFallbackEnabled = import.meta.env.VITE_ENABLE_STATIC_FALLBACK === 'true'

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON from ${url}`)
  }

  return response.json()
}

export async function loadGrades(): Promise<GradeIndexEntry[]> {
  try {
    const apiPayload = gradeListResponseSchema.parse(await fetchJson('/api/grades'))
    return apiPayload.data.grades
  } catch (error) {
    if (!staticFallbackEnabled) {
      throw error
    }

    const staticPayload = gradeListSchema.parse(await fetchJson('/data/grade-index.json'))
    return staticPayload.grades
  }
}

export async function loadStudyPayload(grade: GradeIndexEntry): Promise<StudyPayload> {
  try {
    const apiPayload = studyPayloadResponseSchema.parse(await fetchJson(`/api/grades/${grade.id}/study-payload`))
    return apiPayload.data
  } catch (error) {
    if (!staticFallbackEnabled) {
      throw error
    }

    const fallbackFile = grade.file ?? `/data/grades/${grade.id}.json`
    return studyPayloadSchema.parse(await fetchJson(fallbackFile))
  }
}

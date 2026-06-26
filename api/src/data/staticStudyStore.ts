import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gradeListSchema, studyPayloadSchema, type GradeIndexEntry, type StudyPayload } from '../../../shared/studyContracts.js'
import type { StudyStore } from './studyStore.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
let publicDataRoot: string | null = null

async function getPublicDataRoot(): Promise<string> {
  if (publicDataRoot) {
    return publicDataRoot
  }

  const candidates = [
    join(process.cwd(), 'public', 'data'),
    join(process.cwd(), '..', 'public', 'data'),
    join(currentDir, '..', '..', '..', 'public', 'data'),
    join(currentDir, '..', '..', '..', '..', '..', 'public', 'data')
  ]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      publicDataRoot = candidate
      return candidate
    } catch {
      // Try the next known local/build layout.
    }
  }

  throw new Error('Unable to locate public data directory')
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function getGrades(): Promise<GradeIndexEntry[]> {
  const dataRoot = await getPublicDataRoot()
  const payload = gradeListSchema.parse(await readJsonFile(join(dataRoot, 'grade-index.json')))
  return payload.grades
}

export async function getStudyPayload(gradeId: string): Promise<StudyPayload | null> {
  const grades = await getGrades()
  const grade = grades.find((entry) => entry.id === gradeId)

  if (!grade) {
    return null
  }

  const fallbackFile = grade.file ?? `/data/grades/${grade.id}.json`
  const relativeFile = fallbackFile.replace(/^\/?data\//, '')
  const dataRoot = await getPublicDataRoot()
  return studyPayloadSchema.parse(await readJsonFile(join(dataRoot, relativeFile)))
}

export const staticStudyStore: StudyStore = {
  getGrades,
  getStudyPayload
}

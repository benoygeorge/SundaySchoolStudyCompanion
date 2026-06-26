import type { GradeIndexEntry, StudyPayload } from '../../../shared/studyContracts.js'
import { CosmosStudyStore, isCosmosConfigured } from './cosmosStudyStore.js'
import { staticStudyStore } from './staticStudyStore.js'

export type StudyStore = {
  getGrades(): Promise<GradeIndexEntry[]>
  getStudyPayload(gradeId: string): Promise<StudyPayload | null>
}

class HybridStudyStore implements StudyStore {
  constructor(private readonly primary: StudyStore, private readonly fallback: StudyStore) {}

  async getGrades(): Promise<GradeIndexEntry[]> {
    const grades = await this.primary.getGrades()
    return grades.length > 0 ? grades : this.fallback.getGrades()
  }

  async getStudyPayload(gradeId: string): Promise<StudyPayload | null> {
    return (await this.primary.getStudyPayload(gradeId)) ?? this.fallback.getStudyPayload(gradeId)
  }
}

let store: StudyStore | null = null

function shouldUseStaticFallback(): boolean {
  if (process.env.STUDY_DISABLE_STATIC_FALLBACK === 'true') {
    return false
  }

  return process.env.STUDY_ENABLE_STATIC_FALLBACK !== 'false'
}

export function getStudyStore(): StudyStore {
  if (store) {
    return store
  }

  const staticFallbackEnabled = shouldUseStaticFallback()

  if (isCosmosConfigured()) {
    const cosmosStore = new CosmosStudyStore()
    store = staticFallbackEnabled ? new HybridStudyStore(cosmosStore, staticStudyStore) : cosmosStore
    return store
  }

  if (!staticFallbackEnabled) {
    throw new Error('Cosmos settings are required because static fallback is disabled')
  }

  store = staticStudyStore
  return store
}

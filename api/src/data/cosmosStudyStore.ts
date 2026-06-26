import { CosmosClient, type Container } from '@azure/cosmos'
import type { Chapter, CurriculumBook, CurriculumSection, GradeIndexEntry, QuestionCitation, StudyPayload, StudyQuestion, StudyReference } from '../../../shared/studyContracts.js'
import '../config/env.js'
import type { StudyStore } from './studyStore.js'

type CurriculumDocument = {
  docType: 'curriculum'
  gradeId: string
  label: string
  title?: string
  description?: string
  books?: CurriculumBook[]
  sections?: CurriculumSection[]
  chapters?: Chapter[]
  referenceLinks?: StudyReference[]
}

type QuestionDocument = {
  docType: 'question'
  id: string
  gradeId: string
  status?: string
  questionType: string
  chapterId: string
  difficulty?: string | null
  question: string
  options?: string[] | null
  answer?: string | null
  explanation?: string | null
  citations?: QuestionCitation[]
  warning?: {
    active: boolean
    label?: string | null
    reason?: string | null
  }
}

const contentContainerName = process.env.STUDY_CONTENT_CONTAINER ?? 'study-content'

function getCosmosSetting(name: 'database' | 'endpoint' | 'key'): string | undefined {
  const settingNames = {
    database: ['COSMOS_DATABASE_ID', 'cosmos-db-database'],
    endpoint: ['COSMOS_ENDPOINT', 'cosmos-db-endpoint'],
    key: ['COSMOS_KEY', 'cosmos-db-key']
  }[name]

  return settingNames.map((settingName) => process.env[settingName]).find((value): value is string => Boolean(value))
}

function getRequiredCosmosSetting(name: 'database' | 'endpoint' | 'key'): string {
  const value = getCosmosSetting(name)

  if (!value) {
    throw new Error(`${name} Cosmos setting is required when Cosmos reads are enabled`)
  }

  return value
}

export function isCosmosConfigured(): boolean {
  return Boolean(getCosmosSetting('endpoint') && getCosmosSetting('key') && getCosmosSetting('database'))
}

function gradeSortValue(grade: Pick<GradeIndexEntry, 'id' | 'label'>): number {
  const value = grade.id.match(/\d+/)?.[0] ?? grade.label.match(/\d+/)?.[0]
  return value ? Number(value) : Number.MAX_SAFE_INTEGER
}

function sortGrades(grades: GradeIndexEntry[]): GradeIndexEntry[] {
  return [...grades].sort((left, right) => gradeSortValue(left) - gradeSortValue(right) || left.label.localeCompare(right.label))
}

function mapQuestion(question: QuestionDocument): StudyQuestion {
  return {
    id: question.id,
    chapterId: question.chapterId,
    type: question.questionType,
    difficulty: question.difficulty,
    status: question.status,
    question: question.question,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    citations: question.citations,
    warning: question.warning
      ? {
          active: question.warning.active,
          label: question.warning.label ?? (question.warning.active ? 'Under review' : null)
        }
      : undefined
  }
}

export class CosmosStudyStore implements StudyStore {
  private readonly contentContainer: Container

  constructor() {
    const client = new CosmosClient({
      endpoint: getRequiredCosmosSetting('endpoint'),
      key: getRequiredCosmosSetting('key')
    })
    this.contentContainer = client.database(getRequiredCosmosSetting('database')).container(contentContainerName)
  }

  async getGrades(): Promise<GradeIndexEntry[]> {
    const { resources } = await this.contentContainer.items
      .query<CurriculumDocument>({
        query: 'SELECT c.gradeId, c.label, c.description FROM c WHERE c.docType = @docType',
        parameters: [{ name: '@docType', value: 'curriculum' }]
      })
      .fetchAll()

    return sortGrades(resources.map((curriculum) => ({
      id: curriculum.gradeId,
      label: curriculum.label,
      description: curriculum.description
    })))
  }

  async getStudyPayload(gradeId: string): Promise<StudyPayload | null> {
    const [curriculum, questions] = await Promise.all([this.getCurriculum(gradeId), this.getQuestions(gradeId)])

    if (!curriculum) {
      return null
    }

    return {
      grade: curriculum.label,
      title: curriculum.title ?? 'Interactive Study Companion',
      description: curriculum.description,
      books: curriculum.books ?? [],
      sections: curriculum.sections ?? [],
      chapters: curriculum.chapters ?? [],
      questions: questions.map(mapQuestion),
      references: curriculum.referenceLinks ?? []
    }
  }

  private async getCurriculum(gradeId: string): Promise<CurriculumDocument | null> {
    const { resources } = await this.contentContainer.items
      .query<CurriculumDocument>(
        {
          query: 'SELECT * FROM c WHERE c.docType = @docType AND c.gradeId = @gradeId',
          parameters: [
            { name: '@docType', value: 'curriculum' },
            { name: '@gradeId', value: gradeId }
          ]
        },
        { partitionKey: gradeId }
      )
      .fetchAll()

    return resources[0] ?? null
  }

  private async getQuestions(gradeId: string): Promise<QuestionDocument[]> {
    const { resources } = await this.contentContainer.items
      .query<QuestionDocument>(
        {
          query: 'SELECT * FROM c WHERE c.docType = @docType AND c.gradeId = @gradeId AND (NOT IS_DEFINED(c.status) OR c.status != @archivedStatus)',
          parameters: [
            { name: '@docType', value: 'question' },
            { name: '@gradeId', value: gradeId },
            { name: '@archivedStatus', value: 'archived' }
          ]
        },
        { partitionKey: gradeId }
      )
      .fetchAll()

    return resources
  }
}

import { BulkOperationType, CosmosClient, type Container, type JSONObject, type OperationInput } from '@azure/cosmos'
import { randomUUID } from 'node:crypto'
import type {
  AdminCurriculum,
  AdminCurriculumInput,
  AdminQuestion,
  AdminQuestionInput,
  AuthUserContext,
  Chapter,
  CurriculumBook,
  CurriculumSection,
  QuestionCitation,
  StudyReference
} from '../../../shared/studyContracts.js'
import '../config/env.js'

type CurriculumDocument = {
  id: string
  docType: 'curriculum'
  gradeId: string
  label: string
  title?: string
  description?: string
  books?: CurriculumBook[]
  sections?: CurriculumSection[]
  chapters?: Chapter[]
  referenceLinks?: StudyReference[]
  version?: number
  createdAt?: string
  updatedAt?: string
}

type QuestionDocument = {
  id: string
  docType: 'question'
  gradeId: string
  sourceQuestionId?: string
  status?: 'unrated' | 'published' | 'archived'
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
    resolvedAt?: string | null
  }
  version?: number
  createdBy?: ActorDocument
  createdAt?: string
  updatedAt?: string
}

type ActorDocument = {
  authProvider: 'exam-api'
  userId: string
  roleAtAction?: AuthUserContext['role']
  roleAtCreation?: AuthUserContext['role']
}

type AuditDocument = {
  id: string
  docType: 'auditLog'
  gradeId: string
  entityType: 'curriculum' | 'question'
  entityId: string
  action: string
  actorRole: AuthUserContext['role']
  actor: ActorDocument
  summary: string
  details: Record<string, string | number | boolean | null>
  createdAt: string
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
    throw new Error(`${name} Cosmos setting is required for Admin content management`)
  }

  return value
}

function utcNow(): string {
  return new Date().toISOString()
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function nullableText(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function optionalText(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function actorFor(user: AuthUserContext): ActorDocument {
  return {
    authProvider: 'exam-api',
    userId: user.id,
    roleAtAction: user.role
  }
}

function creationActorFor(user: AuthUserContext): ActorDocument {
  return {
    authProvider: 'exam-api',
    userId: user.id,
    roleAtCreation: user.role
  }
}

function stripCosmosMetadata<T extends Record<string, unknown>>(document: T): Record<string, unknown> {
  const metadataKeys = new Set(['_rid', '_self', '_etag', '_attachments', '_ts'])
  return Object.fromEntries(Object.entries(document).filter(([key]) => !metadataKeys.has(key)))
}

function toJsonBody(document: Record<string, unknown>): JSONObject {
  return document as JSONObject
}

function mapCurriculum(document: CurriculumDocument): AdminCurriculum {
  return {
    gradeId: document.gradeId,
    label: document.label,
    title: document.title,
    description: document.description,
    books: document.books ?? [],
    sections: document.sections ?? [],
    chapters: document.chapters ?? [],
    referenceLinks: document.referenceLinks ?? [],
    version: document.version,
    updatedAt: document.updatedAt
  }
}

function mapQuestion(document: QuestionDocument): AdminQuestion {
  return {
    id: document.id,
    gradeId: document.gradeId,
    status: document.status ?? 'unrated',
    questionType: document.questionType,
    chapterId: document.chapterId,
    difficulty: document.difficulty,
    question: document.question,
    options: document.options,
    answer: document.answer,
    explanation: document.explanation,
    citations: document.citations,
    warning: document.warning
      ? {
          active: document.warning.active,
          label: document.warning.label,
          reason: document.warning.reason
        }
      : undefined,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  }
}

function sortQuestions(left: QuestionDocument, right: QuestionDocument): number {
  return left.chapterId.localeCompare(right.chapterId, undefined, { numeric: true }) || left.id.localeCompare(right.id)
}

function buildQuestionDocument(gradeId: string, input: AdminQuestionInput, now: string, createdBy: AuthUserContext): QuestionDocument {
  const questionId = `q_${normalizeId(gradeId)}_${randomUUID().slice(0, 8)}`

  return {
    id: questionId,
    docType: 'question',
    gradeId,
    status: input.status,
    questionType: input.questionType.trim(),
    chapterId: input.chapterId.trim(),
    difficulty: nullableText(input.difficulty),
    question: input.question.trim(),
    options: input.options?.map((option) => option.trim()).filter(Boolean) ?? null,
    answer: nullableText(input.answer),
    explanation: nullableText(input.explanation),
    citations: input.citations,
    warning: input.warning
      ? {
          active: input.warning.active,
          label: nullableText(input.warning.label),
          reason: nullableText(input.warning.reason),
          resolvedAt: input.warning.active ? null : now
        }
      : {
          active: false,
          label: null,
          reason: null,
          resolvedAt: null
        },
    version: 1,
    createdBy: creationActorFor(createdBy),
    createdAt: now,
    updatedAt: now
  }
}

function applyQuestionInput(existing: QuestionDocument, input: AdminQuestionInput, now: string): QuestionDocument {
  const base = stripCosmosMetadata(existing) as QuestionDocument

  return {
    ...base,
    status: input.status,
    questionType: input.questionType.trim(),
    chapterId: input.chapterId.trim(),
    difficulty: nullableText(input.difficulty),
    question: input.question.trim(),
    options: input.options?.map((option) => option.trim()).filter(Boolean) ?? null,
    answer: nullableText(input.answer),
    explanation: nullableText(input.explanation),
    citations: input.citations,
    warning: input.warning
      ? {
          active: input.warning.active,
          label: nullableText(input.warning.label),
          reason: nullableText(input.warning.reason),
          resolvedAt: input.warning.active ? null : existing.warning?.resolvedAt ?? now
        }
      : existing.warning,
    version: (existing.version ?? 1) + 1,
    updatedAt: now
  }
}

function buildAudit(gradeId: string, entityType: AuditDocument['entityType'], entityId: string, action: string, summary: string, reason: string, actor: AuthUserContext, now: string): AuditDocument {
  return {
    id: `audit_${entityType}_${entityId}_${randomUUID()}`,
    docType: 'auditLog',
    gradeId,
    entityType,
    entityId,
    action,
    actorRole: actor.role,
    actor: actorFor(actor),
    summary,
    details: {
      reason: reason.trim()
    },
    createdAt: now
  }
}

export class CosmosAdminStore {
  private readonly contentContainer: Container

  constructor() {
    const client = new CosmosClient({
      endpoint: getRequiredCosmosSetting('endpoint'),
      key: getRequiredCosmosSetting('key')
    })
    this.contentContainer = client.database(getRequiredCosmosSetting('database')).container(contentContainerName)
  }

  async getCurriculum(gradeId: string): Promise<AdminCurriculum | null> {
    const document = await this.getCurriculumDocument(gradeId)
    return document ? mapCurriculum(document) : null
  }

  async saveCurriculum(gradeId: string, input: AdminCurriculumInput, user: AuthUserContext): Promise<AdminCurriculum> {
    const existing = await this.getCurriculumDocument(gradeId)
    const now = utcNow()
    const document: CurriculumDocument = {
      ...(existing ? (stripCosmosMetadata(existing) as CurriculumDocument) : { id: `${gradeId}-curriculum`, docType: 'curriculum', gradeId, createdAt: now }),
      label: input.label.trim(),
      title: optionalText(input.title),
      description: optionalText(input.description),
      books: input.books,
      sections: input.sections,
      chapters: input.chapters,
      referenceLinks: input.referenceLinks,
      version: (existing?.version ?? 0) + 1,
      updatedAt: now
    }
    const audit = buildAudit(gradeId, 'curriculum', document.id, existing ? 'curriculum_updated' : 'curriculum_created', 'Curriculum metadata updated.', input.reason, user, now)

    await this.writeBatch(gradeId, [
      { operationType: BulkOperationType.Upsert, resourceBody: toJsonBody(document) },
      { operationType: BulkOperationType.Create, resourceBody: toJsonBody(audit) }
    ])

    return mapCurriculum(document)
  }

  async listQuestions(gradeId: string): Promise<AdminQuestion[]> {
    const { resources } = await this.contentContainer.items
      .query<QuestionDocument>(
        {
          query: 'SELECT * FROM c WHERE c.docType = @docType AND c.gradeId = @gradeId',
          parameters: [
            { name: '@docType', value: 'question' },
            { name: '@gradeId', value: gradeId }
          ]
        },
        { partitionKey: gradeId }
      )
      .fetchAll()

    return resources.sort(sortQuestions).map(mapQuestion)
  }

  async createQuestion(gradeId: string, input: AdminQuestionInput, user: AuthUserContext): Promise<AdminQuestion> {
    const now = utcNow()
    const document = buildQuestionDocument(gradeId, input, now, user)
    const audit = buildAudit(gradeId, 'question', document.id, 'question_created', 'Question created by Admin.', input.reason, user, now)

    await this.writeBatch(gradeId, [
      { operationType: BulkOperationType.Create, resourceBody: toJsonBody(document) },
      { operationType: BulkOperationType.Create, resourceBody: toJsonBody(audit) }
    ])

    return mapQuestion(document)
  }

  async updateQuestion(gradeId: string, questionId: string, input: AdminQuestionInput, user: AuthUserContext): Promise<AdminQuestion | null> {
    const existing = await this.getQuestionDocument(gradeId, questionId)

    if (!existing) {
      return null
    }

    const now = utcNow()
    const document = applyQuestionInput(existing, input, now)
    const action = input.status === 'archived' && existing.status !== 'archived' ? 'question_archived' : 'question_updated'
    const audit = buildAudit(gradeId, 'question', document.id, action, action === 'question_archived' ? 'Question archived by Admin.' : 'Question updated by Admin.', input.reason, user, now)

    await this.writeBatch(gradeId, [
      { operationType: BulkOperationType.Upsert, resourceBody: toJsonBody(document) },
      { operationType: BulkOperationType.Create, resourceBody: toJsonBody(audit) }
    ])

    return mapQuestion(document)
  }

  private async getCurriculumDocument(gradeId: string): Promise<CurriculumDocument | null> {
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

  private async getQuestionDocument(gradeId: string, questionId: string): Promise<QuestionDocument | null> {
    const { resources } = await this.contentContainer.items
      .query<QuestionDocument>(
        {
          query: 'SELECT * FROM c WHERE c.docType = @docType AND c.gradeId = @gradeId AND c.id = @questionId',
          parameters: [
            { name: '@docType', value: 'question' },
            { name: '@gradeId', value: gradeId },
            { name: '@questionId', value: questionId }
          ]
        },
        { partitionKey: gradeId }
      )
      .fetchAll()

    return resources[0] ?? null
  }

  private async writeBatch(gradeId: string, operations: OperationInput[]): Promise<void> {
    const response = await this.contentContainer.items.batch(operations, gradeId)
    const statusCode = response.code ?? 500

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`Cosmos batch failed with status ${statusCode}`)
    }
  }
}

let adminStore: CosmosAdminStore | null = null

export function getCosmosAdminStore(): CosmosAdminStore {
  adminStore ??= new CosmosAdminStore()
  return adminStore
}
